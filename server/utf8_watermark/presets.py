from typing import List
from .models import UTF8Preset
from .codec import embed_invisible_watermark

def build_presets() -> List[UTF8Preset]:
    base_text_1 = (
        "The Apollo 11 mission was the first spaceflight that landed humans on the Moon. "
        "Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969. "
        "Armstrong became the first person to step onto the lunar surface six hours and 39 minutes later."
    )
    res_1 = embed_invisible_watermark(base_text_1, payload="Model: Gemma-4 | License: CreativeCommons | Sign: SHA256-OK")
    
    # Tampered version: replace "Apollo 11" with "Apollo 13" and "July 20" with "August 15"
    # Note: the zero-width tags remain embedded in the text, so the verifier will detect the hash mismatches in those exact blocks!
    tampered_text_1 = res_1.watermarked_text.replace("Apollo 11", "Apollo 13").replace("July 20", "August 15")

    base_text_2 = (
        "Quantum entanglement occurs when pairs or groups of particles interact in ways such that the quantum state "
        "of each particle cannot be described independently of the state of the others, even when the particles are "
        "separated by a large distance."
    )
    res_2 = embed_invisible_watermark(base_text_2, payload="Author: Dr. Quantum | Provenance: Certified Authentic")

    return [
        UTF8Preset(
            id="preset_intact_apollo",
            title="Apollo 11 Moon Landing (Authentic Watermarked)",
            description="Clean watermarked text with embedded provenance metadata and block parity checksums.",
            watermarked_text=res_1.watermarked_text,
            payload=res_1.payload,
            is_tampered=False,
            tamper_description=None
        ),
        UTF8Preset(
            id="preset_tampered_apollo",
            title="Apollo 11 Mission (Tampered: Dates & Numbers Modified)",
            description="Demonstrates fine-grained block-based tamper localization: 'Apollo 11' edited to 'Apollo 13' and 'July 20' to 'August 15'.",
            watermarked_text=tampered_text_1,
            payload=res_1.payload,
            is_tampered=True,
            tamper_description="Adversary altered 'Apollo 11' -> 'Apollo 13' and 'July 20' -> 'August 15'. Parity verification immediately isolates the 2 altered blocks!"
        ),
        UTF8Preset(
            id="preset_intact_quantum",
            title="Quantum Entanglement Definition (Authentic Watermarked)",
            description="Intact zero-width watermarked physics abstract with author signature.",
            watermarked_text=res_2.watermarked_text,
            payload=res_2.payload,
            is_tampered=False,
            tamper_description=None
        )
    ]

def get_utf8_presets() -> List[UTF8Preset]:
    return build_presets()
