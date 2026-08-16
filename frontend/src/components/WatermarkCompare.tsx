import { useState, useEffect, useCallback } from 'react';
import { Columns2, Play, CheckCircle2, XCircle } from 'lucide-react';
import type { WatermarkConfig, DetectionResult } from '../types';

interface Props {
  selectedModel: string;
  config: WatermarkConfig;
  maxTokens?: number;
  temperature?: number;
  promptSuffix?: string;
  disableThinking?: boolean;
  onRegisterRun?: (runFn: () => void, isRunning: boolean) => void;
}

interface CompareResult {
  unwatermarked: {
    text: string;
    stats: DetectionResult;
  };
  watermarked: {
    text: string;
    stats: DetectionResult;
  };
}

export const WatermarkCompare = ({
  selectedModel,
  config,
  maxTokens = 140,
  temperature = 0.7,
  promptSuffix,
  disableThinking,
  onRegisterRun
}: Props) => {
  const [prompt, setPrompt] = useState("Explain how transformers in deep learning process sequential text data.");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const runComparison = useCallback(async () => {
    if (isRunning || !prompt.trim()) return;
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/compare', {
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
          prompt_suffix: promptSuffix,
          disable_thinking: disableThinking
        })
      });

      if (!response.ok) {
        throw new Error(`Comparison failed: ${response.statusText}`);
      }

      const data: CompareResult = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Comparison error:', err);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, prompt, selectedModel, maxTokens, temperature, config, promptSuffix, disableThinking]);

  // Register run comparison callback
  useEffect(() => {
    onRegisterRun?.(runComparison, isRunning);
  }, [runComparison, isRunning, onRegisterRun]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Columns2 size={18} color="var(--brand-cyan)" />
              Side-by-Side Watermark Comparison
            </h2>
            <p className="panel-subtitle">
              Generates two completions from the same model with identical prompts: standard sampling (<code>δ = 0</code>) vs watermarked sampling (<code>δ = {config.delta.toFixed(1)}</code>).
            </p>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Prompt for both completions</label>
          <textarea
            className="text-area"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isRunning}
            rows={3}
            placeholder="Enter prompt to run baseline vs watermarked comparison..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Comparing: <strong>Unwatermarked (δ = 0)</strong> vs <strong>Watermarked (δ = {config.delta.toFixed(1)}, γ = {(config.gamma * 100).toFixed(0)}%)</strong>
          </div>
          <button className="btn-primary" onClick={runComparison} disabled={isRunning || !prompt.trim()}>
            <Play size={16} fill="currentColor" />
            {isRunning ? 'Generating Both Completions...' : 'Run Side-by-Side Comparison'}
          </button>
        </div>
      </div>

      {result && (
        <div className="compare-container">
          <div className="compare-col">
            <div className="compare-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Standard Unwatermarked (δ = 0)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Normal multinomial sampling
                </span>
              </div>
              <div className="badge-tag neutral">
                Z-Score: {result.unwatermarked.stats.z_score.toFixed(2)}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Green Tokens</span>
                <span className="stat-value">
                  {result.unwatermarked.stats.green_tokens} / {result.unwatermarked.stats.evaluated_tokens}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Green %</span>
                <span className="stat-value">
                  {(result.unwatermarked.stats.green_fraction * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="token-stream-box" style={{ minHeight: '200px' }}>
              {result.unwatermarked.stats.tokens.map((tok, i) => (
                <span
                  key={i}
                  className={`token-pill ${tok.is_green ? 'green' : 'red'}`}
                  title={`Token: ${tok.text} (ID: ${tok.id})`}
                >
                  {tok.text}
                </span>
              ))}
            </div>

            <div
              className={`verdict-banner ${result.unwatermarked.stats.is_watermarked ? 'detected' : 'undetected'}`}
              style={{ padding: '10px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={20} color="var(--text-muted)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Verdict: Unwatermarked</span>
              </div>
              <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Natural randomness</span>
            </div>
          </div>

          <div className="compare-col" style={{ borderColor: 'var(--watermark-green-border)' }}>
            <div className="compare-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--watermark-green)' }}>
                  Watermarked (δ = {config.delta.toFixed(1)})
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Green list logit promotion applied
                </span>
              </div>
              <div className="badge-tag green">
                Z-Score: {result.watermarked.stats.z_score.toFixed(2)}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Green Tokens</span>
                <span className="stat-value green">
                  {result.watermarked.stats.green_tokens} / {result.watermarked.stats.evaluated_tokens}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Green %</span>
                <span className="stat-value green">
                  {(result.watermarked.stats.green_fraction * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="token-stream-box" style={{ minHeight: '200px' }}>
              {result.watermarked.stats.tokens.map((tok, i) => (
                <span
                  key={i}
                  className={`token-pill ${tok.is_green ? 'green' : 'red'}`}
                  title={`Token: ${tok.text} (ID: ${tok.id})`}
                >
                  {tok.text}
                </span>
              ))}
            </div>

            <div
              className={`verdict-banner ${result.watermarked.stats.is_watermarked ? 'detected' : 'undetected'}`}
              style={{ padding: '10px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="var(--watermark-green)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Verdict: Watermarked</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--watermark-green)' }}>
                {result.watermarked.stats.confidence_level}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
