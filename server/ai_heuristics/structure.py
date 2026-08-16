import re
from typing import List
from .models import HeuristicHit

def find_structure_hits(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Inline-header vertical lists: `* **Concept:** Description` or `- **Term:** explanation`
    inline_bold_bullet_pattern = re.compile(
        r"^[\*\-\+]\s+(\*\*[^\*\:\n]+\*\*\:?)\s+",
        re.MULTILINE
    )
    bold_bullet_matches = list(inline_bold_bullet_pattern.finditer(text))
    if len(bold_bullet_matches) >= 3:
        for match in bold_bullet_matches:
            hits.append(HeuristicHit(
                rule_id="struct_inline_bold_list",
                category="structural_style",
                rule_name="Inline-Header Bold Vertical List",
                severity="info",
                start_char=match.start(1),
                end_char=match.end(1),
                matched_text=match.group(1),
                explanation="Pattern of starting consecutive bullet points with bold term titles followed by colons.",
                suggestion=match.group(1).replace("**", "").replace(":", ""),
                confidence=0.85
            ))

    # 2. Overuse of Em Dashes (— or --)
    em_dash_pattern = re.compile(r"(—|(?<=\s)--(?:[\s]))")
    em_dash_matches = list(em_dash_pattern.finditer(text))
    # If more than 2 em-dashes in a relatively short text (< 200 words) or > 4 overall
    word_count = len(re.findall(r"\w+", text))
    if (word_count > 0 and len(em_dash_matches) / max(1, (word_count / 100)) >= 1.5) or len(em_dash_matches) >= 4:
        for match in em_dash_matches:
            hits.append(HeuristicHit(
                rule_id="struct_em_dash_density",
                category="structural_style",
                rule_name="High Em-Dash (—) Frequency",
                severity="info",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation="LLMs heavily favor em-dashes to insert parenthetical thoughts and dramatic pauses.",
                suggestion=", ",
                confidence=0.75
            ))

    # 3. Emoji used as list item bullets or headings
    emoji_bullet_pattern = re.compile(
        r"^[\*\-\+]?\s*([\U00010000-\U0010ffff\u2600-\u27ff\u2300-\u23ff])\s+(?=[A-Z0-9])",
        re.MULTILINE
    )
    for match in emoji_bullet_pattern.finditer(text):
        hits.append(HeuristicHit(
            rule_id="struct_emoji_bullet",
            category="structural_style",
            rule_name="Emoji List Bulleting",
            severity="warning",
            start_char=match.start(1),
            end_char=match.end(1),
            matched_text=match.group(1),
            explanation="Decorative emoji placed at the start of list items or headers is common in informal AI output.",
            suggestion="",
            confidence=0.90
        ))

    # 4. Heading Structure: Repeated Top H1 (# Title) or Title Case headings
    # Check for Markdown headers like `## Historical Background And Global Impact`
    header_pattern = re.compile(r"^(#{1,6})\s+([^\n]+)$", re.MULTILINE)
    for match in header_pattern.finditer(text):
        hashes, title = match.groups()
        words = title.split()
        if len(words) >= 3:
            # Check if all significant words are capitalized (Title Case where standard sentence case is expected in Wikipedia/MoS)
            capitalized_words = [w for w in words if w[0].isupper() and w.lower() not in {"and", "or", "in", "on", "of", "to", "the", "a", "an", "for", "with"}]
            if len(capitalized_words) >= len(words) - 1:
                hits.append(HeuristicHit(
                    rule_id="struct_title_case_heading",
                    category="structural_style",
                    rule_name="Title Case in Section Heading",
                    severity="info",
                    start_char=match.start(2),
                    end_char=match.end(2),
                    matched_text=title,
                    explanation="Wikipedia Manual of Style uses sentence case for headings ('Early life and career' rather than 'Early Life And Career').",
                    suggestion=title.capitalize(),
                    confidence=0.70
                ))

    # 5. Excessive Thematic Breaks (`---` horizontal rules)
    thematic_break_pattern = re.compile(r"^---+$", re.MULTILINE)
    breaks = list(thematic_break_pattern.finditer(text))
    if len(breaks) >= 3:
        for match in breaks:
            hits.append(HeuristicHit(
                rule_id="struct_thematic_breaks",
                category="structural_style",
                rule_name="Excessive Thematic Breaks (---)",
                severity="info",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation="AI generators often delimit every section with horizontal divider rules.",
                suggestion="",
                confidence=0.80
            ))

    return hits
