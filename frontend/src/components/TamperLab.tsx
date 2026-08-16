import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import type { WatermarkConfig, DetectionResult } from '../types';

interface Props {
  selectedModel: string;
  config: WatermarkConfig;
  initialText?: string;
  onRegisterRun?: (runFn: () => void) => void;
}

const DEFAULT_BASE_TEXT = "Artificial intelligence models rely heavily on autoregressive generation, where each token is sampled conditioning on the previous context. Text watermarking introduces subtle statistical signals into the token probabilities without compromising semantic coherence.";

export const TamperLab = ({ selectedModel, config, initialText, onRegisterRun }: Props) => {
  const [baseText, setBaseText] = useState(initialText || DEFAULT_BASE_TEXT);
  const [tamperedText, setTamperedText] = useState(initialText || DEFAULT_BASE_TEXT);
  const [mutationRate, setMutationRate] = useState(0.2); // 20% edits
  const [result, setResult] = useState<DetectionResult | null>(null);

  const analyzeText = useCallback(async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          model_name: selectedModel,
          gamma: config.gamma,
          hash_key: config.hash_key,
          context_width: config.context_width,
          z_threshold: 3.0
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      const data: DetectionResult = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedModel, config.gamma, config.hash_key, config.context_width]);

  useEffect(() => {
    if (initialText) {
      setBaseText(initialText);
      setTamperedText(initialText);
      analyzeText(initialText);
    }
  }, [initialText, analyzeText]);

  const applyMutation = useCallback(() => {
    const words = baseText.split(' ');
    const mutated = words.map((word) => {
      if (Math.random() < mutationRate) {
        const replacements = ['significantly', 'notably', 'systematically', 'conceptually', 'precisely', 'computationally', 'substantially'];
        const pick = replacements[Math.floor(Math.random() * replacements.length)];
        return pick;
      }
      return word;
    });
    const newText = mutated.join(' ');
    setTamperedText(newText);
    analyzeText(newText);
  }, [baseText, mutationRate, analyzeText]);

  useEffect(() => {
    onRegisterRun?.(applyMutation);
  }, [applyMutation, onRegisterRun]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <ShieldAlert size={18} color="var(--accent-amber)" />
              Watermark Robustness & Tamper Lab
            </h2>
            <p className="panel-subtitle">
              Simulate real-world attacks such as paraphrasing, human rewriting, and word replacements to test watermark survival.
            </p>
          </div>
        </div>

        <div className="grid-two-cols">
          <div className="control-group">
            <label className="control-label">Original Generated Text</label>
            <textarea
              className="text-area"
              value={baseText}
              onChange={(e) => setBaseText(e.target.value)}
              rows={4}
            />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span>Simulated Edit / Mutation Rate</span>
              <span className="control-val">{(mutationRate * 100).toFixed(0)}% words altered</span>
            </div>
            <input
              type="range"
              className="range-slider"
              min="0.0"
              max="0.8"
              step="0.05"
              value={mutationRate}
              onChange={(e) => setMutationRate(parseFloat(e.target.value))}
            />
            <button className="btn-primary" style={{ marginTop: '8px' }} onClick={applyMutation}>
              <RefreshCw size={14} />
              Simulate Edits & Re-Analyze
            </button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Tampered / Edited Text (Editable)</label>
          <textarea
            className="text-area"
            value={tamperedText}
            onChange={(e) => {
              setTamperedText(e.target.value);
              analyzeText(e.target.value);
            }}
            rows={4}
          />
        </div>

        {result && (
          <div>
            <div className="stats-grid" style={{ marginBottom: '14px' }}>
              <div className="stat-item">
                <span className="stat-label">Evaluated Transitions</span>
                <span className="stat-value">{result.evaluated_tokens}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Green Tokens</span>
                <span className="stat-value green">{result.green_tokens}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Green % (Exp: {(result.expected_fraction * 100).toFixed(0)}%)</span>
                <span className="stat-value green">{(result.green_fraction * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Z-Score</span>
                <span className="stat-value" style={{ color: result.z_score >= 3.0 ? 'var(--watermark-green)' : 'var(--accent-amber)' }}>
                  {result.z_score.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="token-stream-box" style={{ minHeight: '160px' }}>
              {result.tokens.map((tok, idx) => (
                <span
                  key={idx}
                  className={`token-pill ${tok.is_green === true ? 'green' : tok.is_green === false ? 'red' : 'unevaluated'}`}
                >
                  {tok.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
