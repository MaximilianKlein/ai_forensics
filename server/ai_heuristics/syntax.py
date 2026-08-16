import re
from typing import List, Tuple, Optional
from .models import HeuristicHit

def find_syntax_hits(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Negative Parallelisms
    # Based on Wikipedia:Signs of AI writing (WP:NOTONLY / WP:NOTXBUTY / WP:RATHERTHAN)
    parallelism_patterns: List[Tuple[str, str, str, str, Optional[str]]] = [
        # 1a. Not only / Not just / Not merely / Not simply ... but (also / even) ...
        (
            r"\bnot\s+(?:only|just|merely|simply)\s+([^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)?\bbut\s+(?:also\s+|even\s+|rather\s+)?([^,\.\;\:\n\(\)]+)",
            "syntax_not_only_but_also",
            "Negative Parallelism ('Not only X, but also Y')",
            "Formulaic 'not only X, but also Y' rhetorical construction frequently overused by LLMs to create artificial symmetry.",
            None
        ),
        # 1b. Clause inversion: Not only did/does/is/was/can ... but ... also ...
        (
            r"\bnot\s+only\s+(?:did|does|do|is|was|were|can|could|will|would|has|have|had)\s+([^,\.\;\:\n]+?)(?:,\s*|\s+)?\bbut\s+([^,\.\;\:\n]+?\balso\b[^,\.\;\:\n]*)",
            "syntax_not_only_inversion",
            "Negative Parallelism ('Not only did X, but Y also Z')",
            "Inverted negative parallelism construction frequently used in dramatic AI summaries.",
            None
        ),
        # 2a. Parallel Prepositions / Articles / Infinitives: not [prep/art/to] X, but [prep/art/to] Y
        (
            r"\bnot\s+((?:to|in|on|at|for|by|with|from|through|as|about|of|under|over|into|a|an|the|because|when|while)\s+[^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)?\bbut\s+((?:to|in|on|at|for|by|with|from|through|as|about|of|under|over|into|a|an|the|because|when|while)\s+[^,\.\;\:\n\(\)]+)",
            "syntax_not_prep_but_prep",
            "Negative Parallelism ('Not X, but Y')",
            "Antithetical 'Not X, but Y' contrast construction overused to introduce unnecessary rhetorical drama instead of straightforward facts.",
            None
        ),
        # 2b. Copular negative contrast: is/was/are/were not X, but Y (excluding not only/just)
        (
            r"\b(?:is|was|are|were|serves|stands)\s+not\s+(?!(?:only|just|merely|simply)\b)([^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)?\bbut\s+([^,\.\;\:\n\(\)]+)",
            "syntax_is_not_but",
            "Negative Parallelism ('is not X, but Y')",
            "Contrasting what a subject 'is not' before stating what it 'is'—a classic AI stylistic filler.",
            None
        ),
        # 3a. Rather than X, Y (Pre-position)
        (
            r"\brather\s+than\s+(?:merely\s+|simply\s+|just\s+)?([^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)([^,\.\;\:\n\(\)]+)",
            "syntax_rather_than_intro",
            "Negative Parallelism ('Rather than X, Y')",
            "Contrastive introductory framing used to pad sentences with rhetorical balance.",
            None
        ),
        # 3b. X rather than Y (Post-position)
        (
            r"\b([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+){0,4})\s*,?\s*\brather\s+than\s+(?:merely\s+|simply\s+|just\s+)?([^,\.\;\:\n\(\)]+)",
            "syntax_x_rather_than_y",
            "Negative Parallelism ('X rather than Y')",
            "Contrastive 'rather than' construction used to pad statements with comparative fluff.",
            None
        ),
        # 4a. Instead of X, Y (Pre-position)
        (
            r"\binstead\s+of\s+(?:merely\s+|simply\s+|just\s+)?([^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)([^,\.\;\:\n\(\)]+)",
            "syntax_instead_of_intro",
            "Negative Parallelism ('Instead of X, Y')",
            "Contrastive 'instead of' framing frequently overused in explanatory AI summaries.",
            None
        ),
        # 4b. X instead of Y (Post-position)
        (
            r"\b([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+){0,4})\s*,?\s*\binstead\s+of\s+(?:merely\s+|simply\s+|just\s+)?([^,\.\;\:\n\(\)]+)",
            "syntax_x_instead_of_y",
            "Negative Parallelism ('X instead of Y')",
            "Comparative contrast used in place of direct encyclopedic statements.",
            None
        ),
        # 5. More than just X, it is Y
        (
            r"\bmore\s+than\s+(?:just|merely|simply)\s+([^,\.\;\:\n\(\)]+?)(?:,\s*|\s*;\s*|\s+)(?:it\s+(?:is|was|serves|stands)|they\s+are|this\s+is)\s+([^,\.\;\:\n\(\)]+)",
            "syntax_more_than_just",
            "Negative Parallelism ('More than just X, it is Y')",
            "Elevated 'more than just' formulaic rhetorical inflation.",
            None
        ),
        # 6. Far from X, Y
        (
            r"\bfar\s+from\s+(?:being\s+|simply\s+)?([^,\.\;\:\n\(\)]+?)(?:,\s*|\s+)([^,\.\;\:\n\(\)]+)",
            "syntax_far_from",
            "Negative Parallelism ('Far from X, Y')",
            "Formulaic antithetical preamble overused in AI writing.",
            None
        ),
    ]

    for pattern, rule_id, rule_name, explanation, suggestion in parallelism_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            matched_str = match.group(0).strip()
            # Avoid matching single word / trivial snippets
            if len(matched_str.split()) >= 4:
                hits.append(HeuristicHit(
                    rule_id=rule_id,
                    category="rhetorical_syntax",
                    rule_name=rule_name,
                    severity="warning",
                    start_char=match.start(),
                    end_char=match.end(),
                    matched_text=matched_str,
                    explanation=explanation,
                    suggestion=suggestion,
                    confidence=0.88
                ))

    # 2. Rule of Three (Tricolons): Overused 3-part participle or noun lists
    # E.g. "fostering X, enhancing Y, and driving Z" or "innovation, collaboration, and sustainability"
    tricolon_participle_pattern = re.compile(
        r"\b((?:fostering|enhancing|promoting|ensuring|driving|enabling|empowering|supporting|creating|developing|maintaining|advancing|cultivating)\s+[^,]+?,\s+"
        r"(?:fostering|enhancing|promoting|ensuring|driving|enabling|empowering|supporting|creating|developing|maintaining|advancing|cultivating)\s+[^,]+?,?\s+"
        r"and\s+(?:fostering|enhancing|promoting|ensuring|driving|enabling|empowering|supporting|creating|developing|maintaining|advancing|cultivating)\s+[^,\.\;\:\n]+)",
        re.IGNORECASE
    )

    for match in tricolon_participle_pattern.finditer(text):
        hits.append(HeuristicHit(
            rule_id="syntax_tricolon_participles",
            category="rhetorical_syntax",
            rule_name="Rule of Three: Formulaic Tricolon List",
            severity="warning",
            start_char=match.start(),
            end_char=match.end(),
            matched_text=match.group(0).strip(),
            explanation="Overused triad list of parallel gerund phrases ('fostering X, enhancing Y, and driving Z').",
            suggestion=None,
            confidence=0.92
        ))

    return hits
