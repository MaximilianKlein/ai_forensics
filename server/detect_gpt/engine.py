import math
import numpy as np
from typing import List, Optional, Any
from .models import (
    PerturbationItem,
    CurvaturePoint,
    HistogramBin,
    DetectGPTResult
)
from .perturbation import generate_perturbations
from .evaluator import compute_text_log_prob

def run_detect_gpt(
    text: str,
    num_perturbations: int = 10,
    perturbation_pct: float = 0.15,
    model: Optional[Any] = None
) -> DetectGPTResult:
    """
    Executes the DetectGPT probability curvature algorithm (Mitchell et al., ICML 2023).
    1. Evaluates log-likelihood of original text log p(x).
    2. Generates k perturbed versions x_tilde_1, ..., x_tilde_k.
    3. Evaluates log-likelihood for all perturbations log p(x_tilde_i).
    4. Computes discrepancy d(x) = log p(x) - mean(log p(x_tilde)) and z-score d(x) / std.
    """
    if not text or not text.strip():
        return DetectGPTResult(
            original_text="",
            num_tokens=0,
            original_log_prob=0.0,
            original_avg_log_prob=0.0,
            original_perplexity=1.0,
            num_perturbations=0,
            perturbation_pct=perturbation_pct,
            perturbations=[],
            mean_perturbed_log_prob=0.0,
            std_perturbed_log_prob=0.0,
            mean_perturbed_perplexity=1.0,
            discrepancy_score=0.0,
            z_score=0.0,
            normalized_discrepancy=0.0,
            verdict="likely_human",
            confidence_pct=0.0,
            summary="No text provided for DetectGPT analysis.",
            curve_points=[],
            histogram=[]
        )

    # 1. Evaluate original text log-likelihood
    orig_log_prob, orig_avg_log_prob, orig_ppl, num_tokens = compute_text_log_prob(text, model)

    # 2. Generate k perturbations
    k = max(3, min(30, num_perturbations))
    pct = max(0.05, min(0.40, perturbation_pct))
    raw_perturbations = generate_perturbations(text, k=k, perturbation_pct=pct)

    # 3. Evaluate each perturbation
    pert_items: List[PerturbationItem] = []
    pert_log_probs: List[float] = []
    pert_ppls: List[float] = []

    for i, (pert_text, muts) in enumerate(raw_perturbations):
        p_log_prob, p_avg_log_prob, p_ppl, _ = compute_text_log_prob(pert_text, model)
        delta = round(orig_log_prob - p_log_prob, 2)
        
        pert_items.append(PerturbationItem(
            id=i + 1,
            text=pert_text,
            log_prob=p_log_prob,
            avg_token_log_prob=p_avg_log_prob,
            perplexity=p_ppl,
            diff_count=len(muts),
            delta_from_original=delta,
            mutated_words=muts
        ))
        pert_log_probs.append(p_log_prob)
        pert_ppls.append(p_ppl)

    # 4. Compute probability curvature metrics
    mean_pert_log_prob = float(np.mean(pert_log_probs))
    std_pert_log_prob = float(np.std(pert_log_probs, ddof=1)) if len(pert_log_probs) > 1 else 1.0
    # Guard against zero division
    effective_std = max(0.05, std_pert_log_prob)
    
    mean_pert_ppl = float(np.mean(pert_ppls))
    discrepancy = float(orig_log_prob - mean_pert_log_prob)
    z_score = float(discrepancy / effective_std)
    norm_discrepancy = float(discrepancy / max(1, num_tokens))

    # 5. Determine Verdict and Confidence
    # Machine text consistently produces positive discrepancy (z > 1.6)
    if z_score >= 1.75:
        verdict = "likely_ai"
        confidence_pct = min(99.0, max(60.0, 50.0 + z_score * 18.0))
        summary = (
            f"Strong Probability Curvature (z = {z_score:.2f}, Δ = +{discrepancy:.2f}): "
            f"The original text occupies a sharp local log-probability peak compared to its perturbations. "
            f"This negative curvature is a primary signature of model-generated text."
        )
    elif z_score >= 0.85:
        verdict = "uncertain"
        confidence_pct = 50.0
        summary = (
            f"Moderate Probability Curvature (z = {z_score:.2f}, Δ = +{discrepancy:.2f}): "
            f"Perturbations show a slight log-probability decrease, but within normal variance boundaries."
        )
    else:
        verdict = "likely_human"
        confidence_pct = min(95.0, max(60.0, 70.0 - z_score * 20.0))
        summary = (
            f"Flat / Positive Curvature (z = {z_score:.2f}, Δ = {discrepancy:+.2f}): "
            f"Perturbing the text does not consistently lower the model's log-likelihood. "
            f"The probability landscape is diverse and characteristic of human writing."
        )

    # 6. Build Curve Points for Visual Charting
    curve_points: List[CurvaturePoint] = [
        CurvaturePoint(
            sample_index=0,
            name="Original x",
            log_prob=round(orig_log_prob, 2),
            avg_token_log_prob=round(orig_avg_log_prob, 4),
            is_original=True
        )
    ]
    for item in pert_items:
        curve_points.append(CurvaturePoint(
            sample_index=item.id,
            name=f"Perturbation #{item.id}",
            log_prob=round(item.log_prob, 2),
            avg_token_log_prob=round(item.avg_token_log_prob, 4),
            is_original=False
        ))

    # 7. Histogram distribution
    all_scores = [orig_log_prob] + pert_log_probs
    min_v = min(all_scores) - 1.0
    max_v = max(all_scores) + 1.0
    num_bins = 6
    bin_width = max(0.1, (max_v - min_v) / num_bins)
    
    histogram_bins: List[HistogramBin] = []
    for b in range(num_bins):
        b_start = min_v + b * bin_width
        b_end = b_start + bin_width
        count = sum(1 for p in pert_log_probs if b_start <= p < b_end or (b == num_bins - 1 and b_start <= p <= b_end))
        is_orig = (b_start <= orig_log_prob < b_end) or (b == num_bins - 1 and b_start <= orig_log_prob <= b_end)
        histogram_bins.append(HistogramBin(
            bin_start=round(b_start, 2),
            bin_end=round(b_end, 2),
            count=count,
            is_original_bin=is_orig
        ))

    return DetectGPTResult(
        original_text=text,
        num_tokens=num_tokens,
        original_log_prob=round(orig_log_prob, 2),
        original_avg_log_prob=round(orig_avg_log_prob, 4),
        original_perplexity=round(orig_ppl, 2),
        num_perturbations=len(pert_items),
        perturbation_pct=pct,
        perturbations=pert_items,
        mean_perturbed_log_prob=round(mean_pert_log_prob, 2),
        std_perturbed_log_prob=round(std_pert_log_prob, 2),
        mean_perturbed_perplexity=round(mean_pert_ppl, 2),
        discrepancy_score=round(discrepancy, 2),
        z_score=round(z_score, 2),
        normalized_discrepancy=round(norm_discrepancy, 4),
        verdict=verdict,
        confidence_pct=round(confidence_pct, 1),
        summary=summary,
        curve_points=curve_points,
        histogram=histogram_bins
    )
