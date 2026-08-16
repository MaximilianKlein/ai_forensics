from typing import List
from .models import SampleCase

PRESET_SAMPLES: List[SampleCase] = [
    SampleCase(
        id="sample_catalonia",
        title="Catalan Statistics (Puffery & Shift Tropes)",
        category="Wikipedia AI Revision",
        source_description="Real diff from Wikipedia article 'Statistical Institute of Catalonia' added by an LLM in Sept 2024.",
        text=(
            "The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment "
            "in the evolution of regional statistics in Spain. The founding of Idescat represented a significant shift "
            "toward regional statistical independence, enabling Catalonia to develop a statistical system tailored to its unique "
            "socio-economic context. This initiative was part of a broader movement across Spain to decentralize "
            "administrative functions and enhance regional governance.\n\n"
            "Today, the institute stands as a testament to regional collaboration, serving as a beacon of public transparency "
            "while fostering statistical literacy, enhancing open data access, and driving data-informed policymaking across southern Europe."
        ),
        expected_highlights=[
            "marking a pivotal moment",
            "represented a significant shift",
            "was part of a broader movement",
            "stands as a testament to",
            "serving as a beacon",
            "fostering statistical literacy, enhancing open data access, and driving data-informed"
        ]
    ),
    SampleCase(
        id="sample_chatbot_leak",
        title="Leaked Platform Search Citations",
        category="Hard Machine Leaks",
        source_description="Chatbot search grounding output containing internal tokens and tracking parameters.",
        text=(
            "Certainly! Here is an overview of the topic:\n\n"
            "Quantum dot displays utilize semiconducting nanocrystals to deliver unprecedented color accuracy turn0search3. "
            "Recent advancements have enabled high-volume manufacturing [cite: 1, 2], marking a crucial milestone in consumer electronics. "
            "The research demonstrates extraordinary quantum yield 【4†source】, setting the stage for next-generation flexible screens.\n\n"
            "For further documentation, see https://example.org/display-tech?utm_source=chatgpt.com [oaicite:0].\n\n"
            "I hope this helps! Let me know if you need further details on the manufacturing process."
        ),
        expected_highlights=[
            "Certainly! Here is an overview of the topic:",
            "turn0search3",
            "[cite: 1, 2]",
            "【4†source】",
            "utm_source=chatgpt.com",
            "[oaicite:0]",
            "I hope this helps! Let me know if you need further details"
        ]
    ),
    SampleCase(
        id="sample_deadbot",
        title="Deadbot & Digital Grief (Abstract Reflection)",
        category="Wikipedia AI Revision",
        source_description="Real diff from Wikipedia article 'Deadbot' (Oct 2025) featuring overgeneralized debate and reflection.",
        text=(
            "The phenomenon of digital resurrection has generated debate about authenticity, consent, and the psychological "
            "effects of digitally extending personhood. Collectively, these works have shaped emerging policy discussions about "
            "ownership, consent, and dignity in digital technologies.\n\n"
            "GriefBots have prompted broader reflection on mortality and memory in a digital age. They blur boundaries between "
            "life and data, raising philosophical questions about identity, authenticity, and what it means to live on through algorithms.\n\n"
            "While challenges remain, the evolving landscape serves as an intricate tapestry of technological innovation and human grief."
        ),
        expected_highlights=[
            "generated debate",
            "prompted broader reflection",
            "raising philosophical questions",
            "While challenges remain",
            "evolving landscape",
            "intricate tapestry"
        ]
    ),
    SampleCase(
        id="sample_bacnotan",
        title="Bacnotan Etymology (Inflated Significance)",
        category="Wikipedia AI Revision",
        source_description="Real diff from Wikipedia article 'Bacnotan' (Dec 2024) inflating simple town name origins.",
        text=(
            "During the Spanish colonial period, the name Bakunutan was hispanized to Bacnotan, a modification reflected in official "
            "documents preserved in the National Archives in Manila.\n\n"
            "This etymology highlights the enduring legacy of the community's resistance and the transformative power of unity in "
            "shaping its cultural identity across generations. Rather than merely recording a phonetic transition, it underscores "
            "a pivotal shift in municipal governance—fostering local pride, promoting regional cohesion, and establishing a lasting heritage."
        ),
        expected_highlights=[
            "highlights the enduring legacy",
            "the transformative power of",
            "Rather than merely recording",
            "underscores a pivotal shift",
            "fostering local pride, promoting regional cohesion, and establishing a lasting"
        ]
    ),
    SampleCase(
        id="sample_human_neutral",
        title="James Webb Space Telescope (Clean Encyclopedic Human Sample)",
        category="Human Control Baseline",
        source_description="Clean, neutral human-written Wikipedia article section following MoS guidelines.",
        text=(
            "The James Webb Space Telescope (JWST) is a space telescope designed primarily to conduct infrared astronomy. "
            "As the largest optical telescope in space, its high resolution and sensitivity allow it to view objects too old, distant, "
            "or faint for the Hubble Space Telescope.\n\n"
            "The U.S. National Aeronautics and Space Administration (NASA) led JWST's development in collaboration with the European "
            "Space Agency (ESA) and the Canadian Space Agency (CSA). NASA's Goddard Space Flight Center in Maryland managed telescope "
            "development, while the Space Telescope Science Institute in Baltimore operates JWST.\n\n"
            "JWST was launched on 25 December 2021 on an Ariane 5 rocket from Kourou, French Guiana, and arrived at the Sun–Earth L2 "
            "Lagrange point in January 2022. The first image from JWST was released to the public on 11 July 2022."
        ),
        expected_highlights=[]
    )
]

def get_preset_samples() -> List[SampleCase]:
    return PRESET_SAMPLES
