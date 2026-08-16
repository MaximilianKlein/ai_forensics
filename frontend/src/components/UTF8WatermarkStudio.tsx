import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  FileCode,
  ScanSearch,
  Activity,
  Layers,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lock,
  Binary,
  Hash
} from 'lucide-react';
import type {
  UTF8EmbedResult,
  UTF8VerifyResult,
  UTF8Preset,
  UTF8BlockParityDetail
} from '../types';

interface UTF8WatermarkStudioProps {
  selectedModel?: string;
  onSendToRadar?: (text: string) => void;
  onSendToDetectGPT?: (text: string) => void;
  onSendToTokenWatermark?: (text: string) => void;
  onSendToTamper?: (text: string) => void;
}

// Zero-width character definitions and color-coding
interface ZWItem {
  char: string;
  codePoint: string;
  tag: string;
  name: string;
  bits: string;
  base4: number | null;
  color: string;
  bg: string;
  border: string;
}

const ZW_MAP: Record<string, ZWItem> = {
  '\u200b': {
    char: '\u200b',
    codePoint: 'U+200B',
    tag: 'ZWSP',
    name: 'Zero-Width Space',
    bits: '00',
    base4: 0,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.18)',
    border: 'rgba(56, 189, 248, 0.45)'
  },
  '\u200c': {
    char: '\u200c',
    codePoint: 'U+200C',
    tag: 'ZWNJ',
    name: 'Zero-Width Non-Joiner',
    bits: '01',
    base4: 1,
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.18)',
    border: 'rgba(192, 132, 252, 0.45)'
  },
  '\u200d': {
    char: '\u200d',
    codePoint: 'U+200D',
    tag: 'ZWJ',
    name: 'Zero-Width Joiner',
    bits: '10',
    base4: 2,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.18)',
    border: 'rgba(52, 211, 153, 0.45)'
  },
  '\u2060': {
    char: '\u2060',
    codePoint: 'U+2060',
    tag: 'WJ',
    name: 'Word Joiner',
    bits: '11',
    base4: 3,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.18)',
    border: 'rgba(251, 191, 36, 0.45)'
  },
  '\ufeff': {
    char: '\ufeff',
    codePoint: 'U+FEFF',
    tag: 'BOM',
    name: 'Byte Order Mark (Delimiter)',
    bits: 'Marker',
    base4: null,
    color: '#fb7185',
    bg: 'rgba(251, 113, 133, 0.18)',
    border: 'rgba(251, 113, 133, 0.45)'
  }
};

const ALL_ZW_CHARS = new Set(['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff']);

export const UTF8WatermarkStudio: React.FC<UTF8WatermarkStudioProps> = ({
  selectedModel,
  onSendToRadar,
  onSendToDetectGPT,
  onSendToTokenWatermark,
  onSendToTamper
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'embedder' | 'verifier'>('embedder');

  // Embedder State
  const [embedInputText, setEmbedInputText] = useState<string>(
    "The Apollo 11 mission was the first spaceflight that landed humans on the Moon. " +
    "Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969. " +
    "Armstrong became the first person to step onto the lunar surface six hours and 39 minutes later."
  );
  const [includePayload, setIncludePayload] = useState<boolean>(true);
  const [payloadText, setPayloadText] = useState<string>(
    selectedModel
      ? `Model: ${selectedModel} | License: CreativeCommons | Sign: SHA256-OK`
      : "Model: Gemma-4 | License: CreativeCommons | Sign: SHA256-OK"
  );
  const [blockWordSize, setBlockWordSize] = useState<number>(4);
  const [secretKey, setSecretKey] = useState<number>(1337);
  const [isEmbedding, setIsEmbedding] = useState<boolean>(false);
  const [embedResult, setEmbedResult] = useState<UTF8EmbedResult | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [revealEmbedGlyphs, setRevealEmbedGlyphs] = useState<'normal' | 'xray' | 'packets'>('normal');
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);

  // Sync payload when selectedModel changes
  useEffect(() => {
    if (selectedModel) {
      setPayloadText(`Model: ${selectedModel} | License: CreativeCommons | Sign: SHA256-OK`);
    }
  }, [selectedModel]);

  // Selected Block for Step-by-Step Calculation Breakdown
  const [selectedCalcBlock, setSelectedCalcBlock] = useState<UTF8BlockParityDetail | null>(null);

  // Verifier State
  const [verifyInputText, setVerifyInputText] = useState<string>('');
  const [verifySecretKey, setVerifySecretKey] = useState<number>(1337);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<UTF8VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [revealVerifyGlyphs, setRevealVerifyGlyphs] = useState<'normal' | 'xray' | 'packets'>('normal');
  const [hoveredBlock, setHoveredBlock] = useState<UTF8BlockParityDetail | null>(null);
  const [hoveredGlyph, setHoveredGlyph] = useState<{ char: string; item: ZWItem; index: number } | null>(null);

  // Presets
  const [presets, setPresets] = useState<UTF8Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  useEffect(() => {
    fetch('/api/utf8-watermark/presets')
      .then(res => res.json())
      .then((data: UTF8Preset[]) => {
        setPresets(data);
        if (data.length > 0) {
          setSelectedPresetId(data[0].id);
          setVerifyInputText(data[0].watermarked_text);
        }
      })
      .catch(err => console.error('Failed to load UTF8 presets:', err));
  }, []);

  const handleEmbed = async () => {
    if (!embedInputText.trim()) return;
    setIsEmbedding(true);
    setEmbedError(null);
    try {
      const res = await fetch('/api/utf8-watermark/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: embedInputText,
          payload: includePayload ? payloadText : '',
          block_word_size: blockWordSize,
          secret_key: secretKey
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Embedding failed');
      }

      const data: UTF8EmbedResult = await res.json();
      setEmbedResult(data);
      if (data.blocks && data.blocks.length > 0) {
        setSelectedCalcBlock(data.blocks[0]);
      }
    } catch (err: unknown) {
      setEmbedError(err instanceof Error ? err.message : 'Embedding error');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleVerify = async (textToVerify?: string) => {
    const text = textToVerify !== undefined ? textToVerify : verifyInputText;
    if (!text) {
      setVerifyResult(null);
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/utf8-watermark/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          secret_key: verifySecretKey
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Verification failed');
      }

      const data: UTF8VerifyResult = await res.json();
      setVerifyResult(data);
      if (data.blocks && data.blocks.length > 0) {
        setSelectedCalcBlock(data.blocks[0]);
      }
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setSelectedPresetId(presetId);
      setVerifyInputText(p.watermarked_text);
      handleVerify(p.watermarked_text);
    }
  };

  const handleSendEmbedToVerifier = () => {
    if (!embedResult) return;
    setVerifyInputText(embedResult.watermarked_text);
    setVerifySecretKey(secretKey);
    setActiveSubTab('verifier');
    handleVerify(embedResult.watermarked_text);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  // Tamper helper
  const handleTamperText = (action: 'replace_word' | 'append_text') => {
    if (!verifyInputText) return;
    let modified = verifyInputText;
    if (action === 'replace_word') {
      if (modified.includes('Apollo')) {
        modified = modified.replace('Apollo', 'Ares');
      } else if (modified.includes('Moon')) {
        modified = modified.replace('Moon', 'Mars');
      } else {
        const words = modified.split(' ');
        if (words.length > 2) {
          words[2] = 'MODIFIED_WORD';
          modified = words.join(' ');
        }
      }
    } else if (action === 'append_text') {
      modified = modified + ' This is an unauthorized paragraph appended without any parity tag.';
    }
    setVerifyInputText(modified);
    handleVerify(modified);
  };

  // Parse text into visible words and interactive zero-width glyphs
  const renderXRayText = (text: string) => {
    const chars = Array.from(text);
    const elements: React.ReactNode[] = [];
    let visibleBuffer = '';

    chars.forEach((c, idx) => {
      if (ALL_ZW_CHARS.has(c)) {
        if (visibleBuffer) {
          elements.push(<span key={`vis-${idx}`}>{visibleBuffer}</span>);
          visibleBuffer = '';
        }
        const item = ZW_MAP[c] || {
          char: c,
          codePoint: `U+${c.charCodeAt(0).toString(16).toUpperCase()}`,
          tag: 'ZW',
          name: 'Zero-Width Char',
          bits: '??',
          base4: null,
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.15)',
          border: 'rgba(148, 163, 184, 0.4)'
        };
        elements.push(
          <span
            key={`zw-${idx}`}
            onMouseEnter={() => setHoveredGlyph({ char: c, item, index: idx })}
            onMouseLeave={() => setHoveredGlyph(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 4px',
              margin: '0 1px',
              borderRadius: '4px',
              background: item.bg,
              border: `1px solid ${item.border}`,
              color: item.color,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none',
              verticalAlign: 'baseline',
              lineHeight: 1.2
            }}
            title={`${item.name} (${item.codePoint}) • Bits: ${item.bits}`}
          >
            {item.tag}
          </span>
        );
      } else {
        visibleBuffer += c;
      }
    });

    if (visibleBuffer) {
      elements.push(<span key="vis-end">{visibleBuffer}</span>);
    }

    return elements;
  };

  // Parse text into high-level Protocol Packets (Global Header vs Block Parity Tags)
  const renderPacketBreakdown = (_text: string, blocksList: UTF8BlockParityDetail[]) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Global Header Packet */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid rgba(192, 132, 252, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase' }}>
              📦 Global Provenance Header Packet
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Framed by [BOM][ZWSP] ... [BOM][ZWNJ]</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            Payload: <strong style={{ color: 'var(--brand-cyan)' }}>{payloadText || 'Model Provenance Metadata'}</strong>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Encodes metadata with 16-bit CRC checksum across 4-symbol base-4 stream.
          </span>
        </div>

        {/* Block Parity Packets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {blocksList.map((blk) => {
            const isSelected = selectedCalcBlock?.block_index === blk.block_index;
            const isTampered = blk.status === 'tampered';
            const isVerified = blk.status === 'verified';

            return (
              <div
                key={blk.block_index}
                onClick={() => setSelectedCalcBlock(blk)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--color-surface-hover)' : 'var(--bg-card)',
                  border: `1px solid ${
                    isSelected
                      ? 'var(--brand-cyan)'
                      : isTampered
                      ? 'rgba(239, 68, 68, 0.4)'
                      : isVerified
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'var(--border-color)'
                  }`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isTampered ? 'var(--watermark-red)' : 'var(--watermark-green)' }}>
                    🏷️ Block Tag #{blk.block_index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isTampered ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isTampered ? '#ef4444' : '#10b981'
                    }}
                  >
                    {blk.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontStyle: 'italic' }}>
                  "{blk.clean_text}"
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>Tag: <code>{blk.expected_hash}</code></span>
                  <span>Computed: <code>{blk.actual_hash}</code></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="tab-content">
      {/* Top Header */}
      <div className="section-header">
        <div>
          <h2>🥷 Invisible UTF-8 Watermarking & Block-Based Parity</h2>
          <p>
            Zero-perceptual-distortion steganographic watermarking using 4-symbol zero-width Unicode characters (<code>[ZWSP]</code>, <code>[ZWNJ]</code>, <code>[ZWJ]</code>, <code>[WJ]</code>).
            Embeds verifiable metadata signatures and generates <strong>cryptographic block-level parity checksums</strong> for exact tamper localization.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`button ${activeSubTab === 'embedder' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSubTab('embedder')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <EyeOff size={14} />
            Embedder Studio
          </button>
          <button
            className={`button ${activeSubTab === 'verifier' ? 'primary' : 'secondary'}`}
            onClick={() => {
              setActiveSubTab('verifier');
              if (!verifyResult && verifyInputText) {
                handleVerify();
              }
            }}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <ShieldCheck size={14} />
            Verifier & Tamper Inspector
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: EMBEDDER STUDIO */}
      {activeSubTab === 'embedder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid-2col" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
            {/* Left: Input Text & Actions */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label className="label" style={{ margin: 0 }}>
                  Candidate Text to Watermark
                </label>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  <span>{embedInputText.length} chars</span>
                  <span>•</span>
                  <span>{embedInputText.trim() ? embedInputText.trim().split(/\s+/).length : 0} words</span>
                </div>
              </div>

              <textarea
                className="textarea"
                rows={8}
                value={embedInputText}
                onChange={e => setEmbedInputText(e.target.value)}
                placeholder="Enter text to embed with invisible zero-width watermark and block-based parity..."
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setEmbedInputText('');
                    setEmbedResult(null);
                  }}
                  disabled={!embedInputText}
                >
                  <RotateCcw size={14} />
                  Clear
                </button>

                <button
                  className="button primary"
                  onClick={handleEmbed}
                  disabled={isEmbedding || !embedInputText.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isEmbedding ? <Activity size={16} className="spin" /> : <EyeOff size={16} />}
                  <span>{isEmbedding ? 'Embedding Tags...' : 'Embed Invisible Watermark'}</span>
                </button>
              </div>

              {embedError && (
                <div className="alert error" style={{ marginTop: '12px' }}>
                  <AlertTriangle size={16} />
                  <span>{embedError}</span>
                </div>
              )}
            </div>

            {/* Right: Metadata Payload & Parity Parameters */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="card-header" style={{ marginBottom: '0px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Payload & Parity Configuration</h3>
                </div>
              </div>

              {/* Payload String Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                    <input
                      type="checkbox"
                      checked={includePayload}
                      onChange={e => setIncludePayload(e.target.checked)}
                    />
                    <span>Include Model & Metadata Header</span>
                  </label>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: includePayload ? 'var(--watermark-green)' : 'var(--brand-cyan)'
                    }}
                  >
                    {includePayload ? 'Header (~40-80 symbols)' : '⚡ Block Parity Only (0 Header Overhead)'}
                  </span>
                </div>

                {includePayload ? (
                  <>
                    <input
                      type="text"
                      className="textarea"
                      style={{ width: '100%', padding: '8px 12px', height: 'auto', fontSize: '12.5px' }}
                      value={payloadText}
                      onChange={e => setPayloadText(e.target.value)}
                      placeholder="e.g. Model: Gemma-4 | Author: Alice | License: CC-BY"
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Presets:</span>
                      {selectedModel && (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                          onClick={() => setPayloadText(`Model: ${selectedModel} | License: CC-BY | Sign: SHA256-OK`)}
                        >
                          Active Model: {selectedModel}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                        onClick={() => setPayloadText(`Model: ${selectedModel || 'Gemma-4'}`)}
                      >
                        Model Only
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                        onClick={() => setPayloadText(`Model: ${selectedModel || 'Gemma-4'} | License: CC-BY-4.0 | Sign: SHA256-OK`)}
                      >
                        Full Provenance
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', display: 'block' }}>
                      Encoded into the global header using zero-width base-4 symbols with 16-bit CRC checksum.
                    </span>
                  </>
                ) : (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--brand-cyan)',
                      lineHeight: '1.4'
                    }}
                  >
                    ⚡ <strong>Lightweight Mode (Block Parity Only):</strong> No metadata header is generated, saving ~40–80 zero-width symbols. Cryptographic block-level parity checksums are still embedded across every word block for 100% accurate tamper localization.
                  </div>
                )}
              </div>

              {/* Block Size Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                    Parity Block Size
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {blockWordSize} words / block
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={blockWordSize}
                  onChange={e => setBlockWordSize(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                  Granularity of tamper detection. Smaller block sizes allow more localized tamper detection.
                </span>
              </div>

              {/* Secret Salt Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                    Cryptographic Salt Key
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                    Key #{secretKey}
                  </span>
                </div>
                <input
                  type="number"
                  className="textarea"
                  style={{ width: '100%', padding: '6px 12px', height: 'auto', fontSize: '12px' }}
                  value={secretKey}
                  onChange={e => setSecretKey(Number(e.target.value))}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '4px', display: 'block' }}>
                  Prevents unauthorized adversaries from forging parity hashes without the secret key.
                </span>
              </div>
            </div>
          </div>

          {/* Embed Result & Interactive Zero-Width X-Ray Inspector */}
          {embedResult && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card-header" style={{ marginBottom: '0px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Watermarked Output & Zero-Width X-Ray Inspector</h3>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* View Mode Selector */}
                  <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-color)' }}>
                    <button
                      className={`button ${revealEmbedGlyphs === 'normal' ? 'primary' : 'secondary'}`}
                      onClick={() => setRevealEmbedGlyphs('normal')}
                      style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      title="What human readers see"
                    >
                      <Eye size={12} /> Normal
                    </button>
                    <button
                      className={`button ${revealEmbedGlyphs === 'xray' ? 'primary' : 'secondary'}`}
                      onClick={() => setRevealEmbedGlyphs('xray')}
                      style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      title="Microscope view of invisible characters"
                    >
                      <Binary size={12} /> X-Ray Glyphs
                    </button>
                    <button
                      className={`button ${revealEmbedGlyphs === 'packets' ? 'primary' : 'secondary'}`}
                      onClick={() => setRevealEmbedGlyphs('packets')}
                      style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      title="Protocol Packets & Tags"
                    >
                      <Layers size={12} /> Packets
                    </button>
                  </div>

                  <button
                    className="button secondary"
                    onClick={() => copyToClipboard(embedResult.watermarked_text)}
                    style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedEmbed ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedEmbed ? 'Copied Clean Text!' : 'Copy Text'}</span>
                  </button>

                  <button
                    className="button primary"
                    onClick={handleSendEmbedToVerifier}
                    style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Test in Verifier</span>
                    <ArrowRight size={14} />
                  </button>

                  {onSendToTamper && (
                    <button
                      className="button secondary"
                      onClick={() => onSendToTamper(embedResult.watermarked_text)}
                      style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
                      title="Send watermarked text to Token Tamper & Robustness Lab"
                    >
                      <ShieldAlert size={14} />
                      <span>Tamper Lab</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Strip */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--color-surface-hover)',
                  fontSize: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-dim)' }}>Hidden Zero-Width Glyphs: </span>
                  <strong style={{ color: 'var(--color-primary)' }}>{embedResult.hidden_char_count} symbols</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-dim)' }}>Parity Blocks: </span>
                  <strong style={{ color: 'var(--color-text)' }}>{embedResult.total_blocks} blocks ({blockWordSize} words/block)</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-dim)' }}>Payload Signature: </span>
                  <strong style={{ color: '#10b981' }}>{embedResult.payload}</strong>
                </div>
              </div>

              {/* Glyph Color Legend Bar (when in X-Ray mode) */}
              {revealEmbedGlyphs === 'xray' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.74rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>ZERO-WIDTH GLYPH LEGEND:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '1px 4px', borderRadius: '3px' }}>[ZWSP]</code>
                    <span>U+200B (Bit 00)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ color: '#c084fc', background: 'rgba(192,132,252,0.15)', padding: '1px 4px', borderRadius: '3px' }}>[ZWNJ]</code>
                    <span>U+200C (Bit 01)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ color: '#34d399', background: 'rgba(52,211,153,0.15)', padding: '1px 4px', borderRadius: '3px' }}>[ZWJ]</code>
                    <span>U+200D (Bit 10)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.15)', padding: '1px 4px', borderRadius: '3px' }}>[WJ]</code>
                    <span>U+2060 (Bit 11)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ color: '#fb7185', background: 'rgba(251,113,133,0.15)', padding: '1px 4px', borderRadius: '3px' }}>[BOM]</code>
                    <span>U+FEFF (Frame Delimiter)</span>
                  </span>
                </div>
              )}

              {/* Text Render Area */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  lineHeight: '1.9',
                  color: 'var(--color-text)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}
              >
                {revealEmbedGlyphs === 'normal' && (
                  <span>{embedResult.watermarked_text}</span>
                )}
                {revealEmbedGlyphs === 'xray' && (
                  renderXRayText(embedResult.watermarked_text)
                )}
                {revealEmbedGlyphs === 'packets' && (
                  renderPacketBreakdown(embedResult.watermarked_text, embedResult.blocks)
                )}
              </div>

              {/* Hovered Glyph Inspector Pill */}
              {hoveredGlyph && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--color-surface-hover)',
                    border: `1px solid ${hoveredGlyph.item.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: hoveredGlyph.item.color }}>{hoveredGlyph.item.name}</strong>
                    <span><code>{hoveredGlyph.item.codePoint}</code></span>
                    <span>•</span>
                    <span>2-Bit Symbol: <strong style={{ color: hoveredGlyph.item.color }}>{hoveredGlyph.item.bits}</strong></span>
                    {hoveredGlyph.item.base4 !== null && <span>(Base-4: {hoveredGlyph.item.base4})</span>}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Char Index: {hoveredGlyph.index}</span>
                </div>
              )}

              {/* STEP-BY-STEP BLOCK PARITY CALCULATION INSPECTOR */}
              {embedResult.blocks && embedResult.blocks.length > 0 && selectedCalcBlock && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Hash size={16} color="var(--brand-cyan)" />
                      <h4 style={{ margin: 0, fontSize: '0.92rem' }}>
                        Step-by-Step Block Parity Calculation Pipeline
                      </h4>
                    </div>

                    {/* Block Picker Tabs */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {embedResult.blocks.map((b) => (
                        <button
                          key={b.block_index}
                          className={`button ${selectedCalcBlock.block_index === b.block_index ? 'primary' : 'secondary'}`}
                          onClick={() => setSelectedCalcBlock(b)}
                          style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}
                        >
                          Block #{b.block_index + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculation Flow Pipeline */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    {/* Step 1: Word Slice */}
                    <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        STEP 1: TOKEN WINDOW (B_{selectedCalcBlock.block_index})
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        "{selectedCalcBlock.block_text.trim()}"
                      </div>
                      <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Word Window: {selectedCalcBlock.block_text.trim().split(/\s+/).length} words
                      </small>
                    </div>

                    {/* Step 2: Normalization & Concatenation */}
                    <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c084fc', marginBottom: '4px' }}>
                        STEP 2: SALTED HASH INPUT
                      </div>
                      <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        "{secretKey}:{selectedCalcBlock.block_index}:{selectedCalcBlock.block_text.trim().toLowerCase()}"
                      </div>
                      <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Format: Key:Index:Norm(Text)
                      </small>
                    </div>

                    {/* Step 3: SHA-256 Checksum */}
                    <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-cyan)', marginBottom: '4px' }}>
                        STEP 3: 16-BIT PARITY HASH
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-cyan)' }}>
                        {selectedCalcBlock.expected_hash}
                      </div>
                      <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        SHA-256[:4] (First 16 bits of hash)
                      </small>
                    </div>

                    {/* Step 4: Zero-Width Modulation */}
                    <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--watermark-green)', marginBottom: '4px' }}>
                        STEP 4: MODULATION &amp; TAG
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)' }}>
                        [BOM][ZWJ] + base4({selectedCalcBlock.block_index}:{selectedCalcBlock.expected_hash}) + [BOM][WJ]
                      </div>
                      <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Embedded silently after block text
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: VERIFIER & TAMPER LOCALIZATION STUDIO */}
      {activeSubTab === 'verifier' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preset Cases */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sparkles size={16} color="var(--color-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                LOAD DEMO VERIFICATION CASES:
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {presets.map(p => (
                <button
                  key={p.id}
                  className={`button ${selectedPresetId === p.id ? 'primary' : 'secondary'}`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background:
                      selectedPresetId === p.id
                        ? 'var(--color-primary)'
                        : p.is_tampered
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(16, 185, 129, 0.12)',
                    borderColor:
                      selectedPresetId === p.id
                        ? 'var(--color-primary)'
                        : p.is_tampered
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'rgba(16, 185, 129, 0.4)',
                    color:
                      selectedPresetId === p.id
                        ? '#fff'
                        : p.is_tampered
                        ? '#ef4444'
                        : '#10b981'
                  }}
                  onClick={() => handleSelectPreset(p.id)}
                >
                  <span>{p.is_tampered ? '⚠️' : '🛡️'}</span>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Verification Text Area & Actions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="label" style={{ margin: 0 }}>
                Text for Watermark & Block Parity Verification
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="button secondary"
                  onClick={() => handleTamperText('replace_word')}
                  style={{ fontSize: '11.5px', padding: '4px 10px', color: '#f87171' }}
                  title="Simulate modifying a word to test block parity error localization"
                >
                  ✏️ Alter Word (Tamper)
                </button>
                <button
                  className="button secondary"
                  onClick={() => handleTamperText('append_text')}
                  style={{ fontSize: '11.5px', padding: '4px 10px', color: '#fbbf24' }}
                  title="Simulate appending unwatermarked content"
                >
                  ➕ Append Unsigned Text
                </button>
              </div>
            </div>

            <textarea
              className="textarea"
              rows={6}
              value={verifyInputText}
              onChange={e => {
                setVerifyInputText(e.target.value);
                setSelectedPresetId('');
              }}
              placeholder="Paste watermarked text to inspect parity and extract embedded signatures..."
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setVerifyInputText('');
                    setSelectedPresetId('');
                    setVerifyResult(null);
                  }}
                  disabled={!verifyInputText}
                >
                  <RotateCcw size={14} />
                  Clear
                </button>

                {onSendToRadar && verifyResult && (
                  <button
                    className="button secondary"
                    onClick={() => onSendToRadar(verifyInputText)}
                    title="Scan in Signs of AI Radar"
                  >
                    <ScanSearch size={14} />
                    Scan in Radar
                  </button>
                )}

                {onSendToDetectGPT && verifyResult && (
                  <button
                    className="button secondary"
                    onClick={() => onSendToDetectGPT(verifyInputText)}
                    title="Evaluate Curvature in DetectGPT"
                  >
                    <Activity size={14} />
                    DetectGPT
                  </button>
                )}

                {onSendToTokenWatermark && verifyResult && (
                  <button
                    className="button secondary"
                    onClick={() => onSendToTokenWatermark(verifyInputText)}
                    title="Verify Green-List Watermarking"
                  >
                    <Sparkles size={14} />
                    Token Detector
                  </button>
                )}
              </div>

              <button
                className="button primary"
                onClick={() => handleVerify()}
                disabled={isVerifying || !verifyInputText.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isVerifying ? <Activity size={16} className="spin" /> : <ShieldCheck size={16} />}
                <span>{isVerifying ? 'Verifying Hashes...' : 'Verify Block Parity'}</span>
              </button>
            </div>

            {verifyError && (
              <div className="alert error" style={{ marginTop: '12px' }}>
                <AlertTriangle size={16} />
                <span>{verifyError}</span>
              </div>
            )}
          </div>

          {/* Verification Results & Block Heatmap */}
          {verifyResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Verdict & Metrics Cards */}
              <div className="grid-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {/* Card 1: Integrity Verdict */}
                <div
                  className="card"
                  style={{
                    padding: '16px',
                    border: '1px solid',
                    borderColor:
                      verifyResult.verdict === 'intact'
                        ? 'rgba(16, 185, 129, 0.6)'
                        : verifyResult.verdict === 'partially_tampered'
                        ? 'rgba(234, 179, 8, 0.6)'
                        : verifyResult.verdict === 'severely_tampered'
                        ? 'rgba(239, 68, 68, 0.6)'
                        : 'rgba(148, 163, 184, 0.6)',
                    background:
                      verifyResult.verdict === 'intact'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : verifyResult.verdict === 'partially_tampered'
                        ? 'rgba(234, 179, 8, 0.12)'
                        : verifyResult.verdict === 'severely_tampered'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(148, 163, 184, 0.12)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {verifyResult.verdict === 'intact' ? (
                      <ShieldCheck size={18} color="#10b981" />
                    ) : verifyResult.verdict === 'not_watermarked' ? (
                      <HelpCircle size={18} color="#94a3b8" />
                    ) : (
                      <ShieldAlert size={18} color="#ef4444" />
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                      INTEGRITY STATUS
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color:
                        verifyResult.verdict === 'intact'
                          ? '#10b981'
                          : verifyResult.verdict === 'partially_tampered'
                          ? '#eab308'
                          : verifyResult.verdict === 'severely_tampered'
                          ? '#ef4444'
                          : '#94a3b8',
                      marginBottom: '4px'
                    }}
                  >
                    {verifyResult.verdict === 'intact'
                      ? '100% Intact & Authentic'
                      : verifyResult.verdict === 'partially_tampered'
                      ? 'Partial Tampering'
                      : verifyResult.verdict === 'severely_tampered'
                      ? 'Severe Tampering'
                      : 'No Watermark Found'}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                    Integrity: {verifyResult.integrity_score}%
                  </span>
                </div>

                {/* Card 2: Verified Blocks */}
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                    VERIFIED BLOCKS
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
                    {verifyResult.verified_blocks} / {verifyResult.total_blocks}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                    Cryptographically matched hashes
                  </span>
                </div>

                {/* Card 3: Tampered Blocks */}
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                    TAMPERED BLOCKS
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      color: verifyResult.tampered_blocks > 0 ? '#ef4444' : '#94a3b8',
                      marginBottom: '4px'
                    }}
                  >
                    {verifyResult.tampered_blocks} blocks
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                    {verifyResult.tampered_blocks > 0 ? 'Hash mismatch in edited regions' : 'Zero modifications'}
                  </span>
                </div>

                {/* Card 4: Hidden Glyphs & Payload */}
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                    EXTRACTED PAYLOAD
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: verifyResult.payload_extracted ? '#38bdf8' : '#94a3b8',
                      marginBottom: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={verifyResult.payload_extracted || 'None'}
                  >
                    {verifyResult.payload_extracted || 'No payload'}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                    {verifyResult.hidden_char_count} zero-width glyphs extracted
                  </span>
                </div>
              </div>

              {/* Block Parity Heatmap & Tamper Visualizer */}
              <div className="card">
                <div className="card-header" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode size={18} color="var(--color-primary)" />
                    <h3 style={{ margin: 0, fontSize: '15px' }}>
                      Block-Level Parity Heatmap &amp; Tamper Localization
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* View Mode */}
                    <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-color)' }}>
                      <button
                        className={`button ${revealVerifyGlyphs === 'normal' ? 'primary' : 'secondary'}`}
                        onClick={() => setRevealVerifyGlyphs('normal')}
                        style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      >
                        <ShieldCheck size={12} /> Heatmap
                      </button>
                      <button
                        className={`button ${revealVerifyGlyphs === 'xray' ? 'primary' : 'secondary'}`}
                        onClick={() => setRevealVerifyGlyphs('xray')}
                        style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      >
                        <Binary size={12} /> X-Ray
                      </button>
                      <button
                        className={`button ${revealVerifyGlyphs === 'packets' ? 'primary' : 'secondary'}`}
                        onClick={() => setRevealVerifyGlyphs('packets')}
                        style={{ fontSize: '11px', padding: '3px 8px', border: 'none' }}
                      >
                        <Layers size={12} /> Packets
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.3)', border: '1px solid #10b981' }} />
                        <span>Verified</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid #ef4444' }} />
                        <span>Tampered</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Heatmap Text Render or X-Ray Glyphs */}
                {revealVerifyGlyphs === 'normal' && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--color-border)',
                      fontSize: '14px',
                      lineHeight: '2.0',
                      color: 'var(--color-text)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      alignItems: 'center'
                    }}
                  >
                    {verifyResult.blocks.map(blk => {
                      const isTampered = blk.status === 'tampered';
                      const isVerified = blk.status === 'verified';
                      const isHovered = hoveredBlock?.block_index === blk.block_index;
                      const isSelected = selectedCalcBlock?.block_index === blk.block_index;

                      return (
                        <span
                          key={blk.block_index}
                          onClick={() => setSelectedCalcBlock(blk)}
                          onMouseEnter={() => setHoveredBlock(blk)}
                          onMouseLeave={() => setHoveredBlock(null)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: isTampered
                              ? 'rgba(239, 68, 68, 0.25)'
                              : isVerified
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                            border: isSelected
                              ? '2px solid var(--brand-cyan)'
                              : isHovered
                              ? `2px solid ${isTampered ? '#ef4444' : isVerified ? '#10b981' : '#94a3b8'}`
                              : `1px solid ${isTampered ? 'rgba(239, 68, 68, 0.6)' : isVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                            textDecoration: isTampered ? 'underline wavy #ef4444' : 'none'
                          }}
                        >
                          {blk.block_text}
                        </span>
                      );
                    })}
                  </div>
                )}

                {revealVerifyGlyphs === 'xray' && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                      lineHeight: '1.9',
                      color: 'var(--color-text)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '280px',
                      overflowY: 'auto'
                    }}
                  >
                    {renderXRayText(verifyInputText)}
                  </div>
                )}

                {revealVerifyGlyphs === 'packets' && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--color-border)',
                      maxHeight: '280px',
                      overflowY: 'auto'
                    }}
                  >
                    {renderPacketBreakdown(verifyInputText, verifyResult.blocks)}
                  </div>
                )}

                {/* Hovered Block Information Bar */}
                {hoveredBlock && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <strong style={{ color: hoveredBlock.status === 'tampered' ? '#ef4444' : hoveredBlock.status === 'verified' ? '#10b981' : '#94a3b8' }}>
                        Block #{hoveredBlock.block_index + 1}: {hoveredBlock.status.toUpperCase()}
                      </strong>
                      <span style={{ marginLeft: '10px', color: 'var(--color-text)' }}>{hoveredBlock.explanation}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', color: 'var(--color-text-dim)', fontSize: '11px' }}>
                      <span>Tag Hash: <code>{hoveredBlock.expected_hash}</code></span>
                      <span>Computed Hash: <code>{hoveredBlock.actual_hash}</code></span>
                    </div>
                  </div>
                )}

                {/* STEP-BY-STEP VERIFICATION PARITY CALCULATION INSPECTOR */}
                {selectedCalcBlock && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Hash size={16} color={selectedCalcBlock.status === 'tampered' ? '#ef4444' : 'var(--brand-cyan)'} />
                        <h4 style={{ margin: 0, fontSize: '0.92rem' }}>
                          Mathematical Parity Verification for Block #{selectedCalcBlock.block_index + 1}
                        </h4>
                      </div>

                      {/* Block Selector */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {verifyResult.blocks.map((b) => (
                          <button
                            key={b.block_index}
                            className={`button ${selectedCalcBlock.block_index === b.block_index ? 'primary' : 'secondary'}`}
                            onClick={() => setSelectedCalcBlock(b)}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              borderColor: b.status === 'tampered' ? '#ef4444' : undefined,
                              color: b.status === 'tampered' ? '#ef4444' : undefined
                            }}
                          >
                            Block #{b.block_index + 1} {b.status === 'tampered' ? '⚠️' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pipeline Breakdown Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                          RECEIVED TEXT SLICE
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          "{selectedCalcBlock.block_text.trim()}"
                        </div>
                      </div>

                      <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c084fc', marginBottom: '4px' }}>
                          RECOMPUTED SEED
                        </div>
                        <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          "{verifySecretKey}:{selectedCalcBlock.block_index}:{selectedCalcBlock.block_text.trim().toLowerCase()}"
                        </div>
                      </div>

                      <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-cyan)', marginBottom: '4px' }}>
                          HASH COMPARISON
                        </div>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                          Expected Tag: <strong style={{ color: 'var(--brand-cyan)' }}>{selectedCalcBlock.expected_hash}</strong>
                          <br />
                          Actual Hash: <strong style={{ color: selectedCalcBlock.status === 'tampered' ? '#ef4444' : '#10b981' }}>{selectedCalcBlock.actual_hash}</strong>
                        </div>
                      </div>

                      <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedCalcBlock.status === 'tampered' ? '#ef4444' : '#10b981', marginBottom: '4px' }}>
                          PARITY VERDICT
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: selectedCalcBlock.status === 'tampered' ? '#ef4444' : '#10b981' }}>
                          {selectedCalcBlock.status === 'tampered' ? '❌ TAMPERED (Mismatch)' : '✅ INTACT & VERIFIED'}
                        </div>
                        <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {selectedCalcBlock.status === 'tampered'
                            ? 'SHA-256 avalanche effect revealed edit in this block.'
                            : 'Cryptographic parity signature matches exactly.'}
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary text */}
                <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: 'var(--color-text-dim)', lineHeight: '1.5' }}>
                  {verifyResult.summary}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded "How It Works & Theory" Collapsible Panel */}
      <div className="card" style={{ marginTop: '8px', padding: '18px 22px' }}>
        <div
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="#c084fc" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              How Invisible UTF-8 Steganography &amp; Block-Based Parity Works
            </h3>
          </div>
          <button className="button secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
            <span>{showHowItWorks ? 'Hide Theory' : 'Show Theory & Math'}</span>
            {showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showHowItWorks && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <p className="theory-intro">
              Zero-width steganography encodes binary metadata into unrendered Unicode characters without altering the visual appearance of the text.
              Cryptographic block-level parity tags enable instant localization of adversarial edits, deletions, or insertions.
            </p>

            {/* Visual Base-4 Character Map Table */}
            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Binary size={15} color="#c084fc" />
                <span>Base-4 Zero-Width Modulation Scheme</span>
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 10px' }}>Glyph Tag</th>
                      <th style={{ padding: '6px 10px' }}>Unicode Codepoint</th>
                      <th style={{ padding: '6px 10px' }}>Character Name</th>
                      <th style={{ padding: '6px 10px' }}>Bit Pair</th>
                      <th style={{ padding: '6px 10px' }}>Base-4 Digit</th>
                      <th style={{ padding: '6px 10px' }}>Encoding Function</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px' }}><code style={{ color: '#38bdf8' }}>[ZWSP]</code></td>
                      <td style={{ padding: '6px 10px' }}><code>U+200B</code></td>
                      <td style={{ padding: '6px 10px' }}>Zero-Width Space</td>
                      <td style={{ padding: '6px 10px' }}><strong>00</strong></td>
                      <td style={{ padding: '6px 10px' }}>0</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Nibble (b &gt;&gt; 6) &amp; 3</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px' }}><code style={{ color: '#c084fc' }}>[ZWNJ]</code></td>
                      <td style={{ padding: '6px 10px' }}><code>U+200C</code></td>
                      <td style={{ padding: '6px 10px' }}>Zero-Width Non-Joiner</td>
                      <td style={{ padding: '6px 10px' }}><strong>01</strong></td>
                      <td style={{ padding: '6px 10px' }}>1</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Nibble (b &gt;&gt; 4) &amp; 3</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px' }}><code style={{ color: '#34d399' }}>[ZWJ]</code></td>
                      <td style={{ padding: '6px 10px' }}><code>U+200D</code></td>
                      <td style={{ padding: '6px 10px' }}>Zero-Width Joiner</td>
                      <td style={{ padding: '6px 10px' }}><strong>10</strong></td>
                      <td style={{ padding: '6px 10px' }}>2</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Nibble (b &gt;&gt; 2) &amp; 3</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px' }}><code style={{ color: '#fbbf24' }}>[WJ]</code></td>
                      <td style={{ padding: '6px 10px' }}><code>U+2060</code></td>
                      <td style={{ padding: '6px 10px' }}>Word Joiner</td>
                      <td style={{ padding: '6px 10px' }}><strong>11</strong></td>
                      <td style={{ padding: '6px 10px' }}>3</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Nibble b &amp; 3</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 10px' }}><code style={{ color: '#fb7185' }}>[BOM]</code></td>
                      <td style={{ padding: '6px 10px' }}><code>U+FEFF</code></td>
                      <td style={{ padding: '6px 10px' }}>Zero-Width No-Break Space</td>
                      <td style={{ padding: '6px 10px' }}><em>Framing</em></td>
                      <td style={{ padding: '6px 10px' }}>—</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Packet Header/Tag Framing Delimiters</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              <div className="theory-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#c084fc', fontWeight: 700, fontSize: '13px' }}>
                  <EyeOff size={15} />
                  <span>Base-4 Nibble Encoding</span>
                </div>
                <p>
                  Every byte (8 bits) is divided into four 2-bit symbols (4 zero-width glyphs per byte) and protected by a 16-bit CRC checksum.
                </p>
              </div>

              <div className="theory-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#10b981', fontWeight: 700, fontSize: '13px' }}>
                  <Lock size={15} />
                  <span>Salted Cryptographic Hash</span>
                </div>
                <p>
                  Block parity computes H(B_i) = SHA256(K : i : Norm(B_i))[:4]. Secret salt key K prevents adversarial forgery.
                </p>
              </div>

              <div className="theory-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}>
                  <ShieldCheck size={15} />
                  <span>Exact Tamper Localization</span>
                </div>
                <p>
                  Because SHA-256 exhibits the avalanche effect, altering even a single character in Block B_i causes a complete hash mismatch and immediately highlights that block in red.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
