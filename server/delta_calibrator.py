import math
import logging
from typing import Dict, Any, Optional
import numpy as np

logger = logging.getLogger(__name__)

# In-memory persistence store for model-specific watermark delta calibrations and prompt suffixes / thinking bypass
# Pre-initialized with empirical measurements and suffixes for standard open models
MODEL_CONFIG_STORE: Dict[str, Dict[str, Any]] = {
    "gemma4:12b": {
        "model_name": "gemma4:12b",
        "recommended_delta": 5.8,
        "prompt_suffix": "\n\n<|channel>\n<channel|>",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "wide",
        "explanation": "Gemma 4 has a 256k vocabulary with wide top-logit spread; δ ≈ 5.5–6.0 is optimal. Thinking bypass suffix (`\\n<|channel>\\n<channel|>\\n`) closes the thought block to start answering immediately."
    },
    "gemma:2b": {
        "model_name": "gemma:2b",
        "recommended_delta": 5.5,
        "prompt_suffix": "\n\n<|channel>\n<channel|>",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "wide",
        "explanation": "Gemma 2B uses logit soft-capping with wide variance; δ ≈ 5.5 is optimal. Thought channel bypass suffix closes reasoning mode."
    },
    "gemma:7b": {
        "model_name": "gemma:7b",
        "recommended_delta": 5.8,
        "prompt_suffix": "\n\n<|channel>\n<channel|>",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "wide",
        "explanation": "Gemma 7B uses logit soft-capping; δ ≈ 5.8 provides crisp watermarking. Thought channel bypass suffix closes reasoning mode."
    },
    "qwen2.5:0.5b": {
        "model_name": "qwen2.5:0.5b",
        "recommended_delta": 2.0,
        "prompt_suffix": "\n",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "narrow",
        "explanation": "Qwen 2.5 has compact logit distributions; δ ≈ 2.0 provides strong green-token biasing without repetitive degradation. Newline suffix ensures clean answer start."
    },
    "qwen2.5:1.5b": {
        "model_name": "qwen2.5:1.5b",
        "recommended_delta": 2.2,
        "prompt_suffix": "\n",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "narrow",
        "explanation": "Qwen 2.5 1.5B has a tight logit range; δ ≈ 2.2 is ideal. Newline suffix ensures clean answer start."
    },
    "qwen2.5:7b": {
        "model_name": "qwen2.5:7b",
        "recommended_delta": 2.5,
        "prompt_suffix": "\n",
        "disable_thinking": True,
        "source": "pre_calibrated",
        "logit_scale": "narrow",
        "explanation": "Qwen 2.5 7B performs well with δ ≈ 2.5. Newline suffix ensures clean answer start."
    }
}

# Backward compatibility alias
MODEL_DELTA_STORE = MODEL_CONFIG_STORE

def get_model_profile(model_name: str) -> Dict[str, Any]:
    """Returns stored or rule-based profile (delta, prompt suffix, thinking bypass) for a given model name."""
    clean = model_name.lower().strip()
    if clean in MODEL_CONFIG_STORE:
        return dict(MODEL_CONFIG_STORE[clean])

    # Fuzzy match on model family
    if "gemma" in clean:
        default_delta = 5.8
        default_suffix = "\n\n<|channel>\n<channel|>"
        explanation = f"Gemma family profile for {model_name}: δ=5.8 with thought channel bypass suffix."
    elif "qwen" in clean:
        default_delta = 2.0
        default_suffix = "\n"
        explanation = f"Qwen family profile for {model_name}: δ=2.0 with newline suffix."
    elif "llama" in clean:
        default_delta = 3.0
        default_suffix = "\n"
        explanation = f"Llama family profile for {model_name}: δ=3.0 with newline suffix."
    elif "mistral" in clean or "mixtral" in clean:
        default_delta = 3.5
        default_suffix = "\n"
        explanation = f"Mistral family profile for {model_name}: δ=3.5 with newline suffix."
    elif "deepseek" in clean:
        default_delta = 2.5
        default_suffix = "\n"
        explanation = f"DeepSeek family profile for {model_name}: δ=2.5 with newline suffix."
    elif "phi" in clean:
        default_delta = 2.8
        default_suffix = "\n"
        explanation = f"Phi family profile for {model_name}: δ=2.8 with newline suffix."
    else:
        default_delta = 3.0
        default_suffix = "\n"
        explanation = f"Universal default profile for {model_name}: δ=3.0 with newline suffix."
    
    entry = {
        "model_name": model_name,
        "recommended_delta": default_delta,
        "prompt_suffix": default_suffix,
        "disable_thinking": True,
        "source": "family_heuristic",
        "explanation": explanation
    }
    MODEL_CONFIG_STORE[clean] = entry
    return dict(entry)

def get_recommended_delta_for_name(model_name: str) -> float:
    """Returns stored or rule-based delta estimate for a given model name."""
    profile = get_model_profile(model_name)
    return float(profile.get("recommended_delta", 3.0))

def get_prompt_suffix_for_model(model_name: str) -> str:
    """Returns stored or rule-based prompt suffix string for a given model."""
    profile = get_model_profile(model_name)
    if profile.get("disable_thinking", True):
        return profile.get("prompt_suffix", "\n")
    return ""

def update_model_profile(
    model_name: str,
    recommended_delta: Optional[float] = None,
    prompt_suffix: Optional[str] = None,
    disable_thinking: Optional[bool] = None
) -> Dict[str, Any]:
    """Updates in-memory model configuration profile."""
    clean = model_name.lower().strip()
    profile = get_model_profile(model_name)
    if recommended_delta is not None:
        profile["recommended_delta"] = round(float(recommended_delta), 2)
    if prompt_suffix is not None:
        profile["prompt_suffix"] = prompt_suffix
    if disable_thinking is not None:
        profile["disable_thinking"] = bool(disable_thinking)
    profile["source"] = "user_configured"
    MODEL_CONFIG_STORE[clean] = profile
    return dict(profile)

def normalize_suffix(suffix: Optional[str]) -> str:
    if not suffix:
        return ""
    # If user typed or sent literal "\n" in JSON strings or text inputs, unescape to actual newline characters
    return suffix.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t")

def format_prompt_for_model(
    prompt: str,
    model_name: Optional[str] = None,
    override_suffix: Optional[str] = None,
    disable_thinking: Optional[bool] = None
) -> str:
    """
    Appends model-specific thinking bypass or newline suffix to ensure the model
    immediately produces the answer without thinking tokens or continuing the prompt.
    """
    if override_suffix is not None:
        raw_suffix = override_suffix
    elif model_name:
        profile = get_model_profile(model_name)
        if disable_thinking is False or (disable_thinking is None and not profile.get("disable_thinking", True)):
            raw_suffix = ""
        else:
            raw_suffix = profile.get("prompt_suffix", "\n")
    else:
        raw_suffix = "\n"

    suffix = normalize_suffix(raw_suffix)

    if not suffix:
        return prompt

    # Normalize newlines: if suffix starts with newline and prompt ends with newline, avoid duplicate newlines
    if suffix.startswith("\n") and prompt.endswith("\n"):
        suffix_to_add = suffix[1:]
    else:
        suffix_to_add = suffix

    if not prompt.endswith(suffix_to_add):
        return prompt + suffix_to_add
    return prompt

def calibrate_model_delta(
    model_name: str,
    model_instance: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Profiles model logits dynamically or retrieves stored delta calibration.
    Computes top-k logit dispersion gap (Δ_1-5 and Δ_1-2) to estimate optimal δ.
    """
    clean_name = model_name.lower().strip()
    current_profile = get_model_profile(model_name)
    
    # 1. If model is actively loaded in memory, sample live logits
    if model_instance is not None:
        try:
            calibration_prompt = "The development of artificial intelligence has revolutionized modern scientific inquiry."
            tokens = model_instance.tokenize(calibration_prompt.encode("utf-8"))
            if len(tokens) > 2:
                model_instance.reset()
                model_instance.eval(tokens[:min(16, len(tokens))])
                
                # Extract logits from last token
                logits = np.array(model_instance.scores[-1], dtype=np.float64)
                sorted_logits = np.sort(logits)[::-1]
                
                top_gap_1_2 = float(sorted_logits[0] - sorted_logits[1])
                top_gap_1_5 = float(sorted_logits[0] - sorted_logits[4])
                top_50_std = float(np.std(sorted_logits[:50]))
                
                # Empirical calibration formula: promote competitive green tokens without overwhelming top choice
                computed_delta = round(float(np.clip(0.6 * top_gap_1_5 + 0.8 * top_gap_1_2, 1.5, 8.5)), 1)
                
                res = {
                    "model_name": model_name,
                    "recommended_delta": computed_delta,
                    "prompt_suffix": current_profile.get("prompt_suffix", "\n"),
                    "disable_thinking": current_profile.get("disable_thinking", True),
                    "source": "live_logit_profiling",
                    "top_gap_1_2": round(top_gap_1_2, 2),
                    "top_gap_1_5": round(top_gap_1_5, 2),
                    "top_50_std": round(top_50_std, 2),
                    "explanation": (
                        f"Live logit profiling measured top-5 dispersion gap of {round(top_gap_1_5, 2)} and std of {round(top_50_std, 2)}. "
                        f"Optimal logit bias δ = {computed_delta}."
                    )
                }
                MODEL_CONFIG_STORE[clean_name] = res
                return res
        except Exception as e:
            logger.warning(f"Live logit profiling failed: {e}. Falling back to rule-based calibration.", exc_info=True)

    # 2. Check in-memory store or rule-based fallback
    return current_profile

def get_all_calibrated_deltas() -> Dict[str, Dict[str, Any]]:
    """Returns all stored model calibration and profile entries."""
    return dict(MODEL_CONFIG_STORE)
