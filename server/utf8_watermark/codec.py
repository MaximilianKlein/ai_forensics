import re
import hashlib
import zlib
from typing import List, Tuple, Optional, Dict, Any
from .models import (
    BlockParityDetail,
    UTF8EmbedResult,
    UTF8VerifyResult
)

# Zero-width alphabet for 2-bit (base-4) encoding
ZW_MAP_ENC = {
    0: "\u200b",  # Zero-Width Space (00)
    1: "\u200c",  # Zero-Width Non-Joiner (01)
    2: "\u200d",  # Zero-Width Joiner (10)
    3: "\u2060",  # Word Joiner (11)
}

ZW_MAP_DEC = {
    "\u200b": 0,
    "\u200c": 1,
    "\u200d": 2,
    "\u2060": 3,
}

# Framing delimiters using BOM prefix
HEADER_START = "\ufeff\u200b"
HEADER_END = "\ufeff\u200c"
BLOCK_TAG_START = "\ufeff\u200d"
BLOCK_TAG_END = "\ufeff\u2060"

ALL_ZERO_WIDTH_CHARS = {"\u200b", "\u200c", "\u200d", "\u2060", "\ufeff"}

def bytes_to_zw(data: bytes) -> str:
    """Converts arbitrary bytes into a zero-width string (4 zero-width chars per byte)."""
    out = []
    for b in data:
        out.append(ZW_MAP_ENC[(b >> 6) & 3])
        out.append(ZW_MAP_ENC[(b >> 4) & 3])
        out.append(ZW_MAP_ENC[(b >> 2) & 3])
        out.append(ZW_MAP_ENC[b & 3])
    return "".join(out)

def zw_to_bytes(zw_str: str) -> Optional[bytes]:
    """Converts a zero-width string back into raw bytes."""
    indices = [ZW_MAP_DEC[c] for c in zw_str if c in ZW_MAP_DEC]
    if len(indices) % 4 != 0:
        return None
    out = bytearray()
    for i in range(0, len(indices), 4):
        b = (indices[i] << 6) | (indices[i + 1] << 4) | (indices[i + 2] << 2) | indices[i + 3]
        out.append(b)
    return bytes(out)

def string_to_zw(s: str) -> str:
    """Encodes a string into zero-width representation with 16-bit CRC checksum."""
    data = s.encode("utf-8")
    crc = zlib.crc32(data) & 0xFFFF
    payload_with_crc = crc.to_bytes(2, "big") + data
    return bytes_to_zw(payload_with_crc)

def zw_to_string(zw_str: str) -> Optional[str]:
    """Decodes a zero-width string back to UTF-8 text and verifies 16-bit CRC checksum."""
    raw = zw_to_bytes(zw_str)
    if not raw or len(raw) < 2:
        return None
    crc_expected = int.from_bytes(raw[:2], "big")
    data = raw[2:]
    crc_actual = zlib.crc32(data) & 0xFFFF
    if crc_expected != crc_actual:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None

def strip_zero_width(text: str) -> str:
    """Removes all zero-width characters and BOM markers."""
    return "".join(c for c in text if c not in ALL_ZERO_WIDTH_CHARS)

def reveal_zero_width(text: str) -> str:
    """Replaces invisible characters with readable visual glyph tags."""
    replacements = {
        "\u200b": "[ZWSP]",
        "\u200c": "[ZWNJ]",
        "\u200d": "[ZWJ]",
        "\u2060": "[WJ]",
        "\ufeff": "[BOM]"
    }
    out = []
    for c in text:
        if c in replacements:
            out.append(replacements[c])
        else:
            out.append(c)
    return "".join(out)

def compute_block_hash(clean_text: str, block_index: int, secret_key: int) -> str:
    """Computes a compact 4-hex-digit (16-bit) parity hash of a block's text."""
    normalized = re.sub(r"\s+", " ", clean_text).strip().lower()
    raw = f"{secret_key}:{block_index}:{normalized}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:4]

def embed_invisible_watermark(
    text: str,
    payload: str = "AUTHENTIC_LLM_GEN_v1",
    block_word_size: int = 4,
    secret_key: int = 1337
) -> UTF8EmbedResult:
    """
    Partitions text into word blocks, generates parity hashes for each block,
    and embeds the global payload + per-block parity tags using invisible zero-width characters.
    """
    clean_text = strip_zero_width(text)
    if not clean_text.strip():
        return UTF8EmbedResult(
            original_text=text,
            watermarked_text="",
            payload=payload,
            block_word_size=block_word_size,
            total_blocks=0,
            hidden_char_count=0,
            revealed_text="",
            summary="Empty text provided for watermarking.",
            blocks=[]
        )

    # 1. Encode Global Payload Header (Optional: only if payload provided)
    watermarked_parts: List[str] = []
    clean_payload = (payload or "").strip()
    if clean_payload:
        encoded_payload = string_to_zw(clean_payload)
        global_header = f"{HEADER_START}{encoded_payload}{HEADER_END}"
        watermarked_parts.append(global_header)

    # 2. Tokenize text into words with preserved punctuation and spacing
    tokens = re.findall(r"(\S+|\s+)", clean_text)
    
    # Group tokens into word blocks
    blocks_raw: List[List[str]] = []
    current_block: List[str] = []
    word_count = 0

    for tok in tokens:
        current_block.append(tok)
        if not tok.isspace():
            word_count += 1
            if word_count >= block_word_size:
                blocks_raw.append(current_block)
                current_block = []
                word_count = 0

    if current_block:
        if blocks_raw:
            # If trailing block has no words, merge with previous
            has_words = any(not t.isspace() for t in current_block)
            if not has_words:
                blocks_raw[-1].extend(current_block)
            else:
                blocks_raw.append(current_block)
        else:
            blocks_raw.append(current_block)

    # 3. Build watermarked text with per-block parity tags
    block_details: List[BlockParityDetail] = []
    current_char_offset = 0

    for idx, blk_tokens in enumerate(blocks_raw):
        blk_str = "".join(blk_tokens)
        blk_hash = compute_block_hash(blk_str, idx, secret_key)
        
        # Tag format: "index:hash" -> e.g. "0:a4f1"
        tag_str = f"{idx}:{blk_hash}"
        zw_tag = string_to_zw(tag_str)
        tag_block = f"{BLOCK_TAG_START}{zw_tag}{BLOCK_TAG_END}"

        start_offset = current_char_offset
        end_offset = start_offset + len(blk_str)
        current_char_offset = end_offset

        block_details.append(BlockParityDetail(
            block_index=idx,
            block_text=blk_str,
            clean_text=blk_str.strip(),
            start_char=start_offset,
            end_char=end_offset,
            expected_hash=blk_hash,
            actual_hash=blk_hash,
            status="verified",
            explanation=f"Block #{idx + 1}: Parity hash verified intact (Tag: {blk_hash})."
        ))

        # Insert tag at the end of block text
        watermarked_parts.append(blk_str)
        watermarked_parts.append(tag_block)

    final_watermarked_text = "".join(watermarked_parts)
    hidden_count = sum(1 for c in final_watermarked_text if c in ALL_ZERO_WIDTH_CHARS)
    revealed = reveal_zero_width(final_watermarked_text)

    return UTF8EmbedResult(
        original_text=clean_text,
        watermarked_text=final_watermarked_text,
        payload=payload,
        block_word_size=block_word_size,
        total_blocks=len(block_details),
        hidden_char_count=hidden_count,
        revealed_text=revealed,
        summary=(
            f"Successfully embedded invisible UTF-8 watermark ({hidden_count} hidden zero-width glyphs) "
            f"across {len(block_details)} parity blocks with payload: '{payload}'."
        ),
        blocks=block_details
    )

def verify_invisible_watermark(
    text: str,
    secret_key: int = 1337
) -> UTF8VerifyResult:
    """
    Extracts global payload and verifies block-by-block cryptographic parity tags.
    Identifies exact blocks that have been tampered with or modified.
    """
    if not text:
        return UTF8VerifyResult(
            is_watermarked=False,
            payload_extracted=None,
            total_blocks=0,
            verified_blocks=0,
            tampered_blocks=0,
            unwatermarked_blocks=0,
            integrity_score=0.0,
            verdict="not_watermarked",
            blocks=[],
            revealed_text="",
            hidden_char_count=0,
            summary="Empty text provided."
        )

    hidden_count = sum(1 for c in text if c in ALL_ZERO_WIDTH_CHARS)

    # 1. Extract Global Payload Header
    header_pattern = re.compile(re.escape(HEADER_START) + r"([\u200b-\u2060]+)" + re.escape(HEADER_END))
    header_match = header_pattern.search(text)
    extracted_payload: Optional[str] = None
    if header_match:
        extracted_payload = zw_to_string(header_match.group(1))

    # Strip out global header to process block stream
    text_without_header = header_pattern.sub("", text)

    # 2. Extract Block Parity Tags & Partition Text
    block_pattern = re.compile(re.escape(BLOCK_TAG_START) + r"([\u200b-\u2060]+)" + re.escape(BLOCK_TAG_END))
    
    # Split text into segments ending at each block tag
    segments: List[Tuple[str, Optional[str]]] = []
    last_end = 0
    for match in block_pattern.finditer(text_without_header):
        blk_text_with_zw = text_without_header[last_end:match.start()]
        blk_text_clean = strip_zero_width(blk_text_with_zw)
        tag_zw = match.group(1)
        tag_str = zw_to_string(tag_zw)
        segments.append((blk_text_clean, tag_str))
        last_end = match.end()

    # Trailing un-tagged text
    trailing = text_without_header[last_end:]
    trailing_clean = strip_zero_width(trailing)

    if not segments and not header_match:
        return UTF8VerifyResult(
            is_watermarked=False,
            payload_extracted=None,
            total_blocks=0,
            verified_blocks=0,
            tampered_blocks=0,
            unwatermarked_blocks=0,
            integrity_score=0.0,
            verdict="not_watermarked",
            blocks=[],
            revealed_text=reveal_zero_width(text),
            hidden_char_count=hidden_count,
            summary="No zero-width watermark or parity markers detected in this text."
        )

    # 3. Evaluate each block's cryptographic parity
    block_details: List[BlockParityDetail] = []
    verified_count = 0
    tampered_count = 0
    unwatermarked_count = 0
    cur_char = 0

    for i, (blk_str, tag_str) in enumerate(segments):
        start_char = cur_char
        end_char = start_char + len(blk_str)
        cur_char = end_char

        if tag_str and ":" in tag_str:
            parts = tag_str.split(":", 1)
            try:
                embedded_idx = int(parts[0])
                embedded_hash = parts[1]
            except ValueError:
                embedded_idx = i
                embedded_hash = ""

            computed_hash = compute_block_hash(blk_str, embedded_idx, secret_key)
            if computed_hash == embedded_hash:
                status = "verified"
                verified_count += 1
                explanation = f"Block #{i + 1}: Intact (Expected Hash {embedded_hash} matches text)."
            else:
                status = "tampered"
                tampered_count += 1
                explanation = f"Block #{i + 1}: TAMPERED! Tag hash {embedded_hash} != computed {computed_hash}. Content was modified."
        else:
            status = "tampered"
            tampered_count += 1
            computed_hash = compute_block_hash(blk_str, i, secret_key)
            embedded_hash = "CORRUPT"
            explanation = f"Block #{i + 1}: Corrupt parity tag detected."

        block_details.append(BlockParityDetail(
            block_index=i,
            block_text=blk_str,
            clean_text=blk_str.strip(),
            start_char=start_char,
            end_char=end_char,
            expected_hash=embedded_hash,
            actual_hash=computed_hash,
            status=status,
            explanation=explanation
        ))

    # Add trailing unwatermarked text if present
    if trailing_clean.strip():
        unwatermarked_count += 1
        block_details.append(BlockParityDetail(
            block_index=len(segments),
            block_text=trailing_clean,
            clean_text=trailing_clean.strip(),
            start_char=cur_char,
            end_char=cur_char + len(trailing_clean),
            expected_hash="NONE",
            actual_hash="NONE",
            status="unwatermarked",
            explanation="Unwatermarked text appended at the end of the document."
        ))

    total_blocks = len(block_details)
    integrity_score = round((verified_count / max(1, total_blocks)) * 100.0, 1)

    if integrity_score == 100.0:
        verdict = "intact"
        summary = f"100% Integrity Verified: All {total_blocks} blocks are authentic and completely unaltered."
    elif integrity_score >= 60.0:
        verdict = "partially_tampered"
        summary = f"Partial Tampering Detected ({integrity_score}% intact): {tampered_count} of {total_blocks} blocks were edited, deleted, or replaced."
    else:
        verdict = "severely_tampered"
        summary = f"Severe Tampering Detected ({integrity_score}% intact): {tampered_count} blocks altered. Integrity compromised."

    return UTF8VerifyResult(
        is_watermarked=True,
        payload_extracted=extracted_payload,
        total_blocks=total_blocks,
        verified_blocks=verified_count,
        tampered_blocks=tampered_count,
        unwatermarked_blocks=unwatermarked_count,
        integrity_score=integrity_score,
        verdict=verdict,
        blocks=block_details,
        revealed_text=reveal_zero_width(text),
        hidden_char_count=hidden_count,
        summary=summary
    )
