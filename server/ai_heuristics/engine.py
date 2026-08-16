import re
import uuid
from typing import List, Dict
from .models import (
    HeuristicHit,
    RadarScores,
    CategoryBreakdown,
    StylometryMetrics,
    SentenceStat,
    SuggestionFix,
    AnalysisResult
)
from .artifacts import find_machine_artifacts
from .lexicon import find_lexicon_hits
from .syntax import find_syntax_hits
from .structure import find_structure_hits
from .puffery import find_puffery_hits
from .citations import find_citation_hits
from .stylometry import calculate_stylometry

def deduplicate_and_sort_hits(hits: List[HeuristicHit]) -> List[HeuristicHit]:
    # Sort primarily by start_char, and secondarily by span length (longer first)
    sorted_hits = sorted(hits, key=lambda h: (h.start_char, -(h.end_char - h.start_char)))
    
    deduped: List[HeuristicHit] = []
    for hit in sorted_hits:
        # Check if identical span already exists
        exists = any(
            d.start_char == hit.start_char and d.end_char == hit.end_char and d.rule_id == hit.rule_id
            for d in deduped
        )
        if not exists:
            deduped.append(hit)
    return deduped

def generate_cleaned_draft(text: str, hits: List[HeuristicHit]) -> str:
    # Sort hits from end of string to start so offsets remain valid during replacements
    replaceable_hits = [h for h in hits if h.suggestion is not None]
    # Filter out overlapping hits for safe string replacement
    non_overlapping: List[HeuristicHit] = []
    last_start = len(text) + 100
    
    for h in sorted(replaceable_hits, key=lambda x: x.start_char, reverse=True):
        if h.end_char <= last_start:
            non_overlapping.append(h)
            last_start = h.start_char
            
    cleaned = text
    for h in non_overlapping:
        sugg = h.suggestion if h.suggestion is not None else ""
        cleaned = cleaned[:h.start_char] + sugg + cleaned[h.end_char:]
        
    # Clean up double spaces or residual empty punctuation lines
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()

def analyze_text(text: str, mode: str = "wikipedia") -> AnalysisResult:
    if not text or not text.strip():
        metrics = StylometryMetrics()
        radar = RadarScores(verdict_summary="No text provided for analysis.")
        return AnalysisResult(
            text=text,
            mode=mode,
            metrics=metrics,
            radar_scores=radar,
            hits=[],
            category_breakdowns={},
            sentences=[],
            suggestions=[],
            cleaned_draft=""
        )

    # 1. Run all heuristic analyzers
    all_hits: List[HeuristicHit] = []
    all_hits.extend(find_machine_artifacts(text))
    all_hits.extend(find_lexicon_hits(text))
    all_hits.extend(find_syntax_hits(text))
    all_hits.extend(find_structure_hits(text))
    all_hits.extend(find_puffery_hits(text))
    all_hits.extend(find_citation_hits(text))

    deduped_hits = deduplicate_and_sort_hits(all_hits)

    # 2. Stylometry & Sentence Stats
    metrics, sentences = calculate_stylometry(text)
    
    # Tag sentences with hit counts
    for s in sentences:
        s_hits = [h for h in deduped_hits if not (h.end_char <= s.start_char or h.start_char >= s.end_char)]
        s.hit_count = len(s_hits)
        s.has_critical = any(h.severity == "critical" for h in s_hits)

    # Calculate AI Vocab density
    word_count = max(1, metrics.total_words)
    vocab_hit_count = len([h for h in deduped_hits if h.category == "ai_vocabulary"])
    metrics.ai_vocab_density = round((vocab_hit_count / word_count) * 100.0, 2)

    # 3. Category Breakdowns & Radar Score Computation
    categories = [
        ("machine_artifacts", "Platform Leaks & Search Tokens"),
        ("ai_vocabulary", "AI Vocabulary & Copula Avoidance"),
        ("rhetorical_syntax", "Syntactic Symmetry & Parallelism"),
        ("structural_style", "Markdown & Structural Uniformity"),
        ("discourse_puffery", "Significance Puffery & Weasel Tropes"),
        ("citations_integrity", "Citations & DOI/ISBN Integrity")
    ]
    
    breakdowns: Dict[str, CategoryBreakdown] = {}
    normalized_scores: Dict[str, float] = {}

    for cat_key, desc in categories:
        cat_hits = [h for h in deduped_hits if h.category == cat_key]
        crit = sum(1 for h in cat_hits if h.severity == "critical")
        warn = sum(1 for h in cat_hits if h.severity == "warning")
        info = sum(1 for h in cat_hits if h.severity == "info")
        
        # Calculate normalized score (0 to 100) per category based on density per 100 words
        density_per_100w = (len(cat_hits) / word_count) * 100.0
        
        if cat_key == "machine_artifacts":
            # Any critical machine leak immediately spikes this dimension
            score = 100.0 if crit > 0 else min(100.0, density_per_100w * 50.0)
        elif cat_key == "citations_integrity":
            score = 100.0 if crit > 0 else min(100.0, density_per_100w * 40.0)
        else:
            # Scaled on density
            score = min(100.0, (crit * 30.0 + warn * 15.0 + info * 5.0) / max(1.0, word_count / 80.0) * 10.0)
            
        score = round(score, 1)
        normalized_scores[cat_key] = score
        breakdowns[cat_key] = CategoryBreakdown(
            count=len(cat_hits),
            score=score,
            critical_count=crit,
            warning_count=warn,
            info_count=info,
            description=desc
        )

    # 4. Compute Overall AI Confidence & Verdict
    has_critical_artifact = breakdowns.get("machine_artifacts", CategoryBreakdown()).critical_count > 0 or \
                            breakdowns.get("citations_integrity", CategoryBreakdown()).critical_count > 0
    
    avg_heuristics = (
        normalized_scores.get("ai_vocabulary", 0) * 0.25 +
        normalized_scores.get("rhetorical_syntax", 0) * 0.25 +
        normalized_scores.get("discourse_puffery", 0) * 0.25 +
        normalized_scores.get("structural_style", 0) * 0.15 +
        metrics.burstiness_score * 0.10
    )

    if has_critical_artifact:
        overall_score = max(95.0, round(avg_heuristics, 1))
        confidence_tier = "definitive_machine_leak"
        verdict = "Definitive Machine Artifacts Detected: Internal search tokens, grounding citations, or platform tags were identified."
    elif avg_heuristics >= 60.0:
        overall_score = round(min(94.0, avg_heuristics), 1)
        confidence_tier = "strong_stylistic_ai"
        verdict = "Strong Stylistic AI Hallmarks: High concentration of elevated vocabulary, significance puffery, and formulaic parallelisms."
    elif avg_heuristics >= 30.0:
        overall_score = round(avg_heuristics, 1)
        confidence_tier = "moderate_stylistic_ai"
        verdict = "Moderate AI Stylistic Markers: Some rhetorical symmetry and elevated word choices observed, but within possible human range."
    else:
        overall_score = round(avg_heuristics, 1)
        confidence_tier = "low_evidence"
        verdict = "Low AI Evidence / Likely Natural: Natural sentence cadence, neutral declarative verbs, and absence of formulaic tropes."

    radar = RadarScores(
        machine_artifacts=normalized_scores.get("machine_artifacts", 0.0),
        ai_vocabulary=normalized_scores.get("ai_vocabulary", 0.0),
        rhetorical_syntax=normalized_scores.get("rhetorical_syntax", 0.0),
        structural_style=normalized_scores.get("structural_style", 0.0),
        discourse_puffery=normalized_scores.get("discourse_puffery", 0.0),
        stylometry_burstiness=metrics.burstiness_score,
        overall_ai_score=overall_score,
        confidence_tier=confidence_tier,
        verdict_summary=verdict
    )

    # 5. Build Suggestion Fixes
    suggestions: List[SuggestionFix] = []
    for h in deduped_hits:
        if h.suggestion is not None:
            suggestions.append(SuggestionFix(
                id=str(uuid.uuid4())[:8],
                rule_id=h.rule_id,
                start_char=h.start_char,
                end_char=h.end_char,
                original_text=h.matched_text,
                replacement_text=h.suggestion,
                reason=h.explanation
            ))

    cleaned_draft = generate_cleaned_draft(text, deduped_hits)

    return AnalysisResult(
        text=text,
        mode=mode,
        metrics=metrics,
        radar_scores=radar,
        hits=deduped_hits,
        category_breakdowns=breakdowns,
        sentences=sentences,
        suggestions=suggestions,
        cleaned_draft=cleaned_draft
    )
