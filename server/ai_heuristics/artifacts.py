import re
from typing import List
from .models import HeuristicHit

def find_machine_artifacts(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Platform & Search Citation Leaks (ChatGPT, DeepSeek, Gemini, Perplexity, Grok, Claude)
    citation_patterns = [
        # ChatGPT / OpenAI web search tokens
        (
            r"\b(?:turn\d+search\d+|oaicite[:\w\-]+|oai_citation|contentReference|attributableIndex)\b",
            "leak_chatgpt_search",
            "ChatGPT Internal Citation Token",
            "critical",
            "Internal backend search/citation token leaked from OpenAI web search interface.",
            ""
        ),
        (
            r"\[\+1\]|\(\+1\)",
            "leak_plus_one_citation",
            "OpenAI +1 Search Citation Bubble",
            "critical",
            "ChatGPT search citation footnote marker (+1).",
            ""
        ),
        # DeepSeek lenticular brackets & dagger citation artifacts
        (
            r"【\d+†source】|【\d+†\w+】|【\d+】",
            "leak_deepseek_citation",
            "DeepSeek Citation Tag",
            "critical",
            "DeepSeek web search citation tag with lenticular brackets.",
            ""
        ),
        (
            r"\[\d+†source\]|\[\d+†\w+\]",
            "leak_dagger_citation",
            "Dagger Search Citation Tag",
            "critical",
            "Search engine citation marker with dagger symbol.",
            ""
        ),
        # Gemini citation markers
        (
            r"\[cite:\s*\d+(?:,\s*\d+)*\]",
            "leak_gemini_cite",
            "Gemini Citation Token",
            "critical",
            "Google Gemini web search grounding citation token.",
            ""
        ),
        (
            r"\[span_\d+\]\(start_span\)|\[span_\d+\]\(end_span\)",
            "leak_gemini_span",
            "Gemini Grounding Span Token",
            "critical",
            "Raw Gemini grounding span tag leaked into output.",
            ""
        ),
        # Grok / X.AI citation markers
        (
            r"\bgrok_card\b|\bgrok_render_citation_card_json\b",
            "leak_grok_card",
            "Grok Search Citation Tag",
            "critical",
            "Grok citation card rendering tag.",
            ""
        ),
        # Perplexity file uploads / citation tokens
        (
            r"\bppl-ai-file-upload\b|\battached_file\b",
            "leak_perplexity_upload",
            "Perplexity Upload Tag",
            "critical",
            "Perplexity AI internal file-attachment reference.",
            ""
        ),
        # Claude Artifact & raw XML tags
        (
            r":::writing|<antArtifact[^>]*>|</antArtifact>|<antThought[^>]*>|</antThought>",
            "leak_claude_artifact",
            "Claude Artifact / Tag Leak",
            "critical",
            "Anthropic Claude system markup tag or artifact container.",
            ""
        ),
    ]

    for pattern, rule_id, rule_name, severity, explanation, suggestion in citation_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="machine_artifacts",
                rule_name=rule_name,
                severity=severity,
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=explanation,
                suggestion=suggestion,
                confidence=1.0
            ))

    # 2. Tracking URL parameters (e.g. utm_source=chatgpt.com, utm_source=perplexity.ai)
    tracking_patterns = [
        (
            r"https?://[^\s\"'>]+utm_source=(?:chatgpt\.com|perplexity|bing_copilot|google_ai|openai)[^\s\"'>]*",
            "leak_ai_utm_source",
            "AI Web Search Tracking Parameter",
            "critical",
            "URL contains tracking parameter (utm_source) linking directly to an AI chatbot web session.",
            None
        ),
        (
            r"https?://www\.google\.com/url\?q=https?://[^\s\"'>]+",
            "leak_google_redirect",
            "Raw Search Engine Redirect URL",
            "warning",
            "Raw Google redirect URL directly copied from AI search grounding output.",
            None
        )
    ]

    for pattern, rule_id, rule_name, severity, explanation, suggestion in tracking_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="machine_artifacts",
                rule_name=rule_name,
                severity=severity,
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=explanation,
                suggestion=suggestion,
                confidence=0.98
            ))

    # 3. Conversational / Collaborative Opening & Closing Bleed
    conversational_patterns = [
        (
            r"^(?:Certainly|Sure|Of course|Here is|Here's|Below is|Here is an overview of|Here's a comprehensive)\b[^\.\n]*[\.\:\n]",
            "bleed_conversational_intro",
            "Chatbot Conversational Opening",
            "critical",
            "Standard conversational assistant preamble that should not appear in encyclopedic or professional writing.",
            ""
        ),
        (
            r"(?:I hope this helps|Let me know if you need (?:further|more)|Feel free to ask|Let me know if you would like)[^\.\n]*[\.\!\n]?",
            "bleed_conversational_outro",
            "Chatbot Conversational Closing",
            "critical",
            "Standard polite AI closing phrase indicating unedited copy-pasted conversation.",
            ""
        ),
        (
            r"\b(?:As an AI(?:\s+language\s+model)?|As of my last (?:knowledge\s+update|training\s+data))\b",
            "bleed_ai_self_reference",
            "AI Self-Reference",
            "critical",
            "Explicit self-identification as an artificial intelligence language model.",
            ""
        ),
        (
            r"\b(?:In this article,\s+we\s+will\s+(?:explore|delve|examine|look\s+at)|In the following sections?,?\s+we)\b",
            "bleed_essay_intro_trope",
            "Essay Framing Cliché",
            "warning",
            "First-person conversational framing common in formulaic LLM writing.",
            None
        )
    ]

    for pattern, rule_id, rule_name, severity, explanation, suggestion in conversational_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="machine_artifacts",
                rule_name=rule_name,
                severity=severity,
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0).strip(),
                explanation=explanation,
                suggestion=suggestion,
                confidence=0.95
            ))

    # 4. Knowledge Cutoff Disclaimers & Unfilled Phrasal Templates
    disclaimer_patterns = [
        (
            r"\b(?:as of (?:January|February|March|April|May|June|July|August|September|October|November|December)\s+202[0-9],?\s+(?:specific\s+details|information|data)\s+(?:is|are|remains?)\s+(?:limited|unavailable|not\s+publicly\s+available))\b",
            "disclaimer_knowledge_cutoff",
            "Knowledge-Cutoff Disclaimer",
            "warning",
            "Hedging disclaimer formula commonly generated when an LLM encounters data past its training cutoff.",
            None
        ),
        (
            r"\[(?:insert\s+(?:name|date|citation|source|reference|link)|your\s+company|author's\s+name|entity)\]",
            "template_unfilled_placeholder",
            "Unfilled Template Placeholder",
            "critical",
            "Unfilled bracket placeholder left behind by template generation.",
            ""
        )
    ]

    for pattern, rule_id, rule_name, severity, explanation, suggestion in disclaimer_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            hits.append(HeuristicHit(
                rule_id=rule_id,
                category="machine_artifacts",
                rule_name=rule_name,
                severity=severity,
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=explanation,
                suggestion=suggestion,
                confidence=0.95
            ))

    return hits
