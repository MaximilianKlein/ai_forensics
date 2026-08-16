import unittest
from server.delta_calibrator import (
    get_recommended_delta_for_name,
    get_prompt_suffix_for_model,
    format_prompt_for_model,
    get_model_profile,
    update_model_profile,
    calibrate_model_delta,
    get_all_calibrated_deltas,
    MODEL_CONFIG_STORE
)

class TestDeltaCalibrator(unittest.TestCase):
    def test_pre_calibrated_models(self):
        # Gemma 4:12b should be ~5.8
        gemma_delta = get_recommended_delta_for_name("gemma4:12b")
        self.assertAlmostEqual(gemma_delta, 5.8, delta=0.5)

        # Qwen 2.5:0.5b should be ~2.0
        qwen_delta = get_recommended_delta_for_name("qwen2.5:0.5b")
        self.assertAlmostEqual(qwen_delta, 2.0, delta=0.2)

    def test_prompt_suffix_and_thinking_bypass(self):
        # Gemma4 should have channel bypass suffix
        gemma_suffix = get_prompt_suffix_for_model("gemma4:12b")
        self.assertIn("<|channel>", gemma_suffix)
        self.assertIn("<channel|>", gemma_suffix)

        # Qwen should have newline suffix
        qwen_suffix = get_prompt_suffix_for_model("qwen2.5:0.5b")
        self.assertEqual(qwen_suffix, "\n")

    def test_format_prompt_for_model(self):
        raw_prompt = "Explain quantum superposition."
        
        # Gemma formatting should append channel bypass
        formatted_gemma = format_prompt_for_model(raw_prompt, "gemma4:12b")
        self.assertTrue(formatted_gemma.startswith("Explain quantum superposition."))
        self.assertTrue(formatted_gemma.endswith("<channel|>\n") or "<channel|>" in formatted_gemma)

        # Qwen formatting should append newline
        formatted_qwen = format_prompt_for_model(raw_prompt, "qwen2.5:0.5b")
        self.assertEqual(formatted_qwen, "Explain quantum superposition.\n")

        # When prompt already ends with newline, avoid duplicate \n\n if suffix is \n
        formatted_qwen_nl = format_prompt_for_model("Hello\n", "qwen2.5:0.5b")
        self.assertEqual(formatted_qwen_nl, "Hello\n")

    def test_update_model_profile(self):
        update_model_profile("custom-gemma", recommended_delta=6.0, prompt_suffix="\n<|channel>\n<channel|>\n", disable_thinking=True)
        profile = get_model_profile("custom-gemma")
        self.assertEqual(profile["recommended_delta"], 6.0)
        self.assertEqual(profile["prompt_suffix"], "\n<|channel>\n<channel|>\n")
        self.assertTrue(profile["disable_thinking"])

    def test_fuzzy_name_matching(self):
        self.assertEqual(get_recommended_delta_for_name("custom-gemma-v2-instruct"), 5.8)
        self.assertEqual(get_recommended_delta_for_name("qwen-plus-finetuned"), 2.0)
        self.assertEqual(get_recommended_delta_for_name("meta-llama-3-8b"), 3.0)

    def test_calibrate_model_delta_returns_explanation(self):
        res = calibrate_model_delta("gemma4:12b", model_instance=None)
        self.assertIn("recommended_delta", res)
        self.assertEqual(res["recommended_delta"], 5.8)
        self.assertIn("explanation", res)

    def test_all_calibrated_deltas(self):
        all_deltas = get_all_calibrated_deltas()
        self.assertIn("gemma4:12b", all_deltas)
        self.assertIn("qwen2.5:0.5b", all_deltas)

if __name__ == "__main__":
    unittest.main()
