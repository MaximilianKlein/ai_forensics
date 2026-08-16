from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

SeverityLevel = Literal["info", "warning", "critical"]
CategoryType = Literal[
    "machine_artifacts",
    "ai_vocabulary",
    "rhetorical_syntax",
    "structural_style",
    "discourse_puffery",
    "citations_integrity"
]

class HeuristicHit(BaseModel):
    rule_id: str
    category: CategoryType
    rule_name: str
    severity: SeverityLevel
    start_char: int
    end_char: int
    matched_text: str
    explanation: str
    suggestion: Optional[str] = None
    confidence: float = 1.0

class CategoryBreakdown(BaseModel):
    count: int = 0
    score: float = 0.0  # 0 to 100
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    description: str = ""

class RadarScores(BaseModel):
    machine_artifacts: float = 0.0      # 0 to 100
    ai_vocabulary: float = 0.0          # 0 to 100
    rhetorical_syntax: float = 0.0      # 0 to 100
    structural_style: float = 0.0       # 0 to 100
    discourse_puffery: float = 0.0      # 0 to 100
    stylometry_burstiness: float = 0.0  # 0 to 100 (100 = very monotonous/AI-like, 0 = highly bursty/human)
    overall_ai_score: float = 0.0       # Weighted combination
    confidence_tier: Literal["low_evidence", "moderate_stylistic_ai", "strong_stylistic_ai", "definitive_machine_leak"] = "low_evidence"
    verdict_summary: str = ""

class SentenceStat(BaseModel):
    index: int
    text: str
    word_count: int
    start_char: int
    end_char: int
    hit_count: int = 0
    has_critical: bool = False

class StylometryMetrics(BaseModel):
    total_words: int = 0
    total_sentences: int = 0
    avg_sentence_length: float = 0.0
    sentence_length_std: float = 0.0
    burstiness_score: float = 0.0  # Normalized 0 to 100
    type_token_ratio: float = 0.0  # Lexical diversity
    em_dash_count: int = 0
    copula_ratio: float = 0.0
    ai_vocab_density: float = 0.0

class SuggestionFix(BaseModel):
    id: str
    rule_id: str
    start_char: int
    end_char: int
    original_text: str
    replacement_text: str
    reason: str

class AnalysisResult(BaseModel):
    text: str
    mode: str = "wikipedia"
    metrics: StylometryMetrics
    radar_scores: RadarScores
    hits: List[HeuristicHit] = []
    category_breakdowns: Dict[str, CategoryBreakdown] = {}
    sentences: List[SentenceStat] = []
    suggestions: List[SuggestionFix] = []
    cleaned_draft: str = ""

class SampleCase(BaseModel):
    id: str
    title: str
    category: str
    source_description: str
    text: str
    expected_highlights: List[str]
