import unittest
import numpy as np
from server.watermark import (
    WatermarkConfig,
    WatermarkLogitsProcessor,
    detect_watermark,
    get_green_list,
    compute_hash_seed
)

class TestWatermarkLogic(unittest.TestCase):
    def setUp(self):
        self.vocab_size = 1000
        self.config = WatermarkConfig(gamma=0.25, delta=2.0, hash_key=15485863, context_width=1)

    def test_deterministic_green_list(self):
        context = [42]
        green_set_1 = get_green_list(self.vocab_size, context, self.config.gamma, self.config.hash_key)
        green_set_2 = get_green_list(self.vocab_size, context, self.config.gamma, self.config.hash_key)
        self.assertEqual(green_set_1, green_set_2)
        self.assertEqual(len(green_set_1), int(self.vocab_size * self.config.gamma))

    def test_logits_processor_bias(self):
        processor = WatermarkLogitsProcessor(self.vocab_size, self.config)
        logits = np.zeros(self.vocab_size, dtype=np.float32)
        input_ids = [10, 20]
        
        modified_logits = processor(input_ids, logits.copy())
        
        green_set = get_green_list(self.vocab_size, [20], self.config.gamma, self.config.hash_key)
        for i in range(self.vocab_size):
            if i in green_set:
                self.assertAlmostEqual(modified_logits[i], self.config.delta)
            else:
                self.assertAlmostEqual(modified_logits[i], 0.0)

    def test_detector_statistics(self):
        # Create a mock tokenizer decode function
        mock_decode = lambda ids: f"tok_{ids[0]}"
        
        # 1. Perfectly watermarked sequence where every token is picked from green list
        tokens = [100]
        for _ in range(50):
            last_tok = tokens[-1]
            green_set = list(get_green_list(self.vocab_size, [last_tok], self.config.gamma, self.config.hash_key))
            tokens.append(green_set[0]) # pick a green token
            
        result_watermarked = detect_watermark(tokens, mock_decode, self.vocab_size, self.config)
        self.assertEqual(result_watermarked.evaluated_tokens, 50)
        self.assertEqual(result_watermarked.green_tokens, 50)
        self.assertEqual(result_watermarked.green_fraction, 1.0)
        self.assertTrue(result_watermarked.z_score > 6.0)
        self.assertTrue(result_watermarked.is_watermarked)

        # 2. Random / unwatermarked sequence
        np.random.seed(42)
        random_tokens = np.random.randint(0, self.vocab_size, size=100).tolist()
        result_random = detect_watermark(random_tokens, mock_decode, self.vocab_size, self.config)
        # Should be roughly gamma (0.25) with small z-score
        self.assertTrue(result_random.z_score < 3.0)
        self.assertFalse(result_random.is_watermarked)

if __name__ == '__main__':
    unittest.main()
