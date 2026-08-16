import math
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
from scipy.stats import norm

class WatermarkConfig(BaseModel):
    gamma: float = 0.25         # Fraction of vocab that is green (e.g. 0.25 = 25%)
    delta: float = 2.0          # Watermark strength (logit bias added to green tokens)
    hash_key: int = 15485863    # Secret prime/seed key
    context_width: int = 1      # Number of previous tokens used for pseudo-random hash context (h=1 default)

class TokenWatermarkInfo(BaseModel):
    token_id: int
    token_str: str
    is_green: bool
    is_prompt: bool = False
    context_tokens: List[int] = []

class DetectionResult(BaseModel):
    total_tokens: int
    evaluated_tokens: int
    green_tokens: int
    red_tokens: int
    green_fraction: float
    expected_fraction: float
    z_score: float
    p_value: float
    is_watermarked: bool
    confidence_level: str
    tokens: List[Dict[str, Any]]
    summary: str

def compute_hash_seed(context_tokens: List[int], hash_key: int) -> int:
    """
    Computes a deterministic 32-bit integer seed from previous context tokens and hash_key.
    Uses rolling polynomial hash for h >= 1.
    """
    if not context_tokens:
        return hash_key % (2**32 - 1)
    
    val = hash_key
    for tok in context_tokens:
        val = (val * 31337 + tok) % (2**32 - 1)
    return int(val)

def get_green_list(vocab_size: int, context_tokens: List[int], gamma: float, hash_key: int) -> set:
    """
    Deterministically partitions the vocabulary into a green list.
    """
    seed = compute_hash_seed(context_tokens, hash_key)
    rng = np.random.RandomState(seed)
    permutation = rng.permutation(vocab_size)
    green_size = int(vocab_size * gamma)
    return set(permutation[:green_size].tolist())

class WatermarkLogitsProcessor:
    """
    Kirchenbauer et al. Watermark Logits Processor for llama-cpp-python.
    Intercepts logits before sampling and boosts green-list tokens by delta.
    """
    def __init__(self, vocab_size: int, config: WatermarkConfig):
        self.vocab_size = vocab_size
        self.config = config
        self.last_green_list: set = set()

    def __call__(self, input_ids: Any, logits: np.ndarray) -> np.ndarray:
        if input_ids is None or len(input_ids) == 0 or self.config.delta <= 0.0:
            return logits

        # Extract context tokens
        h = max(1, self.config.context_width)
        if isinstance(input_ids, np.ndarray):
            ctx = input_ids[-h:].tolist()
        else:
            ctx = list(input_ids[-h:])

        # Generate green list
        seed = compute_hash_seed(ctx, self.config.hash_key)
        rng = np.random.RandomState(seed)
        vocab_permutation = rng.permutation(self.vocab_size)
        green_list_size = int(self.vocab_size * self.config.gamma)
        green_list = vocab_permutation[:green_list_size]
        self.last_green_list = set(green_list.tolist())

        # Apply logit boost
        logits[green_list] += self.config.delta
        return logits


def detect_watermark(
    tokens: List[int],
    tokenizer_decode_fn,
    vocab_size: int,
    config: WatermarkConfig,
    z_threshold: float = 3.0
) -> DetectionResult:
    """
    Analyzes token sequence for statistical presence of the watermark.
    """
    h = max(1, config.context_width)
    total_tokens = len(tokens)
    
    if total_tokens <= h:
        return DetectionResult(
            total_tokens=total_tokens,
            evaluated_tokens=0,
            green_tokens=0,
            red_tokens=0,
            green_fraction=0.0,
            expected_fraction=config.gamma,
            z_score=0.0,
            p_value=1.0,
            is_watermarked=False,
            confidence_level="Insufficient Tokens",
            tokens=[{"id": tok, "text": tokenizer_decode_fn([tok]), "is_green": False, "is_prompt": True} for tok in tokens],
            summary="Text is too short to analyze for watermark (< 2 tokens)."
        )

    evaluated_tokens = 0
    green_tokens = 0
    token_details = []

    # First h tokens are context (cannot be evaluated)
    for i in range(min(h, total_tokens)):
        tok = tokens[i]
        token_details.append({
            "id": tok,
            "text": tokenizer_decode_fn([tok]),
            "is_green": None,
            "is_evaluated": False,
            "position": i
        })

    # Evaluate each subsequent token
    for i in range(h, total_tokens):
        ctx = tokens[i-h:i]
        current_token = tokens[i]
        green_set = get_green_list(vocab_size, ctx, config.gamma, config.hash_key)
        
        is_green = current_token in green_set
        evaluated_tokens += 1
        if is_green:
            green_tokens += 1

        token_details.append({
            "id": current_token,
            "text": tokenizer_decode_fn([current_token]),
            "is_green": is_green,
            "is_evaluated": True,
            "position": i
        })

    red_tokens = evaluated_tokens - green_tokens
    actual_fraction = green_tokens / evaluated_tokens if evaluated_tokens > 0 else 0.0
    gamma = config.gamma

    # Compute Z-Score: z = (N_green - gamma * N) / sqrt(N * gamma * (1 - gamma))
    if evaluated_tokens > 0:
        std_dev = math.sqrt(evaluated_tokens * gamma * (1.0 - gamma))
        expected_green = evaluated_tokens * gamma
        z_score = (green_tokens - expected_green) / std_dev if std_dev > 0 else 0.0
        # One-tailed p-value
        p_value = 1.0 - float(norm.cdf(z_score))
    else:
        z_score = 0.0
        p_value = 1.0

    is_watermarked = z_score >= z_threshold

    if z_score >= 5.0:
        confidence = "Extremely High (p < 0.000001)"
        verdict_text = "Definitively Watermarked AI Text"
    elif z_score >= 4.0:
        confidence = "Very High (p < 0.0001)"
        verdict_text = "Strongly Watermarked AI Text"
    elif z_score >= 3.0:
        confidence = "High (p < 0.001)"
        verdict_text = "Watermarked AI Text"
    elif z_score >= 2.0:
        confidence = "Moderate / Suspicious"
        verdict_text = "Possible Watermark / Mixed Text"
    else:
        confidence = "Low / Neutral"
        verdict_text = "Unwatermarked Text (Human or Standard AI)"

    summary = (
        f"Analyzed {evaluated_tokens} token transitions: {green_tokens} green tokens "
        f"({actual_fraction * 100:.1f}%), expected ~{gamma * 100:.1f}%. "
        f"Z-Score: {z_score:.2f} (p-value: {p_value:.3e}). Verdict: {verdict_text}."
    )

    return DetectionResult(
        total_tokens=total_tokens,
        evaluated_tokens=evaluated_tokens,
        green_tokens=green_tokens,
        red_tokens=red_tokens,
        green_fraction=round(actual_fraction, 4),
        expected_fraction=gamma,
        z_score=round(z_score, 3),
        p_value=p_value,
        is_watermarked=is_watermarked,
        confidence_level=confidence,
        tokens=token_details,
        summary=summary
    )
