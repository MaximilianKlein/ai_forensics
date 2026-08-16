import os
import sys
import glob
import re
import csv
import json
import time
import random
import argparse
from pathlib import Path
import numpy as np

# Ensure project root in sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from server.model_manager import ModelManager
from server.watermark import WatermarkConfig, detect_watermark

def clean_brown_text(raw_content: str) -> str:
    """
    Cleans POS-tagged Brown corpus text into natural English text.
    Handles lines like 'The/at Fulton/np-tl County/nn-tl' -> 'The Fulton County'
    and cleans quotation marks/punctuations.
    """
    words = []
    for line in raw_content.splitlines():
        line = line.strip()
        if not line:
            continue
        for token in line.split():
            # Brown corpus words are in the format word/tag
            if '/' in token:
                parts = token.rsplit('/', 1)
                word = parts[0]
            else:
                word = token
            # Normalize common Brown corpus escapes
            if word == '``' or word == "''":
                word = '"'
            words.append(word)
    
    text = " ".join(words)
    # Fix spacing before punctuation
    text = re.sub(r'\s+([,.:;!?])', r'\1', text)
    text = re.sub(r'\s+([)\]}])', r'\1', text)
    text = re.sub(r'([({\[])\s+', r'\1', text)
    return text

def load_categories(cats_path: str) -> dict:
    categories = {}
    if os.path.isfile(cats_path):
        with open(cats_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if len(row) >= 2:
                    categories[row[0].strip()] = row[1].strip()
    return categories

def run_benchmark(
    model_name: str = "gemma4:12b",
    gamma: float = 0.25,
    hash_key: int = 89173511,
    output_path: str = "server/data/brown_benchmark_results.json",
    limit: int = 0
):
    print(f"=== Starting Brown Corpus Watermark Benchmark ===")
    print(f"Model: {model_name}")
    print(f"Watermark Config: gamma={gamma}, hash_key={hash_key}, context_width=1")
    
    # 1. Load Model & Tokenizer
    mm = ModelManager()
    print(f"Loading model '{model_name}' (this might take a few seconds)...")
    mm.load_model(model_name)
    llm = mm.current_model
    vocab_size = llm.n_vocab()
    print(f"Model loaded successfully. Vocab size: {vocab_size}")

    config = WatermarkConfig(
        gamma=gamma,
        delta=3.0,
        hash_key=hash_key,
        context_width=1
    )

    # 2. Find Brown files and categories
    corpus_dir = "brown-corpus/brown/brown"
    if not os.path.exists(corpus_dir):
        corpus_dir = "brown-corpus"
    
    cats_file = "brown-corpus/cats.csv"
    categories = load_categories(cats_file) if os.path.exists(cats_file) else {}
    
    doc_files = sorted(glob.glob(f"{corpus_dir}/c[a-z][0-9][0-9]"))
    use_nltk = False
    
    if not doc_files:
        try:
            import nltk
            try:
                from nltk.corpus import brown
                doc_files = brown.fileids()
            except Exception:
                nltk.download('brown', quiet=True)
                from nltk.corpus import brown
                doc_files = brown.fileids()
            use_nltk = True
            print(f"Loaded {len(doc_files)} Brown corpus documents dynamically via NLTK.")
        except Exception as e:
            raise FileNotFoundError(f"No Brown corpus documents found locally or via NLTK: {e}")
    
    if limit > 0:
        doc_files = doc_files[:limit]
        
    print(f"Found {len(doc_files)} documents to evaluate.")

    # 3. Process documents
    doc_results = []
    category_stats = {}
    z_scores_list = []
    green_fractions_list = []
    
    t_start = time.time()
    
    for idx, fpath in enumerate(doc_files, 1):
        if use_nltk:
            from nltk.corpus import brown
            filename = fpath
            cat_list = brown.categories(filename)
            category = cat_list[0] if cat_list else "unknown"
            words = brown.words(filename)
            clean_text = " ".join(words)
        else:
            filename = os.path.basename(fpath)
            category = categories.get(filename, "unknown")
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                raw = f.read()
            clean_text = clean_brown_text(raw)
        tokens = llm.tokenize(clean_text.encode('utf-8'), add_bos=False)
        
        detection = detect_watermark(
            tokens=tokens,
            tokenizer_decode_fn=mm.decode_tokens,
            vocab_size=vocab_size,
            config=config,
            z_threshold=3.0
        )
        
        doc_info = {
            "id": filename,
            "filename": filename,
            "category": category,
            "total_tokens": detection.total_tokens,
            "evaluated_tokens": detection.evaluated_tokens,
            "green_tokens": detection.green_tokens,
            "red_tokens": detection.red_tokens,
            "green_fraction": round(detection.green_fraction, 4),
            "z_score": round(detection.z_score, 3),
            "p_value": detection.p_value,
            "is_watermarked_z3": detection.z_score >= 3.0,
            "is_watermarked_z2": detection.z_score >= 2.0,
            "is_watermarked_z4": detection.z_score >= 4.0,
            "is_watermarked_z5": detection.z_score >= 5.0,
            "preview": clean_text[:280] + ("..." if len(clean_text) > 280 else "")
        }
        doc_results.append(doc_info)
        z_scores_list.append(detection.z_score)
        green_fractions_list.append(detection.green_fraction)
        
        # Category aggregation
        if category not in category_stats:
            category_stats[category] = {
                "count": 0,
                "total_tokens": 0,
                "z_scores": [],
                "green_fractions": [],
                "false_positives_z3": 0
            }
        category_stats[category]["count"] += 1
        category_stats[category]["total_tokens"] += detection.evaluated_tokens
        category_stats[category]["z_scores"].append(detection.z_score)
        category_stats[category]["green_fractions"].append(detection.green_fraction)
        if detection.z_score >= 3.0:
            category_stats[category]["false_positives_z3"] += 1

        if idx % 25 == 0 or idx == len(doc_files):
            elapsed = time.time() - t_start
            current_mean_z = np.mean(z_scores_list)
            current_mean_green = np.mean(green_fractions_list) * 100
            fp_count_z3 = sum(1 for z in z_scores_list if z >= 3.0)
            print(
                f"[{idx}/{len(doc_files)}] ({elapsed:.1f}s) "
                f"Mean Z: {current_mean_z:.2f} | Mean Green: {current_mean_green:.1f}% | "
                f"FPR (z>=3): {fp_count_z3}/{idx} ({fp_count_z3/idx*100:.2f}%)"
            )

    total_time = time.time() - t_start
    total_docs = len(doc_results)
    total_evaluated_tokens = sum(d["evaluated_tokens"] for d in doc_results)

    # 4. Global Statistics & False Positive Rates
    fp_z2 = sum(1 for z in z_scores_list if z >= 2.0)
    fp_z3 = sum(1 for z in z_scores_list if z >= 3.0)
    fp_z4 = sum(1 for z in z_scores_list if z >= 4.0)
    fp_z5 = sum(1 for z in z_scores_list if z >= 5.0)

    # Compute Histogram Distribution of Z-scores (e.g. bins from -4 to +4)
    hist_counts, bin_edges = np.histogram(z_scores_list, bins=20, range=(-4.0, 4.0))
    histogram = []
    for i in range(len(hist_counts)):
        histogram.append({
            "bin_start": round(float(bin_edges[i]), 2),
            "bin_end": round(float(bin_edges[i+1]), 2),
            "bin_label": f"{bin_edges[i]:.1f} to {bin_edges[i+1]:.1f}",
            "count": int(hist_counts[i]),
            "percentage": round(float(hist_counts[i]) / total_docs * 100, 2)
        })

    # Summary per category
    category_summary = []
    for cat_name, cdata in category_stats.items():
        category_summary.append({
            "category": cat_name,
            "doc_count": cdata["count"],
            "total_tokens": cdata["total_tokens"],
            "mean_z_score": round(float(np.mean(cdata["z_scores"])), 3),
            "std_z_score": round(float(np.std(cdata["z_scores"])), 3),
            "mean_green_fraction": round(float(np.mean(cdata["green_fractions"])), 4),
            "false_positives_z3": cdata["false_positives_z3"],
            "false_positive_rate_z3": round(cdata["false_positives_z3"] / cdata["count"], 4)
        })
    category_summary.sort(key=lambda c: c["category"])

    benchmark_dataset = {
        "metadata": {
            "model_name": model_name,
            "vocab_size": vocab_size,
            "watermark_config": {
                "gamma": gamma,
                "hash_key": hash_key,
                "context_width": 1
            },
            "total_documents": total_docs,
            "total_tokens_evaluated": total_evaluated_tokens,
            "average_tokens_per_doc": round(total_evaluated_tokens / total_docs, 1),
            "execution_time_seconds": round(total_time, 2),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        },
        "aggregate_metrics": {
            "mean_z_score": round(float(np.mean(z_scores_list)), 3),
            "median_z_score": round(float(np.median(z_scores_list)), 3),
            "std_z_score": round(float(np.std(z_scores_list)), 3),
            "min_z_score": round(float(np.min(z_scores_list)), 3),
            "max_z_score": round(float(np.max(z_scores_list)), 3),
            "mean_green_fraction": round(float(np.mean(green_fractions_list)), 4),
            "std_green_fraction": round(float(np.std(green_fractions_list)), 4),
            "expected_green_fraction": gamma
        },
        "false_positive_analysis": {
            "threshold_z2": {
                "threshold": 2.0,
                "theoretical_fpr": 0.02275, # Normal distribution P(Z >= 2) = 2.28%
                "empirical_false_positives": fp_z2,
                "empirical_fpr": round(fp_z2 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z2 / total_docs) * 100, 2)
            },
            "threshold_z3": {
                "threshold": 3.0,
                "theoretical_fpr": 0.00135, # Normal distribution P(Z >= 3) = 0.135%
                "empirical_false_positives": fp_z3,
                "empirical_fpr": round(fp_z3 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z3 / total_docs) * 100, 2)
            },
            "threshold_z4": {
                "threshold": 4.0,
                "theoretical_fpr": 0.00003, # Normal distribution P(Z >= 4) = 0.003%
                "empirical_false_positives": fp_z4,
                "empirical_fpr": round(fp_z4 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z4 / total_docs) * 100, 2)
            },
            "threshold_z5": {
                "threshold": 5.0,
                "theoretical_fpr": 0.0000003, # Normal distribution P(Z >= 5) = 0.00003%
                "empirical_false_positives": fp_z5,
                "empirical_fpr": round(fp_z5 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z5 / total_docs) * 100, 2)
            }
        },
        "histogram": histogram,
        "category_summary": category_summary,
        "documents": doc_results
    }

    # Ensure output directory exists and write
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(benchmark_dataset, f, indent=2)
        
    print(f"\n=== Benchmark Complete! ===")
    print(f"Results saved to: {output_path}")
    print(f"Total documents: {total_docs}")
    print(f"Mean Z-Score: {benchmark_dataset['aggregate_metrics']['mean_z_score']} (Expected ~0.0)")
    print(f"Mean Green Fraction: {benchmark_dataset['aggregate_metrics']['mean_green_fraction']*100:.2f}% (Expected {gamma*100:.1f}%)")
    print(f"False Positives at z >= 3.0: {fp_z3}/{total_docs} ({fp_z3/total_docs*100:.2f}%)")
    return benchmark_dataset

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark Brown Corpus against LLM watermark detector")
    parser.add_argument("--model", type=str, default="gemma4:12b", help="Model name (e.g. gemma4:12b)")
    parser.add_argument("--gamma", type=float, default=0.25, help="Green fraction gamma (default: 0.25)")
    parser.add_argument("--hash-key", type=int, default=89173511, help="Secret prime hash key (default: 89173511)")
    parser.add_argument("--output", type=str, default="server/data/brown_benchmark_results.json", help="Output JSON path")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of documents (0 = all)")
    args = parser.parse_args()

    run_benchmark(
        model_name=args.model,
        gamma=args.gamma,
        hash_key=args.hash_key,
        output_path=args.output,
        limit=args.limit
    )
