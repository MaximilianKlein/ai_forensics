from typing import List
from .models import DetectGPTPreset

PRESET_CASES: List[DetectGPTPreset] = [
    DetectGPTPreset(
        id="detectgpt_ai_quantum",
        title="Quantum Superposition (AI Generated - GPT-4)",
        category="ai_generated",
        model_or_source="GPT-4 completion with elevated fluency and smooth logit peaks",
        text=(
            "Quantum superposition is a fundamental principle of quantum mechanics that allows physical systems to exist "
            "in multiple distinct states simultaneously. Unlike classical bits in conventional computing, which must strictly "
            "represent either a zero or a one, quantum bits can represent arbitrary linear combinations of both basis states. "
            "This unique property enables quantum algorithms to process complex computational spaces with exponential efficiency."
        ),
        expected_verdict="Likely AI-Generated (Strong Negative Curvature / High Discrepancy)"
    ),
    DetectGPTPreset(
        id="detectgpt_ai_essay",
        title="Urban Renewal & Heritage (AI Generated - Claude/Llama)",
        category="ai_generated",
        model_or_source="Llama 3 generation with formulaic transition peaks",
        text=(
            "The revitalisation of historical urban districts serves as a powerful testament to the delicate interplay between architectural "
            "heritage and contemporary innovation. By fostering sustainable infrastructure while meticulously preserving cultural monuments, "
            "modern municipal planners are setting the stage for vibrant communities that resonate across generations."
        ),
        expected_verdict="Likely AI-Generated (Strong Negative Curvature / High Discrepancy)"
    ),
    DetectGPTPreset(
        id="detectgpt_human_darwin",
        title="On the Origin of Species (Human Written - Charles Darwin)",
        category="human_written",
        model_or_source="Charles Darwin (1859), natural non-peaked human prose",
        text=(
            "When on board H.M.S. Beagle, as naturalist, I was much struck with certain facts in the distribution of the organic beings "
            "inhabiting South America, and in the geological relations of the present to the past inhabitants of that continent. These facts "
            "seemed to me to throw some light on the origin of species—that mystery of mysteries, as it has been called by one of our greatest philosophers."
        ),
        expected_verdict="Likely Human-Written (Flat Probability Landscape / Low Discrepancy)"
    ),
    DetectGPTPreset(
        id="detectgpt_human_wiki",
        title="Hubble Space Telescope (Human Written - Wikipedia)",
        category="human_written",
        model_or_source="Wikipedia neutral encyclopedic prose",
        text=(
            "The Hubble Space Telescope was launched into low Earth orbit in 1990 and remains in operation. Although not the first space telescope, "
            "Hubble is one of the largest and most versatile, renowned both as a vital research tool and as a public relations boon for astronomy."
        ),
        expected_verdict="Likely Human-Written (Low Discrepancy)"
    )
]

def get_detect_gpt_presets() -> List[DetectGPTPreset]:
    return PRESET_CASES
