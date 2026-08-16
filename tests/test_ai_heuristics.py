import unittest
from server.ai_heuristics import (
    analyze_text,
    get_preset_samples,
    AnalysisResult
)
from server.ai_heuristics.citations import validate_isbn10, validate_isbn13

class TestAIHeuristics(unittest.TestCase):
    def test_empty_text(self):
        result = analyze_text("")
        self.assertEqual(result.radar_scores.overall_ai_score, 0.0)
        self.assertEqual(len(result.hits), 0)

    def test_machine_artifacts_chatgpt_search(self):
        text = "This topic has been discussed extensively turn0search1 in recent literature."
        result = analyze_text(text)
        self.assertTrue(any(h.rule_id == "leak_chatgpt_search" for h in result.hits))
        self.assertEqual(result.radar_scores.confidence_tier, "definitive_machine_leak")
        self.assertGreaterEqual(result.radar_scores.machine_artifacts, 90.0)

    def test_machine_artifacts_deepseek(self):
        text = "Recent breakthroughs have shown great promise 【1†source】 in quantum computing."
        result = analyze_text(text)
        self.assertTrue(any(h.rule_id == "leak_deepseek_citation" for h in result.hits))
        self.assertEqual(result.radar_scores.confidence_tier, "definitive_machine_leak")

    def test_machine_artifacts_gemini(self):
        text = "This mechanism was discovered in 2023 [cite: 1, 3] by researchers."
        result = analyze_text(text)
        self.assertTrue(any(h.rule_id == "leak_gemini_cite" for h in result.hits))

    def test_conversational_intro_outro(self):
        text = "Certainly! Here is an overview of the topic:\n\nThe topic is important.\n\nI hope this helps! Let me know if you need more info."
        result = analyze_text(text)
        self.assertTrue(any(h.rule_id == "bleed_conversational_intro" for h in result.hits))
        self.assertTrue(any(h.rule_id == "bleed_conversational_outro" for h in result.hits))

    def test_ai_vocabulary_and_copula_avoidance(self):
        text = "The museum stands as a testament to regional art, delving into intricate tapestries and serving as a beacon of culture."
        result = analyze_text(text)
        hit_rules = [h.rule_id for h in result.hits]
        self.assertIn("copula_avoidance", hit_rules)
        self.assertTrue(any("ai_vocab" in r for r in hit_rules))

    def test_negative_parallelisms_suite(self):
        cases = [
            ("The initiative was not only a technical milestone, but also a cultural movement.", "syntax_not_only_but_also"),
            ("It was not just an administrative office, but also a symbol of regional independence.", "syntax_not_only_but_also"),
            ("The project focuses not on speed, but on safety and long-term reliability.", "syntax_not_prep_but_prep"),
            ("It serves not as a replacement, but as an essential complement to the framework.", "syntax_not_prep_but_prep"),
            ("The design utilized rotary cooling, rather than stationary liquid jackets.", "syntax_x_rather_than_y"),
            ("Rather than simply following convention, the design introduced novel aerodynamics.", "syntax_rather_than_intro"),
            ("Instead of relying on legacy protocols, the system employs modern cryptography.", "syntax_instead_of_intro"),
            ("This architecture is more than just a tool; it is a foundational ecosystem.", "syntax_more_than_just"),
            ("The museum is not a commercial enterprise, but an educational foundation.", "syntax_not_prep_but_prep")
        ]
        for text, expected_rule in cases:
            res = analyze_text(text)
            syntax_hits = [h for h in res.hits if h.category == "rhetorical_syntax"]
            self.assertTrue(
                any(expected_rule in h.rule_id for h in syntax_hits),
                f"Failed to detect negative parallelism in: '{text}'. Detected hits: {[h.rule_id for h in syntax_hits]}"
            )

    def test_puffery_and_significance(self):
        text = "The organization was established in 1995, marking a pivotal moment in the evolution of modern banking."
        result = analyze_text(text)
        self.assertTrue(any(h.rule_id == "puffery_pivotal_moment" for h in result.hits))

    def test_isbn_validation(self):
        valid_10 = "0-306-40615-2"
        invalid_10 = "0-306-40615-3"
        valid_13 = "978-0-306-40615-7"
        invalid_13 = "978-0-306-40615-8"
        self.assertTrue(validate_isbn10(valid_10))
        self.assertFalse(validate_isbn10(invalid_10))
        self.assertTrue(validate_isbn13(valid_13))
        self.assertFalse(validate_isbn13(invalid_13))

    def test_clean_human_sample(self):
        samples = get_preset_samples()
        human_sample = next(s for s in samples if s.id == "sample_human_neutral")
        result = analyze_text(human_sample.text)
        self.assertEqual(result.radar_scores.confidence_tier, "low_evidence")
        self.assertLess(result.radar_scores.overall_ai_score, 25.0)

    def test_cleaned_draft_generation(self):
        text = "Certainly! Here is an overview:\n\nThe building serves as a museum turn0search0."
        result = analyze_text(text)
        self.assertNotIn("turn0search0", result.cleaned_draft)
        self.assertNotIn("Certainly!", result.cleaned_draft)

if __name__ == "__main__":
    unittest.main()
