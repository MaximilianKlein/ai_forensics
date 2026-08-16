import re
import math
from typing import List, Tuple
from .models import SentenceStat, StylometryMetrics

def split_sentences_with_offsets(text: str) -> List[Tuple[str, int, int]]:
    # Match sentences ending with . ! ? followed by whitespace or end of string, avoiding common abbreviations
    sentence_pattern = re.compile(r"([A-Z0-9\(\"\'\[][^\.\!\?\n]+[\.\!\?]+(?:\s+|\n+|$)|[^\n]+\n+)", re.DOTALL)
    results = []
    
    # Fallback if text doesn't end with standard punctuation
    matches = list(sentence_pattern.finditer(text))
    if not matches:
        if text.strip():
            results.append((text.strip(), 0, len(text)))
        return results
    
    last_end = 0
    for m in matches:
        s_text = m.group(0).strip()
        if s_text:
            results.append((s_text, m.start(), m.end()))
        last_end = m.end()
        
    if last_end < len(text) and text[last_end:].strip():
        results.append((text[last_end:].strip(), last_end, len(text)))
        
    return results

def calculate_stylometry(text: str) -> Tuple[StylometryMetrics, List[SentenceStat]]:
    words = re.findall(r"\b[a-zA-Z0-9\-_]+\b", text)
    total_words = len(words)
    
    raw_sentences = split_sentences_with_offsets(text)
    total_sentences = len(raw_sentences)
    
    if total_words == 0:
        return StylometryMetrics(), []
    
    sentence_lengths = []
    sentence_stats: List[SentenceStat] = []
    
    for idx, (s_text, start, end) in enumerate(raw_sentences):
        s_words = re.findall(r"\b[a-zA-Z0-9\-_]+\b", s_text)
        w_count = len(s_words)
        sentence_lengths.append(w_count)
        sentence_stats.append(SentenceStat(
            index=idx + 1,
            text=s_text,
            word_count=w_count,
            start_char=start,
            end_char=end
        ))
        
    avg_len = sum(sentence_lengths) / max(1, total_sentences)
    variance = sum((l - avg_len) ** 2 for l in sentence_lengths) / max(1, total_sentences)
    std_dev = math.sqrt(variance)
    
    # Burstiness Metric: High std_dev relative to avg_len indicates human burstiness.
    # LLMs have low std_dev (monotonous length around 18-25 words).
    # Burstiness index: std_dev / avg_len (coefficient of variation).
    # Typical Human CV: 0.55 - 0.95+
    # Typical LLM CV: 0.15 - 0.35
    cv = std_dev / max(1.0, avg_len)
    
    # We map this to a 0-100 "Monotony / AI Cadence" scale:
    # CV < 0.25 -> 90+ (Very flat/AI)
    # CV > 0.65 -> 10-20 (Very bursty/Human)
    burstiness_score = max(0.0, min(100.0, (1.0 - min(1.0, cv / 0.70)) * 100.0))
    
    # Type Token Ratio (TTR)
    unique_words = len(set(w.lower() for w in words))
    ttr = unique_words / max(1, total_words)
    
    # Em dashes count
    em_dashes = len(re.findall(r"—|(?<=\s)--(?:[\s])", text))
    
    metrics = StylometryMetrics(
        total_words=total_words,
        total_sentences=total_sentences,
        avg_sentence_length=round(avg_len, 1),
        sentence_length_std=round(std_dev, 1),
        burstiness_score=round(burstiness_score, 1),
        type_token_ratio=round(ttr, 3),
        em_dash_count=em_dashes,
        copula_ratio=0.0,
        ai_vocab_density=0.0
    )
    
    return metrics, sentence_stats
