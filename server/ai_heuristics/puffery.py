import re
from typing import List, Tuple
from .models import HeuristicHit

# Undue emphasis on significance, legacy, and broader trends
# Direct examples from Wikipedia:Signs of AI writing
PUFFERY_PATTERNS: List[Tuple[str, str, str, str]] = [
    (
        r"\b(?:marking\s+a\s+pivotal\s+moment|marked\s+a\s+pivotal\s+moment)\b",
        "puffery_pivotal_moment",
        "Significance Puffery ('pivotal moment')",
        "Unsubstantiated grand narrative claim inflating historical importance."
    ),
    (
        r"\b(?:represented\s+a\s+significant\s+shift|represents\s+a\s+significant\s+shift)\b",
        "puffery_significant_shift",
        "Significance Puffery ('significant shift')",
        "Formulaic claim of broader systemic transformation."
    ),
    (
        r"\b(?:was\s+part\s+of\s+a\s+broader\s+movement|contributes\s+to\s+the\s+broader\s+history|reflects\s+the\s+broader)\b",
        "puffery_broader_movement",
        "Trend Inflation ('part of a broader movement')",
        "Generic claim tying a narrow topic to sweeping historical trends."
    ),
    (
        r"\b(?:enduring\s+legacy|lasting\s+legacy|indelible\s+mark)\b",
        "puffery_enduring_legacy",
        "Legacy Puffery ('enduring legacy')",
        "Puffed-up rhetoric attributing perpetual significance to standard achievements."
    ),
    (
        r"\b(?:the\s+transformative\s+power\s+of)\b",
        "puffery_transformative_power",
        "Puffery ('transformative power')",
        "Sensationalizing commonplace events or unity."
    ),
    (
        r"\b(?:crucial\s+for\s+the\s+survival\s+of\s+this\s+and\s+other\s+endemic\s+species)\b",
        "puffery_biology_ecosystem",
        "Biology Puffery (Generic Conservation Homily)",
        "Generic environmental boiler-plate text inserted regardless of specific ecological evidence."
    ),
    (
        r"\b(?:plays?\s+a\s+role\s+in\s+the\s+ecosystem|contributes?\s+to\s+[A-Za-z\s]+'s\s+rich\s+cultural\s+heritage)\b",
        "puffery_heritage_ecosystem",
        "Cultural / Ecological Puffery Filler",
        "Formulaic generic claims asserting cultural or ecological importance."
    ),
]

# Weasel Words & Vague Attribution
WEASEL_PATTERNS: List[Tuple[str, str, str, str]] = [
    (
        r"\b(?:has\s+generated\s+debate|generated\s+widespread\s+debate|prompted\s+broader\s+reflection|raising\s+philosophical\s+questions)\b",
        "weasel_abstract_debate",
        "Vague Debate / Reflection Framing",
        "Vaguely claiming an entity 'generated debate' or 'raised philosophical questions' without citing specific parties or publications."
    ),
    (
        r"\b(?:critics\s+(?:argue|have\s+argued|point\s+out)|many\s+(?:scholars|experts|observers)\s+(?:believe|agree|suggest))\b",
        "weasel_vague_attribution",
        "Weasel Words (Vague Attribution)",
        "Attributing opinions to anonymous 'critics' or 'many scholars' without concrete citations."
    ),
    (
        r"\b(?:it\s+is\s+widely\s+(?:considered|believed|acknowledged|recognized)\s+that)\b",
        "weasel_widely_considered",
        "Unattributed Consensus Claim",
        "Claiming broad consensus ('it is widely believed') without a reliable source."
    ),
    (
        r"\b(?:has\s+garnered\s+(?:critical\s+acclaim|attention|praise)\s+(?:from|across))\b",
        "weasel_canned_acclaim",
        "Canned Notability Claim",
        "Formulaic assertion of media attention and critical praise."
    )
]

# Formulaic Outline Conclusions
CONCLUSION_PATTERNS: List[Tuple[str, str, str, str]] = [
    (
        r"^(?:#{1,4}\s+)?(?:Looking\s+Ahead|Challenges\s+and\s+Future\s+Prospects|Future\s+Outlook|Conclusion\s+and\s+Future\s+Directions)\b",
        "conclusion_future_prospects",
        "Formulaic Future Prospects Section",
        "Standard LLM outline section summarizing hypothetical future developments rather than factual encyclopedic history."
    ),
    (
        r"\b(?:As\s+(?:technology|the\s+field|the\s+industry|society)\s+continues\s+to\s+evolve,?\s+the\s+future\s+of\s+[^,\.\;\n]+?\s+remains?\s+[^,\.\;\n]+?)\b",
        "conclusion_evolving_cliche",
        "Formulaic 'As Technology Evolves' Wrap-Up",
        "Cliche conclusion sentence summarizing ongoing evolution."
    ),
    (
        r"\b(?:While\s+challenges\s+remain,?\s+(?:its|the)\s+potential\s+(?:remains?|is)\s+vast)\b",
        "conclusion_balanced_wrapup",
        "Artificial Balance Concluding Trope",
        "Formulaic 'challenges remain, but potential is vast' summary phrase."
    )
]

def find_puffery_hits(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Puffery & Forced Significance
    for pattern, rule_id, rule_name, explanation in PUFFERY_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="discourse_puffery",
                rule_name=rule_name,
                severity="warning",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=explanation,
                suggestion=None,
                confidence=0.88
            ))

    # 2. Weasel words & Vague Attribution
    for pattern, rule_id, rule_name, explanation in WEASEL_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="discourse_puffery",
                rule_name=rule_name,
                severity="warning",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=explanation,
                suggestion=None,
                confidence=0.85
            ))

    # 3. Formulaic Outline Conclusions
    for pattern, rule_id, rule_name, explanation in CONCLUSION_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="discourse_puffery",
                rule_name=rule_name,
                severity="warning",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0).strip(),
                explanation=explanation,
                suggestion=None,
                confidence=0.90
            ))

    return hits
