import re
from typing import List
from .models import HeuristicHit

def validate_isbn10(isbn: str) -> bool:
    clean = isbn.replace("-", "").replace(" ", "").upper()
    if len(clean) != 10:
        return False
    total = 0
    for i in range(9):
        if not clean[i].isdigit():
            return False
        total += int(clean[i]) * (10 - i)
    check = 10 if clean[9] == "X" else (int(clean[9]) if clean[9].isdigit() else -1)
    if check == -1:
        return False
    total += check
    return total % 11 == 0

def validate_isbn13(isbn: str) -> bool:
    clean = isbn.replace("-", "").replace(" ", "")
    if len(clean) != 13 or not clean.isdigit():
        return False
    total = 0
    for i in range(12):
        weight = 1 if i % 2 == 0 else 3
        total += int(clean[i]) * weight
    check = (10 - (total % 10)) % 10
    return check == int(clean[12])

def find_citation_hits(text: str) -> List[HeuristicHit]:
    hits: List[HeuristicHit] = []

    # 1. Broken DOI patterns (e.g. invalid prefix or malformed structure)
    doi_pattern = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", re.IGNORECASE)
    for match in doi_pattern.finditer(text):
        doi = match.group(0)
        # Check for obvious hallucinated DOI patterns (e.g. placeholder numbers)
        if re.search(r"10\.1000/182|10\.1234/|10\.0000/|10\.9999/", doi):
            hits.append(HeuristicHit(
                rule_id="citation_suspicious_doi",
                category="citations_integrity",
                rule_name="Suspicious / Placeholder DOI",
                severity="critical",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=doi,
                explanation="This DOI matches known dummy or placeholder prefixes frequently hallucinated by LLMs.",
                suggestion="",
                confidence=0.95
            ))

    # 2. ISBN Checksum validation
    isbn_pattern = re.compile(r"\bISBN(?:-1[03])?:?\s*([0-9Xx\-\s]{10,17})\b", re.IGNORECASE)
    for match in isbn_pattern.finditer(text):
        raw_isbn = match.group(1).strip()
        clean = raw_isbn.replace("-", "").replace(" ", "")
        is_valid = False
        if len(clean) == 10:
            is_valid = validate_isbn10(raw_isbn)
        elif len(clean) == 13:
            is_valid = validate_isbn13(raw_isbn)
        
        if not is_valid and len(clean) in (10, 13):
            hits.append(HeuristicHit(
                rule_id="citation_invalid_isbn",
                category="citations_integrity",
                rule_name="Invalid ISBN Checksum (Hallucination)",
                severity="critical",
                start_char=match.start(),
                end_char=match.end(),
                matched_text=match.group(0),
                explanation=f"The ISBN '{raw_isbn}' has an invalid mathematical check digit, indicating a likely hallucinated citation.",
                suggestion=None,
                confidence=0.98
            ))

    # 3. Book citations without page numbers or URLs
    generic_citation_pattern = re.compile(
        r"\b(?:published\s+by\s+[A-Z][a-zA-Z\s]+(?:Press|Publishing|Books),?\s+(?:19|20)\d{2}\b)(?!\s*,\s*pp?\.\s*\d+)",
        re.IGNORECASE
    )
    for match in generic_citation_pattern.finditer(text):
        hits.append(HeuristicHit(
            rule_id="citation_generic_book_reference",
            category="citations_integrity",
            rule_name="Book Citation Without Page Numbers",
            severity="info",
            start_char=match.start(),
            end_char=match.end(),
            matched_text=match.group(0),
            explanation="Generic book reference without specific page numbers or chapter citations.",
            suggestion=None,
            confidence=0.70
        ))

    return hits
