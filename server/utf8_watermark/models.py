from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class BlockParityDetail(BaseModel):
    block_index: int
    block_text: str
    clean_text: str
    start_char: int
    end_char: int
    expected_hash: str
    actual_hash: str
    status: Literal["verified", "tampered", "unwatermarked"]
    explanation: str

class UTF8EmbedRequest(BaseModel):
    text: str
    payload: str = Field(default="AUTHENTIC_LLM_GEN_v1", description="Metadata / signature payload to embed")
    block_word_size: int = Field(default=4, ge=1, le=20, description="Number of words per parity block")
    secret_key: int = Field(default=1337, description="Cryptographic salt key for block hash verification")

class UTF8EmbedResult(BaseModel):
    original_text: str
    watermarked_text: str
    payload: str
    block_word_size: int
    total_blocks: int
    hidden_char_count: int
    revealed_text: str
    summary: str
    blocks: List[BlockParityDetail] = []

class UTF8VerifyRequest(BaseModel):
    text: str
    secret_key: int = Field(default=1337, description="Cryptographic salt key for block hash verification")

class UTF8VerifyResult(BaseModel):
    is_watermarked: bool
    payload_extracted: Optional[str] = None
    total_blocks: int
    verified_blocks: int
    tampered_blocks: int
    unwatermarked_blocks: int
    integrity_score: float  # 0.0 to 100.0%
    verdict: Literal["intact", "partially_tampered", "severely_tampered", "not_watermarked"]
    blocks: List[BlockParityDetail] = []
    revealed_text: str
    hidden_char_count: int
    summary: str

class UTF8Preset(BaseModel):
    id: str
    title: str
    description: str
    watermarked_text: str
    payload: str
    is_tampered: bool
    tamper_description: Optional[str] = None
