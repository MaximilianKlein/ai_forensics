import re
from typing import List, Tuple
from .models import HeuristicHit

# Tier 1: Archetypal "AI Hallmark" words (very high over-representation in LLMs)
AI_TIER1_WORDS = {
    "delve": ("delve", "explore / examine / study"),
    "delving": ("delving", "examining / exploring"),
    "delves": ("delves", "examines / explores"),
    "tapestry": ("tapestry", "complex combination / network"),
    "testament": ("testament", "evidence / indication"),
    "beacon": ("beacon", "leader / symbol"),
    "pivotal": ("pivotal", "important / central"),
    "overarching": ("overarching", "broad / comprehensive"),
    "multifaceted": ("multifaceted", "complex / diverse"),
    "intricate": ("intricate", "detailed / complex"),
    "paramount": ("paramount", "important / critical"),
    "commendable": ("commendable", "notable / recognized"),
    "indelible": ("indelible", "lasting"),
    "foster": ("foster", "support / encourage"),
    "fostering": ("fostering", "supporting / encouraging"),
    "fosters": ("fosters", "supports / encourages"),
    "underscore": ("underscore", "highlight / emphasize"),
    "underscores": ("underscores", "highlights / emphasizes"),
    "underscoring": ("underscoring", "highlighting"),
    "interplay": ("interplay", "interaction / relation"),
    "embark": ("embark", "begin / start"),
    "embarked": ("embarked", "began / started"),
    "embarking": ("embarking", "beginning"),
    "illuminate": ("illuminate", "explain / show"),
    "illuminates": ("illuminates", "explains / shows"),
    "meticulous": ("meticulous", "detailed / precise"),
    "meticulously": ("meticulously", "carefully"),
    "holistic": ("holistic", "comprehensive"),
    "nuanced": ("nuanced", "detailed / specific"),
    "nuance": ("nuance", "detail / distinction"),
    "showcase": ("showcase", "present / display"),
    "showcases": ("showcases", "presents / displays"),
    "showcasing": ("showcasing", "presenting"),
    "resonate": ("resonate", "align / relate"),
    "resonates": ("resonates", "aligns / relates"),
    "resonating": ("resonating", "relating"),
    "bustling": ("bustling", "active / busy"),
    "myriad": ("myriad", "many / numerous"),
    "nexus": ("nexus", "connection / center"),
    "cornerstone": ("cornerstone", "foundation / basis"),
}

# Copula Avoidance: Grandiose verbs replacing basic "is / was / are / were"
COPULA_AVOIDANCE_PATTERNS: List[Tuple[str, str, str]] = [
    (r"\b(?:stands\s+as|serves\s+as|functions\s+as|acts\s+as)\b", "is / was", "stands/serves as"),
    (r"\b(?:is\s+a\s+testament\s+to|stands\s+as\s+a\s+testament\s+to)\b", "reflects / demonstrates", "is a testament to"),
    (r"\b(?:marks\s+a\s+(?:pivotal|crucial|vital|significant|key)\s+(?:moment|shift|milestone|turning\s+point))\b", "marked a change", "marks a pivotal moment"),
    (r"\b(?:represented\s+a\s+significant\s+shift)\b", "changed", "represented a significant shift"),
    (r"\b(?:underscores\s+its\s+importance|highlights\s+its\s+significance)\b", "emphasizes", "underscores its importance"),
    (r"\b(?:solidify\s+its\s+role\s+as|solidified\s+its\s+status\s+as)\b", "became", "solidify its role as"),
    (r"\b(?:setting\s+the\s+stage\s+for|set\s+the\s+stage\s+for)\b", "enabling / preceding", "setting the stage for"),
    (r"\b(?:plays\s+a\s+(?:crucial|pivotal|vital|key)\s+role\s+in)\b", "contributes to / is involved in", "plays a crucial role in"),
    (r"\b(?:an\s+evolving\s+landscape|a\s+rapidly\s+changing\s+landscape)\b", "changes in", "evolving landscape"),
    (r"\b(?:left\s+an\s+indelible\s+mark\s+on)\b", "influenced / affected", "left an indelible mark"),
    (r"\b(?:deeply\s+rooted\s+in)\b", "originating in / based on", "deeply rooted in"),
]

def find_lexicon_hits(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Copula Avoidance & Elevated Phrasal Tropes
    for pattern, replacement, label in COPULA_AVOIDANCE_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id="copula_avoidance",
                category="ai_vocabulary",
                rule_name="Copula Avoidance & Elevated Verb",
                severity="warning",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=f"Overuse of grandiose verbs ({label}) instead of clear, direct declarative language ('is', 'was', 'became').",
                suggestion=replacement,
                confidence=0.88
            ))

    # 2. Individual AI Hallmark Words
    # We match whole words
    word_pattern = re.compile(r"\b([a-zA-Z]+)\b")
    for match in word_pattern.finditer(text):
        word_lower = match.group(1).lower()
        if word_lower in AI_TIER1_WORDS:
            # Check if this hit is already part of a larger copula avoidance match to avoid noisy overlap
            start = match.start()
            end = match.end()
            overlap = any(h.start_char <= start and end <= h.end_char for h in hits)
            if not overlap:
                orig, sugg = AI_TIER1_WORDS[word_lower]
                hits.append(HeuristicHit(
                    rule_id=f"ai_vocab_{word_lower}",
                    category="ai_vocabulary",
                    rule_name=f"Elevated AI Vocabulary: '{word_lower}'",
                    severity="info" if word_lower in {"foster", "intricate"} else "warning",
                    start_char=start,
                    end_char=end,
                    matched_text=match.group(1),
                    explanation=f"'{word_lower}' is disproportionately overrepresented in LLM generated text compared to standard human writing.",
                    suggestion=sugg,
                    confidence=0.82
                ))

    return hits
