import unittest
from server.detect_gpt import (
    perturb_text,
    generate_perturbations,
    compute_text_log_prob,
    get_detect_gpt_presets,
    run_detect_gpt,
    DetectGPTResult
)

class TestDetectGPT(unittest.TestCase):
    def test_perturbation_generation(self):
        text = "This complex system provides an important method that demonstrates clear results and enhances development."
        pert_text, muts = perturb_text(text, perturbation_pct=0.25, seed=123)
        
        self.assertIsInstance(pert_text, str)
        self.assertGreater(len(pert_text), 10)
        self.assertGreater(len(muts), 0)
        
        # Test batch perturbations
        k_perts = generate_perturbations(text, k=5, perturbation_pct=0.20)
        self.assertEqual(len(k_perts), 5)
        for p_str, p_muts in k_perts:
            self.assertIsInstance(p_str, str)
            self.assertGreater(len(p_str), 0)

    def test_evaluator(self):
        text = "Quantum computing enables rapid exploration of complex states."
        total_lp, avg_lp, ppl, num_toks = compute_text_log_prob(text)
        
        self.assertLess(total_lp, 0.0)
        self.assertLess(avg_lp, 0.0)
        self.assertGreater(ppl, 1.0)
        self.assertGreater(num_toks, 0)

    def test_detect_gpt_empty_text(self):
        res = run_detect_gpt("")
        self.assertEqual(res.num_tokens, 0)
        self.assertEqual(res.discrepancy_score, 0.0)
        self.assertEqual(res.z_score, 0.0)

    def test_detect_gpt_ai_sample_positive_discrepancy(self):
        ai_text = (
            "Quantum superposition is a fundamental principle of quantum mechanics that allows physical systems to exist "
            "in multiple distinct states simultaneously. Unlike classical bits in conventional computing, which must strictly "
            "represent either a zero or a one, quantum bits can represent arbitrary linear combinations of both basis states."
        )
        res = run_detect_gpt(ai_text, num_perturbations=8, perturbation_pct=0.15)
        
        self.assertIsInstance(res, DetectGPTResult)
        self.assertEqual(res.num_perturbations, 8)
        self.assertGreater(len(res.perturbations), 0)
        self.assertGreater(len(res.curve_points), 0)
        self.assertGreater(len(res.histogram), 0)
        # Check that metrics are calculated
        self.assertIsInstance(res.z_score, float)
        self.assertIsInstance(res.discrepancy_score, float)

    def test_detect_gpt_presets(self):
        presets = get_detect_gpt_presets()
        self.assertGreaterEqual(len(presets), 4)
        ai_presets = [p for p in presets if p.category == "ai_generated"]
        human_presets = [p for p in presets if p.category == "human_written"]
        self.assertGreater(len(ai_presets), 0)
        self.assertGreater(len(human_presets), 0)

if __name__ == "__main__":
    unittest.main()
