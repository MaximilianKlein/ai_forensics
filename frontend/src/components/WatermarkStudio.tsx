import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, ArrowRight, Sparkles, BookOpen, ChevronDown, ChevronUp, Key, Layers, TrendingUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ModelInfo, WatermarkConfig, StreamTokenEvent } from '../types';

interface Props {
  models: ModelInfo[];
  selectedModel: string;
  config: WatermarkConfig;
  onChangeConfig: (c: WatermarkConfig) => void;
  maxTokens?: number;
  temperature?: number;
  onSendToDetector: (text: string) => void;
  onSendToRadar?: (text: string) => void;
  onSendToDetectGPT?: (text: string) => void;
  onSendToTamper?: (text: string) => void;
  onRegisterControls?: (startFn: () => void, stopFn: () => void, isGenerating: boolean) => void;
}

const PROMPT_PRESETS = [
  "Explain quantum computing and quantum superposition in simple terms for a high school student.",
  "Write an essay discussing the ethical implications of artificial intelligence in healthcare.",
  "Describe how photosynthesis works inside plant cells and why it is vital for Earth's atmosphere.",
  "Compose a short philosophical story about a lighthouse keeper and the nature of time."
];

export const WatermarkStudio = ({
  models,
  selectedModel,
  config,
  maxTokens = 160,
  temperature = 0.7,
  onSendToDetector,
  onSendToRadar,
  onSendToDetectGPT,
  onSendToTamper,
  onRegisterControls
}: Props) => {
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokens, setTokens] = useState<StreamTokenEvent[]>([]);
  const [fullText, setFullText] = useState('');
  const [hoveredToken, setHoveredToken] = useState<StreamTokenEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeModel = models.find((m) => m.name === selectedModel);
  const effectiveSuffix =
    activeModel?.prompt_suffix !== undefined
      ? activeModel.prompt_suffix
      : selectedModel.toLowerCase().includes('gemma')
      ? '\n<|channel>\n<channel|>\n'
      : '\n';
  const effectiveThinkingBypass = activeModel?.disable_thinking !== false;

  const startGeneration = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setTokens([]);
    setFullText('');
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model_name: selectedModel,
          max_tokens: maxTokens,
          temperature,
          gamma: config.gamma,
          delta: config.delta,
          hash_key: config.hash_key,
          context_width: config.context_width,
          prompt_suffix: effectiveSuffix,
          disable_thinking: effectiveThinkingBypass
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let msg = `Server error: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            msg = errData.detail;
          }
        } catch {
          // ignore
        }
        setErrorMessage(msg);
        setIsGenerating(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'token') {
                setTokens((prev) => [...prev, data]);
                accumulatedText += data.text;
                setFullText(accumulatedText);
              } else if (data.type === 'done') {
                if (data.full_text) {
                  setFullText(data.full_text);
                }
              } else if (data.type === 'error') {
                setErrorMessage(data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE event:', e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Generation failed:', err);
        setErrorMessage(err.message || 'Generation failed');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    prompt,
    selectedModel,
    maxTokens,
    temperature,
    config,
    effectiveSuffix,
    effectiveThinkingBypass
  ]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latestStats = tokens.length > 0 ? tokens[tokens.length - 1] : null;
  const greenPct = latestStats ? (latestStats.green_fraction * 100).toFixed(1) : '0.0';
  const zScore = latestStats ? latestStats.z_score.toFixed(2) : '0.00';

  useEffect(() => {
    onRegisterControls?.(startGeneration, stopGeneration, isGenerating);
  }, [startGeneration, stopGeneration, isGenerating, onRegisterControls]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Sparkles size={18} color="var(--brand-cyan)" />
              Live Token Watermark Stream
            </h2>
            <p className="panel-subtitle">Tokens highlighted green are from the pseudorandom green list</p>
          </div>

          {fullText && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={copyToClipboard}
                title="Copy generated text"
              >
                <Copy size={14} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="btn-primary"
                onClick={() => onSendToDetector(fullText)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <span>Verify in Detector</span>
                <ArrowRight size={14} />
              </button>
              {onSendToRadar && (
                <button
                  className="button secondary"
                  style={{ color: '#f59e0b', fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => onSendToRadar(fullText)}
                >
                  <span>AI Radar</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {onSendToDetectGPT && (
                <button
                  className="button secondary"
                  style={{ color: '#38bdf8', fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => onSendToDetectGPT(fullText)}
                >
                  <span>DetectGPT</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {onSendToTamper && (
                <button
                  className="button secondary"
                  style={{ color: '#ef4444', fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => onSendToTamper(fullText)}
                  title="Send generated watermark to Tamper & Robustness Lab"
                >
                  <ShieldAlert size={14} />
                  <span>Tamper Lab</span>
                </button>
              )}
            </div>
          )}
        </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Presets:
            </span>
            {PROMPT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                className="button secondary"
                style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '12px' }}
                onClick={() => setPrompt(p)}
                disabled={isGenerating}
              >
                Sample {idx + 1}
              </button>
            ))}
          </div>

          <textarea
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            disabled={isGenerating}
            rows={3}
          />

          {/* Active Thinking Bypass / Prompt Suffix Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              padding: '6px 10px',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className={`status-indicator ${effectiveThinkingBypass ? '' : 'offline'}`}
                style={{ width: '6px', height: '6px' }}
              />
              <span>
                {effectiveThinkingBypass
                  ? `Thinking Bypass Active: ${
                      effectiveSuffix === '\n'
                        ? '\\n (Newline)'
                        : effectiveSuffix.includes('<|channel>')
                        ? '<|channel>...<channel|> (Gemma 4)'
                        : JSON.stringify(effectiveSuffix)
                    }`
                  : 'Thinking Bypass Disabled'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPromptPreview(!showPromptPreview)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-cyan)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              {showPromptPreview ? 'Hide Effective Prompt' : 'Preview Prompt Sent to LLM'}
            </button>
          </div>

          {showPromptPreview && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '120px',
                overflowY: 'auto'
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                FULL PROMPT TRANSMITTED TO MODEL ENGINE:
              </div>
              <span>
                {effectiveThinkingBypass
                  ? prompt + (prompt.endsWith('\n') && effectiveSuffix.startsWith('\n') ? effectiveSuffix.slice(1) : effectiveSuffix)
                  : prompt}
              </span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                background: 'var(--watermark-red-bg)',
                border: '1px solid var(--watermark-red-border)',
                color: '#fda4af',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                lineHeight: 1.5
              }}
            >
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-label">Generated Tokens</span>
              <span className="stat-value">{tokens.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Green Fraction</span>
              <span className="stat-value green">
                {greenPct}% <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(exp: {(config.gamma * 100).toFixed(0)}%)</small>
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Z-Score (Significance)</span>
              <span className="stat-value" style={{ color: parseFloat(zScore) >= 3.0 ? 'var(--watermark-green)' : 'var(--text-primary)' }}>
                {zScore}
              </span>
            </div>
          </div>

          <div className="token-stream-box">
            {tokens.length === 0 && !isGenerating && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                Click "Generate Watermarked Text" to start autoregressive generation with token interception.
              </div>
            )}

            {tokens.map((tok, i) => (
              <span
                key={i}
                className={`token-pill ${tok.is_green ? 'green' : 'red'}`}
                onMouseEnter={() => setHoveredToken(tok)}
                onMouseLeave={() => setHoveredToken(null)}
              >
                {tok.text}
              </span>
            ))}

            {isGenerating && <span className="stream-cursor" />}
          </div>

          {hoveredToken && (
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                display: 'flex',
                gap: '16px',
                color: 'var(--text-secondary)'
              }}
            >
              <span>Token: <code style={{ color: 'var(--text-primary)' }}>{JSON.stringify(hoveredToken.text)}</code></span>
              <span>ID: <code style={{ color: 'var(--brand-cyan)' }}>{hoveredToken.token_id}</code></span>
              <span>
                Status:{' '}
                <strong style={{ color: hoveredToken.is_green ? 'var(--watermark-green)' : 'var(--watermark-red)' }}>
                  {hoveredToken.is_green ? 'GREEN LIST (Boosted)' : 'RED LIST (Unboosted)'}
                </strong>
              </span>
            </div>
          )}
        </div>

      {/* Embedded "How It Works" Collapsible Panel */}
      <div className="card" style={{ marginTop: '8px', padding: '18px 22px' }}>
        <div
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--brand-cyan)" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              How Token Watermarking (Kirchenbauer et al.) Works
            </h3>
          </div>
          <button className="button secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
            <span>{showHowItWorks ? 'Hide Theory' : 'Show Theory & Math'}</span>
            {showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showHowItWorks && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p className="theory-intro">
              Statistical token watermarking intercepts the model's logits before Softmax without retraining weights.
              A secret key <code>K</code> and previous context tokens deterministically partition the vocabulary into a boosted green list and unboosted red list.
            </p>

            <div className="step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div className="step-card">
                <span className="step-num">STEP 01</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <Key size={15} color="var(--brand-cyan)" />
                  <h4>Context Hashing</h4>
                </div>
                <p>
                  <code>seed = hash(x_(t-1), K)</code> deterministically seeds a pseudo-random permutation.
                </p>
              </div>

              <div className="step-card">
                <span className="step-num">STEP 02</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <Layers size={15} color="var(--watermark-green)" />
                  <h4>Green List Partition</h4>
                </div>
                <p>
                  Vocabulary <code>V</code> is partitioned into <strong>Green List</strong> <code>G</code> (size <code>γ|V|</code>) and <strong>Red List</strong> <code>R</code>.
                </p>
              </div>

              <div className="step-card">
                <span className="step-num">STEP 03</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <TrendingUp size={15} color="var(--brand-cyan)" />
                  <h4>Logit Biasing</h4>
                </div>
                <p>
                  <code>logits'[v] = logits[v] + δ · 𝟙(v ∈ G)</code> promotes green candidates during sampling.
                </p>
              </div>

              <div className="step-card">
                <span className="step-num">STEP 04</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <ShieldCheck size={15} color="var(--watermark-green)" />
                  <h4>Z-Score Statistical Verification</h4>
                </div>
                <p>
                  <code>z = (N_G - γN) / √(Nγ(1-γ))</code> verifies if green token count is statistically impossible by chance (z ≥ 4.0).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
