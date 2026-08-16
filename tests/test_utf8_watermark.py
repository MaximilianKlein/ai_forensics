import unittest
from server.utf8_watermark import (
    embed_invisible_watermark,
    verify_invisible_watermark,
    strip_zero_width,
    reveal_zero_width,
    string_to_zw,
    zw_to_string,
    get_utf8_presets
)

class TestUTF8Watermark(unittest.TestCase):
    def test_zw_string_roundtrip(self):
        payload = "Model: Gemma-4 | License: Apache-2.0 | Time: 2026-08-16"
        zw_encoded = string_to_zw(payload)
        self.assertGreater(len(zw_encoded), 10)
        # Verify characters are zero-width
        for c in zw_encoded:
            self.assertIn(c, {"\u200b", "\u200c", "\u200d", "\u2060"})
        
        decoded = zw_to_string(zw_encoded)
        self.assertEqual(decoded, payload)

    def test_embed_and_verify_intact_text(self):
        text = "The quick brown fox jumps over the lazy dog in the sunny backyard."
        payload = "AUTH-SIG:99812"
        res = embed_invisible_watermark(text, payload=payload, block_word_size=3)
        
        self.assertNotEqual(res.watermarked_text, text)
        self.assertEqual(strip_zero_width(res.watermarked_text), text)
        self.assertGreater(res.hidden_char_count, 0)
        self.assertGreater(res.total_blocks, 1)

        # Verify
        v_res = verify_invisible_watermark(res.watermarked_text)
        self.assertTrue(v_res.is_watermarked)
        self.assertEqual(v_res.payload_extracted, payload)
        self.assertEqual(v_res.verdict, "intact")
        self.assertEqual(v_res.integrity_score, 100.0)
        self.assertEqual(v_res.tampered_blocks, 0)
        self.assertEqual(v_res.verified_blocks, res.total_blocks)

    def test_block_tamper_localization(self):
        text = (
            "Apollo 11 landed on the Moon on July 20, 1969. "
            "Neil Armstrong and Buzz Aldrin walked on the lunar surface. "
            "Michael Collins flew the command module Columbia in orbit."
        )
        res = embed_invisible_watermark(text, payload="APOLLO-FLIGHT", block_word_size=4)
        
        # Tamper: Alter "Apollo 11" to "Apollo 13" in Block 0
        tampered_text = res.watermarked_text.replace("Apollo 11", "Apollo 13")
        
        v_res = verify_invisible_watermark(tampered_text)
        self.assertTrue(v_res.is_watermarked)
        self.assertEqual(v_res.payload_extracted, "APOLLO-FLIGHT")
        self.assertGreater(v_res.tampered_blocks, 0)
        self.assertLess(v_res.integrity_score, 100.0)
        
        # Verify that Block 0 was flagged as tampered, and later blocks are verified
        block_0 = v_res.blocks[0]
        self.assertEqual(block_0.status, "tampered")
        self.assertIn("Apollo 13", block_0.block_text)
        
        # Later blocks remain verified
        verified_blocks = [b for b in v_res.blocks if b.status == "verified"]
        self.assertGreater(len(verified_blocks), 0)

    def test_non_watermarked_text(self):
        plain_text = "This is ordinary human text with no invisible zero-width characters whatsoever."
        v_res = verify_invisible_watermark(plain_text)
        self.assertFalse(v_res.is_watermarked)
        self.assertEqual(v_res.verdict, "not_watermarked")
        self.assertEqual(v_res.hidden_char_count, 0)

    def test_reveal_zero_width(self):
        zw = "\u200b\u200c\u200d\u2060"
        rev = reveal_zero_width(f"Hello{zw}World")
        self.assertIn("[ZWSP]", rev)
        self.assertIn("[ZWNJ]", rev)
        self.assertIn("[ZWJ]", rev)
        self.assertIn("[WJ]", rev)

    def test_lightweight_block_parity_mode_without_header(self):
        text = "Deep learning transformers utilize multi-head self-attention mechanisms to process tokens in parallel."
        # Embed with empty payload (lightweight mode)
        res = embed_invisible_watermark(text, payload="", block_word_size=3)
        
        self.assertNotEqual(res.watermarked_text, text)
        self.assertEqual(strip_zero_width(res.watermarked_text), text)
        self.assertGreater(res.total_blocks, 1)
        
        # Verify that blocks are verified even without a global payload header
        v_res = verify_invisible_watermark(res.watermarked_text)
        self.assertTrue(v_res.is_watermarked)
        self.assertIsNone(v_res.payload_extracted)
        self.assertEqual(v_res.verdict, "intact")
        self.assertEqual(v_res.integrity_score, 100.0)
        self.assertEqual(v_res.tampered_blocks, 0)
        self.assertEqual(v_res.verified_blocks, res.total_blocks)

    def test_presets(self):
        presets = get_utf8_presets()
        self.assertGreaterEqual(len(presets), 3)
        intact = [p for p in presets if not p.is_tampered]
        tampered = [p for p in presets if p.is_tampered]
        self.assertGreater(len(intact), 0)
        self.assertGreater(len(tampered), 0)

if __name__ == "__main__":
    unittest.main()
