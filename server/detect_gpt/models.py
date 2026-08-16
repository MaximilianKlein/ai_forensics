from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class PerturbationItem(BaseModel):
    id: int
    text: str
    log_prob: float
    avg_token_log_prob: float
    perplexity: float
    diff_count: int
    delta_from_original: float  # log_prob(original) - log_prob(perturbed)
    mutated_words: List[Dict[str, str]] = []  # [{"original": w1, "replacement": w2}]

class CurvaturePoint(BaseModel):
    sample_index: int
    name: str
    log_prob: float
    avg_token_log_prob: float
    is_original: bool = False

class HistogramBin(BaseModel):
    bin_start: float
    bin_end: float
    count: int
    is_original_bin: bool = False

class DetectGPTResult(BaseModel):
    original_text: str
    num_tokens: int
    original_log_prob: float
    original_avg_log_prob: float
    original_perplexity: float
    
    num_perturbations: int
    perturbation_pct: float
    perturbations: List[PerturbationItem] = []
    
    mean_perturbed_log_prob: float
    std_perturbed_log_prob: float
    mean_perturbed_perplexity: float
    
    # Core DetectGPT Metrics
    discrepancy_score: float         # log_p(x) - mean(log_p(x_tilde))
    z_score: float                   # discrepancy / std(log_p(x_tilde))
    normalized_discrepancy: float    # discrepancy / num_tokens
    
    verdict: Literal["likely_ai", "uncertain", "likely_human"]
    confidence_pct: float            # 0 to 100
    summary: str
    
    curve_points: List[CurvaturePoint] = []
    histogram: List[HistogramBin] = []

class DetectGPTPreset(BaseModel):
    id: str
    title: str
    category: Literal["ai_generated", "human_written"]
    model_or_source: str
    text: str
    expected_verdict: str
