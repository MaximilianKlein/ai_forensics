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
from server.watermark import WatermarkConfig, WatermarkLogitsProcessor, detect_watermark
from llama_cpp import LogitsProcessorList

def load_prompts_from_dataset(target_count: int = 50):
    from datasets import load_dataset
    print(f"Loading {target_count} unique prompts from openbmb/UltraFeedback...")
    prompts = []
    ds = load_dataset("openbmb/UltraFeedback", split="train", streaming=True)
    for item in ds:
        inst = item.get("instruction", "").strip()
        if len(inst) > 20 and len(inst.split()) < 80:
            prompts.append(inst)
            if len(prompts) >= target_count:
                break
    return prompts

def run_watermarked_generation_benchmark(
    model_name: str = "gemma4:12b",
    gamma: float = 0.25,
    delta: float = 5.0,
    hash_key: int = 89173511,
    max_tokens: int = 150,
    temperature: float = 0.85,
    target_count: int = 50,
    output_path: str = "server/data/watermarked_eval_results.json"
):
    print(f"=== Starting Empirical Watermarked Generation Benchmark ===")
    print(f"Model: {model_name}")
    print(f"Watermark Config: gamma={gamma}, delta={delta}, hash_key={hash_key}, context_width=1")
    print(f"Generating {target_count} paired samples (Watermarked vs Unwatermarked)...")

    # 1. Load Model
    mm = ModelManager()
    print(f"Loading {model_name}...")
    mm.load_model(model_name)
    llm = mm.current_model
    vocab_size = llm.n_vocab()
    print(f"Model loaded. Vocab size: {vocab_size}")

    wm_config = WatermarkConfig(
        gamma=gamma,
        delta=delta,
        hash_key=hash_key,
        context_width=1
    )

    prompts = load_prompts_from_dataset(target_count=target_count)
    print(f"Loaded {len(prompts)} prompts. Generating completions now...")

    results = []
    t_start = time.time()

    for idx, prompt in enumerate(prompts, 1):
        t0 = time.time()
        
        # 1. Generate Watermarked Completion
        wm_processor = WatermarkLogitsProcessor(vocab_size=vocab_size, config=wm_config)
        wm_output = llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            logits_processor=LogitsProcessorList([wm_processor])
        )
        wm_text = wm_output["choices"][0]["text"].strip()
        wm_tokens = llm.tokenize(wm_text.encode('utf-8'), add_bos=False)
        wm_stats = detect_watermark(
            wm_tokens,
            tokenizer_decode_fn=mm.decode_tokens,
            vocab_size=vocab_size,
            config=wm_config,
            z_threshold=3.0
        )

        # 2. Generate Unwatermarked Completion (for comparison)
        un_output = llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            logits_processor=LogitsProcessorList([])
        )
        un_text = un_output["choices"][0]["text"].strip()
        un_tokens = llm.tokenize(un_text.encode('utf-8'), add_bos=False)
        un_stats = detect_watermark(
            un_tokens,
            tokenizer_decode_fn=mm.decode_tokens,
            vocab_size=vocab_size,
            config=wm_config,
            z_threshold=3.0
        )

        sample_item = {
            "id": f"eval_{idx:03d}",
            "prompt": prompt,
            "watermarked": {
                "text": wm_text,
                "total_tokens": wm_stats.total_tokens,
                "evaluated_tokens": wm_stats.evaluated_tokens,
                "green_tokens": wm_stats.green_tokens,
                "red_tokens": wm_stats.red_tokens,
                "green_fraction": round(wm_stats.green_fraction, 4),
                "z_score": round(wm_stats.z_score, 3),
                "p_value": wm_stats.p_value,
                "is_detected_z3": wm_stats.z_score >= 3.0,
                "is_detected_z4": wm_stats.z_score >= 4.0,
                "is_detected_z5": wm_stats.z_score >= 5.0
            },
            "unwatermarked": {
                "text": un_text,
                "total_tokens": un_stats.total_tokens,
                "evaluated_tokens": un_stats.evaluated_tokens,
                "green_tokens": un_stats.green_tokens,
                "red_tokens": un_stats.red_tokens,
                "green_fraction": round(un_stats.green_fraction, 4),
                "z_score": round(un_stats.z_score, 3),
                "p_value": un_stats.p_value,
                "is_detected_z3": un_stats.z_score >= 3.0,
                "is_detected_z4": un_stats.z_score >= 4.0,
                "is_detected_z5": un_stats.z_score >= 5.0
            }
        }
        results.append(sample_item)
        
        # Save incrementally
        interim_data = {
            "metadata": {
                "model_name": model_name,
                "watermark_config": {
                    "gamma": gamma,
                    "delta": delta,
                    "hash_key": hash_key,
                    "context_width": 1
                },
                "total_prompts": len(results),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "samples": results
        }
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(interim_data, f, indent=2)

        elapsed_sample = time.time() - t0
        print(
            f"[{idx}/{len(prompts)}] ({elapsed_sample:.1f}s) "
            f"WM: Z={wm_stats.z_score:.2f} (Green {wm_stats.green_fraction*100:.1f}%) | "
            f"Unwatermarked: Z={un_stats.z_score:.2f} (Green {un_stats.green_fraction*100:.1f}%)"
        )

    # 4. Final Aggregates
    wm_z_scores = [r["watermarked"]["z_score"] for r in results]
    wm_green_fracs = [r["watermarked"]["green_fraction"] for r in results]
    un_z_scores = [r["unwatermarked"]["z_score"] for r in results]
    un_green_fracs = [r["unwatermarked"]["green_fraction"] for r in results]

    tpr_z3 = sum(1 for z in wm_z_scores if z >= 3.0) / len(results)
    tpr_z4 = sum(1 for z in wm_z_scores if z >= 4.0) / len(results)
    tpr_z5 = sum(1 for z in wm_z_scores if z >= 5.0) / len(results)

    final_dataset = {
        "metadata": {
            "model_name": model_name,
            "watermark_config": {
                "gamma": gamma,
                "delta": delta,
                "hash_key": hash_key,
                "context_width": 1
            },
            "total_prompts": len(results),
            "execution_time_seconds": round(time.time() - t_start, 2),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        },
        "aggregate_comparison": {
            "watermarked": {
                "mean_z_score": round(float(np.mean(wm_z_scores)), 3),
                "median_z_score": round(float(np.median(wm_z_scores)), 3),
                "std_z_score": round(float(np.std(wm_z_scores)), 3),
                "mean_green_fraction": round(float(np.mean(wm_green_fracs)), 4),
                "true_positive_rate_z3": round(tpr_z3, 4),
                "true_positive_rate_z4": round(tpr_z4, 4),
                "true_positive_rate_z5": round(tpr_z5, 4)
            },
            "unwatermarked": {
                "mean_z_score": round(float(np.mean(un_z_scores)), 3),
                "median_z_score": round(float(np.median(un_z_scores)), 3),
                "std_z_score": round(float(np.std(un_z_scores)), 3),
                "mean_green_fraction": round(float(np.mean(un_green_fracs)), 4),
                "false_positive_rate_z3": round(sum(1 for z in un_z_scores if z >= 3.0) / len(results), 4),
                "false_positive_rate_z4": round(sum(1 for z in un_z_scores if z >= 4.0) / len(results), 4),
                "false_positive_rate_z5": round(sum(1 for z in un_z_scores if z >= 5.0) / len(results), 4)
            }
        },
        "samples": results
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_dataset, f, indent=2)

    print(f"\n=== Benchmark Complete! ===")
    print(f"Results saved to: {output_path}")
    print(f"Watermarked Mean Z: {final_dataset['aggregate_comparison']['watermarked']['mean_z_score']} | Green: {final_dataset['aggregate_comparison']['watermarked']['mean_green_fraction']*100:.1f}%")
    print(f"Unwatermarked Mean Z: {final_dataset['aggregate_comparison']['unwatermarked']['mean_z_score']} | Green: {final_dataset['aggregate_comparison']['unwatermarked']['mean_green_fraction']*100:.1f}%")
    print(f"True Positive Rate at z >= 4.0: {tpr_z4*100:.1f}%")
    return final_dataset

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and evaluate empirical watermarked completions")
    parser.add_argument("--model", type=str, default="gemma4:12b", help="Model name")
    parser.add_argument("--gamma", type=float, default=0.25, help="Gamma")
    parser.add_argument("--delta", type=float, default=5.0, help="Delta logit bias")
    parser.add_argument("--hash-key", type=int, default=89173511, help="Hash key")
    parser.add_argument("--count", type=int, default=30, help="Number of prompts to evaluate")
    parser.add_argument("--max-tokens", type=int, default=120, help="Max tokens per completion")
    parser.add_argument("--output", type=str, default="server/data/watermarked_eval_results.json", help="Output path")
    args = parser.parse_args()

    run_watermarked_generation_benchmark(
        model_name=args.model,
        gamma=args.gamma,
        delta=args.delta,
        hash_key=args.hash_key,
        max_tokens=args.max_tokens,
        target_count=args.count,
        output_path=args.output
    )
