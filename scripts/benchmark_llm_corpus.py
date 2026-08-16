import os
import sys
import json
import time
import argparse
from pathlib import Path
import numpy as np

# Ensure project root in sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from server.model_manager import ModelManager
from server.watermark import WatermarkConfig, detect_watermark

def load_llm_samples(dataset_name: str, target_count: int = 500):
    from datasets import load_dataset
    print(f"Streaming samples from HuggingFace dataset '{dataset_name}'...")
    samples = []
    
    try:
        ds = load_dataset(dataset_name, split="train", streaming=True)
        for i, item in enumerate(ds):
            # Check dataset format
            if "completions" in item and "instruction" in item:
                # UltraFeedback format: multiple model responses per prompt
                instruction = item["instruction"]
                for comp in item.get("completions", []):
                    model = comp.get("model", "unknown_llm")
                    text = comp.get("response", "").strip()
                    if len(text.split()) >= 40: # filter short snippets
                        samples.append({
                            "prompt": instruction,
                            "model": model,
                            "response": text
                        })
                        if len(samples) >= target_count:
                            break
            elif "conversation_a" in item and "conversation_b" in item:
                # Chatbot arena format
                for key, model_key in [("conversation_a", "model_a"), ("conversation_b", "model_b")]:
                    conv = item.get(key, [])
                    model = item.get(model_key, "unknown_llm")
                    if conv:
                        # Extract assistant response
                        assistant_msgs = [m.get("content", "") for m in conv if m.get("role") == "assistant"]
                        prompt_msgs = [m.get("content", "") for m in conv if m.get("role") == "user"]
                        prompt = prompt_msgs[0] if prompt_msgs else ""
                        for text in assistant_msgs:
                            if len(text.split()) >= 40:
                                samples.append({
                                    "prompt": prompt,
                                    "model": model,
                                    "response": text
                                })
                                if len(samples) >= target_count:
                                    break
            if len(samples) >= target_count:
                break
    except Exception as e:
        print(f"Error streaming from {dataset_name}: {e}")
        if dataset_name != "openbmb/UltraFeedback":
            print("Falling back to open dataset 'openbmb/UltraFeedback'...")
            return load_llm_samples("openbmb/UltraFeedback", target_count=target_count)
        else:
            raise e

    return samples

def run_llm_benchmark(
    model_name: str = "gemma4:12b",
    dataset_name: str = "lmsys/chatbot_arena_conversations",
    gamma: float = 0.25,
    hash_key: int = 89173511,
    output_path: str = "server/data/llm_benchmark_results.json",
    limit: int = 500
):
    print(f"=== Starting Unwatermarked LLM Benchmark ===")
    print(f"Detector Model: {model_name}")
    print(f"Watermark Config: gamma={gamma}, hash_key={hash_key}, context_width=1")
    print(f"Target Samples: {limit}")

    # 1. Load Model & Tokenizer
    mm = ModelManager()
    print(f"Loading detector model '{model_name}'...")
    mm.load_model(model_name)
    llm = mm.current_model
    vocab_size = llm.n_vocab()
    print(f"Detector model loaded. Vocab size: {vocab_size}")

    config = WatermarkConfig(
        gamma=gamma,
        delta=3.0,
        hash_key=hash_key,
        context_width=1
    )

    # 2. Fetch unwatermarked LLM samples
    samples = load_llm_samples(dataset_name, target_count=limit)
    print(f"Successfully collected {len(samples)} LLM completions for evaluation.")

    # 3. Process LLM responses
    doc_results = []
    model_stats = {}
    z_scores_list = []
    green_fractions_list = []
    
    t_start = time.time()
    
    for idx, sample in enumerate(samples, 1):
        gen_model = sample["model"]
        text = sample["response"]
        prompt = sample["prompt"]
        
        tokens = llm.tokenize(text.encode('utf-8'), add_bos=False)
        
        detection = detect_watermark(
            tokens=tokens,
            tokenizer_decode_fn=mm.decode_tokens,
            vocab_size=vocab_size,
            config=config,
            z_threshold=3.0
        )
        
        item_info = {
            "id": f"llm_{idx:04d}",
            "filename": f"sample_{idx:04d}",
            "generating_model": gen_model,
            "category": gen_model,
            "prompt": prompt[:200] + ("..." if len(prompt) > 200 else ""),
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
            "preview": text[:280] + ("..." if len(text) > 280 else "")
        }
        doc_results.append(item_info)
        z_scores_list.append(detection.z_score)
        green_fractions_list.append(detection.green_fraction)
        
        # Model breakdown
        if gen_model not in model_stats:
            model_stats[gen_model] = {
                "count": 0,
                "total_tokens": 0,
                "z_scores": [],
                "green_fractions": [],
                "false_positives_z3": 0
            }
        model_stats[gen_model]["count"] += 1
        model_stats[gen_model]["total_tokens"] += detection.evaluated_tokens
        model_stats[gen_model]["z_scores"].append(detection.z_score)
        model_stats[gen_model]["green_fractions"].append(detection.green_fraction)
        if detection.z_score >= 3.0:
            model_stats[gen_model]["false_positives_z3"] += 1

        if idx % 25 == 0 or idx == len(samples):
            elapsed = time.time() - t_start
            current_mean_z = np.mean(z_scores_list)
            current_mean_green = np.mean(green_fractions_list) * 100
            fp_count_z3 = sum(1 for z in z_scores_list if z >= 3.0)
            print(
                f"[{idx}/{len(samples)}] ({elapsed:.1f}s) "
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

    # Compute Histogram Distribution of Z-scores
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

    # Summary per generating model
    model_summary = []
    for m_name, mdata in model_stats.items():
        model_summary.append({
            "category": m_name,
            "generating_model": m_name,
            "doc_count": mdata["count"],
            "total_tokens": mdata["total_tokens"],
            "mean_z_score": round(float(np.mean(mdata["z_scores"])), 3),
            "std_z_score": round(float(np.std(mdata["z_scores"])), 3),
            "mean_green_fraction": round(float(np.mean(mdata["green_fractions"])), 4),
            "false_positives_z3": mdata["false_positives_z3"],
            "false_positive_rate_z3": round(mdata["false_positives_z3"] / mdata["count"], 4)
        })
    model_summary.sort(key=lambda m: -m["doc_count"])

    benchmark_dataset = {
        "metadata": {
            "dataset_name": dataset_name,
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
                "theoretical_fpr": 0.02275,
                "empirical_false_positives": fp_z2,
                "empirical_fpr": round(fp_z2 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z2 / total_docs) * 100, 2)
            },
            "threshold_z3": {
                "threshold": 3.0,
                "theoretical_fpr": 0.00135,
                "empirical_false_positives": fp_z3,
                "empirical_fpr": round(fp_z3 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z3 / total_docs) * 100, 2)
            },
            "threshold_z4": {
                "threshold": 4.0,
                "theoretical_fpr": 0.00003,
                "empirical_false_positives": fp_z4,
                "empirical_fpr": round(fp_z4 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z4 / total_docs) * 100, 2)
            },
            "threshold_z5": {
                "threshold": 5.0,
                "theoretical_fpr": 0.0000003,
                "empirical_false_positives": fp_z5,
                "empirical_fpr": round(fp_z5 / total_docs, 4),
                "empirical_fpr_percent": round((fp_z5 / total_docs) * 100, 2)
            }
        },
        "histogram": histogram,
        "category_summary": model_summary,
        "documents": doc_results
    }

    # Ensure output directory exists and write
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(benchmark_dataset, f, indent=2)
        
    print(f"\n=== LLM Benchmark Complete! ===")
    print(f"Results saved to: {output_path}")
    print(f"Total completions evaluated: {total_docs}")
    print(f"Mean Z-Score: {benchmark_dataset['aggregate_metrics']['mean_z_score']} (Expected ~0.0)")
    print(f"Mean Green Fraction: {benchmark_dataset['aggregate_metrics']['mean_green_fraction']*100:.2f}% (Expected {gamma*100:.1f}%)")
    print(f"False Positives at z >= 3.0: {fp_z3}/{total_docs} ({fp_z3/total_docs*100:.2f}%)")
    return benchmark_dataset

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark Unwatermarked LLM texts against watermark detector")
    parser.add_argument("--model", type=str, default="gemma4:12b", help="Detector model name (e.g. gemma4:12b)")
    parser.add_argument("--dataset", type=str, default="lmsys/chatbot_arena_conversations", help="HF dataset name")
    parser.add_argument("--gamma", type=float, default=0.25, help="Green fraction gamma (default: 0.25)")
    parser.add_argument("--hash-key", type=int, default=89173511, help="Secret prime hash key (default: 89173511)")
    parser.add_argument("--output", type=str, default="server/data/llm_benchmark_results.json", help="Output JSON path")
    parser.add_argument("--limit", type=int, default=500, help="Number of samples to evaluate (default: 500)")
    args = parser.parse_args()

    run_llm_benchmark(
        model_name=args.model,
        dataset_name=args.dataset,
        gamma=args.gamma,
        hash_key=args.hash_key,
        output_path=args.output,
        limit=args.limit
    )
