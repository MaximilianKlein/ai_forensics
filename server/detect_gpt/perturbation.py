import re
import random
from typing import List, Tuple, Dict, Any, Optional

# Comprehensive synonym and semantic substitution dictionary
SYNONYM_MAP: Dict[str, List[str]] = {
    # Verbs - Communication & Cognition
    "answer": ["response", "reply", "explanation", "solution", "resolution"],
    "answers": ["responses", "replies", "explanations", "solutions"],
    "say": ["state", "mention", "claim", "declare", "remark"],
    "says": ["states", "mentions", "claims", "declares", "remarks"],
    "said": ["stated", "mentioned", "claimed", "declared", "remarked"],
    "think": ["believe", "consider", "assume", "suppose", "deem"],
    "thinks": ["believes", "considers", "assumes", "supposes"],
    "thought": ["reasoning", "reflection", "deliberation", "perspective"],
    "know": ["understand", "recognize", "realize", "comprehend"],
    "knows": ["understands", "recognizes", "realizes", "comprehends"],
    "knew": ["understood", "recognized", "realized"],
    "explain": ["clarify", "describe", "elucidate", "detail", "expound"],
    "explains": ["clarifies", "describes", "elucidates", "details"],
    "explained": ["clarified", "described", "detailed"],
    "describe": ["depict", "characterize", "outline", "portray"],
    "describes": ["depicts", "characterizes", "outlines"],
    "described": ["depicted", "characterized", "outlined"],
    "show": ["demonstrate", "indicate", "reveal", "display", "exhibit"],
    "shows": ["demonstrates", "indicates", "reveals", "displays", "exhibits"],
    "showed": ["demonstrated", "indicated", "revealed", "displayed"],
    "shown": ["demonstrated", "indicated", "revealed", "displayed"],
    "reveal": ["uncover", "expose", "disclose", "manifest"],
    "reveals": ["uncovers", "exposes", "discloses"],
    "indicate": ["suggest", "signify", "point to", "denote"],
    "indicates": ["suggests", "signifies", "points to"],
    "confuse": ["misunderstand", "conflate", "muddle", "bewilder"],
    "confuses": ["misunderstands", "conflates", "muddles"],

    # Verbs - Action, State & Process
    "went": ["proceeded", "progressed", "developed", "unfolded"],
    "go": ["proceed", "progress", "advance", "travel"],
    "goes": ["proceeds", "progresses", "advances"],
    "start": ["begin", "commence", "originate", "initiate"],
    "starts": ["begins", "commences", "originates", "initiates"],
    "started": ["began", "commenced", "originated", "initiated"],
    "fail": ["falter", "underperform", "miscarry", "collapse"],
    "fails": ["falters", "underperforms", "collapses"],
    "failed": ["faltered", "underperformed", "fell short"],
    "pass": ["clear", "succeed in", "complete", "satisfy"],
    "passes": ["clears", "completes", "satisfies"],
    "passed": ["cleared", "completed", "satisfied", "graduated"],
    "graduate": ["complete studies", "finish school", "matriculate"],
    "graduates": ["completes studies", "finishes school"],
    "graduated": ["completed studies", "finished school", "matriculated"],
    "become": ["turn into", "transform into", "grow into", "evolve into"],
    "becomes": ["turns into", "transforms into", "evolves into"],
    "became": ["turned into", "transformed into", "evolved into"],
    "make": ["produce", "create", "construct", "form"],
    "makes": ["produces", "creates", "constructs", "forms"],
    "made": ["produced", "created", "constructed", "formed"],
    "provide": ["offer", "give", "supply", "deliver", "present"],
    "provides": ["offers", "gives", "supplies", "delivers", "presents"],
    "provided": ["offered", "gave", "supplied", "delivered"],
    "use": ["utilize", "employ", "apply", "adopt", "operate"],
    "uses": ["utilizes", "employs", "applies", "adopts"],
    "used": ["utilized", "employed", "applied", "adopted"],
    "allow": ["enable", "permit", "facilitate", "let"],
    "allows": ["enables", "permits", "facilitates", "empowers"],
    "allowed": ["enabled", "permitted", "facilitated"],
    "help": ["assist", "support", "aid", "facilitate"],
    "helps": ["assists", "supports", "aids", "facilitates"],
    "helped": ["assisted", "supported", "aided"],
    "improve": ["enhance", "boost", "advance", "elevate"],
    "improves": ["enhances", "boosts", "advances", "elevates"],
    "improved": ["enhanced", "boosted", "advanced"],
    "create": ["develop", "produce", "build", "generate", "establish"],
    "creates": ["develops", "produces", "builds", "generates"],
    "created": ["developed", "produced", "built", "generated"],
    "include": ["incorporate", "comprise", "encompass", "involve"],
    "includes": ["incorporates", "comprises", "encompasses"],
    "included": ["incorporated", "comprised", "encompassed"],
    "focus": ["center", "concentrate", "emphasize", "target"],
    "focuses": ["centers", "concentrates", "emphasizes", "targets"],
    "focused": ["centered", "concentrated", "emphasized"],
    "stand": ["function", "serve", "remain", "exist"],
    "stands": ["functions", "serves", "remains", "exists"],
    "serve": ["act", "function", "operate", "perform"],
    "serves": ["acts", "functions", "operates", "performs"],

    # Nouns - Education, Academia & Science
    "career": ["profession", "pathway", "journey", "vocation", "history"],
    "careers": ["professions", "pathways", "journeys", "vocations"],
    "breakdown": ["analysis", "overview", "summary", "examination", "review"],
    "exam": ["test", "assessment", "evaluation", "examination"],
    "exams": ["tests", "assessments", "evaluations", "examinations"],
    "examination": ["assessment", "test", "evaluation", "review"],
    "examinations": ["assessments", "tests", "evaluations", "reviews"],
    "class": ["course", "subject", "lecture", "seminar"],
    "classes": ["courses", "subjects", "lectures", "seminars"],
    "school": ["institution", "academy", "college", "gymnasium"],
    "schools": ["institutions", "academies", "colleges"],
    "gymnasium": ["preparatory school", "secondary school", "academy"],
    "subject": ["discipline", "topic", "field", "area", "domain"],
    "subjects": ["disciplines", "topics", "fields", "areas"],
    "topic": ["subject", "theme", "matter", "issue"],
    "topics": ["subjects", "themes", "matters", "issues"],
    "math": ["mathematics", "arithmetic", "computation", "calculus"],
    "mathematics": ["math", "mathematical analysis", "computation"],
    "physics": ["physical science", "theoretical physics", "natural philosophy"],
    "myth": ["misconception", "legend", "fallacy", "rumor", "folklore"],
    "myths": ["misconceptions", "legends", "fallacies", "rumors"],
    "failure": ["shortcoming", "deficiency", "breakdown", "collapse"],
    "failures": ["shortcomings", "deficiencies", "breakdowns"],
    "confusion": ["misunderstanding", "uncertainty", "ambiguity", "conflation"],
    "record": ["document", "archive", "account", "history"],
    "records": ["documents", "archives", "accounts", "historical logs"],
    "student": ["pupil", "scholar", "learner", "apprentice"],
    "students": ["pupils", "scholars", "learners"],
    "teacher": ["instructor", "educator", "professor", "tutor"],
    "teachers": ["instructors", "educators", "professors"],
    "age": ["years", "youth", "stage", "era", "period"],
    "youth": ["early years", "childhood", "adolescence"],
    "system": ["framework", "platform", "mechanism", "structure"],
    "systems": ["frameworks", "platforms", "mechanisms", "structures"],
    "method": ["approach", "technique", "process", "procedure"],
    "methods": ["approaches", "techniques", "processes", "procedures"],
    "result": ["outcome", "finding", "consequence", "effect"],
    "results": ["outcomes", "findings", "consequences", "effects"],
    "way": ["manner", "method", "fashion", "mode", "approach"],
    "ways": ["manners", "methods", "fashions", "modes"],
    "reason": ["explanation", "factor", "rationale", "cause"],
    "reasons": ["explanations", "factors", "rationales", "causes"],
    "person": ["individual", "figure", "scholar", "human"],
    "people": ["individuals", "observers", "scholars", "the public"],

    # Adjectives
    "popular": ["widespread", "common", "prevalent", "widespread", "familiar"],
    "technical": ["specialized", "formal", "literal", "exact", "mechanical"],
    "technically": ["strictly", "formally", "literally", "rigorously"],
    "practical": ["pragmatic", "applied", "functional", "realistic"],
    "practically": ["essentially", "virtually", "effectively", "nearly"],
    "academic": ["scholarly", "educational", "pedagogical", "intellectual"],
    "gifted": ["talented", "exceptional", "brilliant", "skilled", "adept"],
    "young": ["early", "youthful", "adolescent", "juvenile"],
    "bad": ["poor", "deficient", "weak", "inadequate", "subpar"],
    "good": ["strong", "competent", "skilled", "capable", "proficient"],
    "great": ["exceptional", "immense", "profound", "outstanding"],
    "slight": ["minor", "small", "marginal", "modest", "subtle"],
    "high": ["elevated", "secondary", "superior", "advanced"],
    "low": ["modest", "diminished", "reduced", "basic"],
    "important": ["crucial", "vital", "significant", "key", "essential"],
    "crucial": ["vital", "essential", "critical", "important", "pivotal"],
    "significant": ["notable", "substantial", "meaningful", "considerable"],
    "simple": ["basic", "straightforward", "elementary", "plain"],
    "complex": ["intricate", "complicated", "sophisticated", "multifaceted"],
    "difficult": ["hard", "challenging", "demanding", "arduous"],
    "easy": ["simple", "effortless", "straightforward"],
    "effective": ["efficient", "successful", "productive", "potent"],
    "common": ["frequent", "widespread", "prevalent", "typical"],
    "rare": ["uncommon", "scarce", "infrequent", "unusual"],
    "unique": ["distinctive", "singular", "exclusive", "special"],
    "true": ["accurate", "verifiable", "authentic", "correct"],
    "false": ["incorrect", "inaccurate", "untrue", "erroneous"],

    # Adverbs
    "actually": ["in reality", "in fact", "genuinely", "truly", "historically"],
    "really": ["truly", "genuinely", "certainly", "indeed"],
    "highly": ["exceptionally", "extremely", "remarkably", "greatly"],
    "successfully": ["effectively", "triumphantly", "without issue", "competently"],
    "slightly": ["somewhat", "mildly", "a bit", "fractionally"],
    "frequently": ["often", "regularly", "repeatedly", "routinely"],
    "rarely": ["seldom", "infrequently", "scarcely"],
    "clearly": ["evidently", "plainly", "distinctly", "manifestly"],
    "consistently": ["steadily", "reliably", "regularly", "uniformly"],
    "greatly": ["substantially", "significantly", "considerably", "vastly"],
    "widely": ["broadly", "extensively", "universally", "commonly"],
    "rapidly": ["quickly", "swiftly", "fast", "promptly"],
    "primarily": ["mainly", "chiefly", "predominantly", "principally"],
}

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could",
    "will", "would", "shall", "should", "may", "might", "must", "it", "its", "they",
    "them", "their", "this", "that", "these", "those", "which", "who", "whom", "what",
    "he", "she", "his", "her", "him", "my", "your", "our", "there", "here"
}

def perturb_text(
    text: str,
    perturbation_pct: float = 0.15,
    seed: Optional[int] = None
) -> Tuple[str, List[Dict[str, str]]]:
    """
    Generates a single perturbed sample of input text by replacing a random
    subset of words (target ~15%) with semantically plausible synonyms or
    paraphrases while preserving grammar.
    """
    if seed is not None:
        rng = random.Random(seed)
    else:
        rng = random.Random()

    # Split text into tokens while preserving punctuation, tags, and whitespace
    token_pattern = re.compile(r"(\b[a-zA-Z0-9\-_’']+\b|[^\w\s]+|\s+)")
    raw_tokens = token_pattern.findall(text)
    
    # 1. Identify all eligible candidate words
    direct_candidates: List[int] = []
    fallback_candidates: List[int] = []

    for i, token in enumerate(raw_tokens):
        # Ignore markdown symbols, XML tags like <|channel>, numbers
        if re.match(r"^[a-zA-Z]+$", token):
            lower = token.lower()
            if lower in SYNONYM_MAP:
                direct_candidates.append(i)
            elif lower not in STOPWORDS and len(token) >= 3:
                fallback_candidates.append(i)

    # Determine number of words to mutate (at least 15% of all content words)
    total_content_words = len(direct_candidates) + len(fallback_candidates)
    num_to_mutate = max(2, int(total_content_words * perturbation_pct))
    
    # Prioritize direct synonym matches, fill remainder from fallback
    selected_indices: List[int] = []
    if direct_candidates:
        take_direct = min(len(direct_candidates), num_to_mutate)
        selected_indices.extend(rng.sample(direct_candidates, take_direct))
    
    remaining = num_to_mutate - len(selected_indices)
    if remaining > 0 and fallback_candidates:
        take_fallback = min(len(fallback_candidates), remaining)
        selected_indices.extend(rng.sample(fallback_candidates, take_fallback))

    selected_indices.sort()
    mutated_tokens = list(raw_tokens)
    mutations: List[Dict[str, str]] = []

    for idx in selected_indices:
        orig = raw_tokens[idx]
        lower = orig.lower()
        replacement = orig
        
        if lower in SYNONYM_MAP:
            syns = SYNONYM_MAP[lower]
            cand_syns = [s for s in syns if s.lower() != lower]
            if cand_syns:
                replacement = rng.choice(cand_syns)
        else:
            # Fallback morphological/contextual mutation for words not in main dictionary
            if lower.endswith("ly") and len(lower) > 5:
                replacement = lower[:-2]  # e.g., quickly -> quick
            elif lower.endswith("ing") and len(lower) > 5:
                replacement = lower[:-3] + "ed"  # e.g., playing -> played
            elif lower.endswith("ed") and len(lower) > 4:
                replacement = lower[:-2] + "ing"
            elif lower.endswith("s") and len(lower) > 4:
                replacement = lower[:-1]
            else:
                # General semantic modifier or synonym token
                generic_alts = ["particular", "general", "notable", "specific", "primary", "relevant"]
                replacement = rng.choice(generic_alts)

        if replacement != orig:
            # Preserve original casing
            if orig.isupper():
                replacement = replacement.upper()
            elif orig[0].isupper():
                replacement = replacement.capitalize()
                
            mutated_tokens[idx] = replacement
            mutations.append({"original": orig, "replacement": replacement})

    perturbed_str = "".join(mutated_tokens)
    return perturbed_str, mutations

def generate_perturbations(
    text: str,
    k: int = 10,
    perturbation_pct: float = 0.15,
    base_seed: int = 42
) -> List[Tuple[str, List[Dict[str, str]]]]:
    """
    Generates k distinct perturbations of the input text.
    """
    results: List[Tuple[str, List[Dict[str, str]]]] = []
    for i in range(k):
        seed = base_seed + i * 1013 + len(text)
        pert_text, muts = perturb_text(text, perturbation_pct=perturbation_pct, seed=seed)
        results.append((pert_text, muts))
    return results
