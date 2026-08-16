import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Sliders,
  Layers,
  ArrowRight,
  TrendingDown,
  FileText,
  ScanSearch,
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type {
  DetectGPTResult,
  DetectGPTPreset
} from '../types';

interface DetectGPTLabProps {
  initialText?: string;
  selectedModel?: string;
  onSendToRadar?: (text: string) => void;
  onSendToWatermark?: (text: string) => void;
}

export const XTilde: React.FC<{ subscript?: string }> = ({ subscript }) => (
  <span className="math-xtilde">
    <span className="tilde">~</span>
    <span className="var">x{subscript && <sub style={{ fontStyle: 'normal', fontSize: '0.7em' }}>{subscript}</sub>}</span>
  </span>
);

export const DetectGPTLab: React.FC<DetectGPTLabProps> = ({
  initialText = '',
  selectedModel = '',
  onSendToRadar,
  onSendToWatermark
}) => {
  const [inputText, setInputText] = useState(initialText);
  const [numPerturbations, setNumPerturbations] = useState(10);
  const [perturbationPct, setPerturbationPct] = useState(0.15);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [presets, setPresets] = useState<DetectGPTPreset[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectGPTResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePerturbationIdx, setActivePerturbationIdx] = useState<number>(0);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);

  // Fetch presets
  useEffect(() => {
    fetch('/api/detect-gpt/presets')
      .then(res => res.json())
      .then((data: DetectGPTPreset[]) => {
        setPresets(data);
        if (!initialText && data.length > 0) {
          setSelectedPresetId(data[0].id);
          setInputText(data[0].text);
        }
      })
      .catch(err => console.error('Failed to load DetectGPT presets:', err));
  }, [initialText]);

  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
    }
  }, [initialText]);

  const handleRunDetectGPT = useCallback(async (textToAnalyze?: string) => {
    const text = textToAnalyze !== undefined ? textToAnalyze : inputText;
    if (!text || !text.trim()) {
      setResult(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/detect-gpt/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          num_perturbations: numPerturbations,
          perturbation_pct: perturbationPct,
          model_name: selectedModel || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'DetectGPT analysis failed');
      }

      const data: DetectGPTResult = await res.json();
      setResult(data);
      setActivePerturbationIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown DetectGPT error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, numPerturbations, perturbationPct, selectedModel]);

  const handleSelectPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setInputText(preset.text);
      handleRunDetectGPT(preset.text);
    }
  };

  // SVG Curvature Plot Coordinates
  const plotData = useMemo(() => {
    if (!result || !result.perturbations.length) return null;

    const allScores = [result.original_log_prob, ...result.perturbations.map(p => p.log_prob)];
    const minVal = Math.min(...allScores);
    const maxVal = Math.max(...allScores);
    const padding = Math.max(2.0, (maxVal - minVal) * 0.15);
    const domainMin = minVal - padding;
    const domainMax = maxVal + padding;
    const domainRange = domainMax - domainMin || 1.0;

    const width = 560;
    const height = 180;
    const plotMargin = { left: 40, right: 40, top: 35, bottom: 40 };
    const innerWidth = width - plotMargin.left - plotMargin.right;

    const scaleX = (val: number) => {
      return plotMargin.left + ((val - domainMin) / domainRange) * innerWidth;
    };

    const origX = scaleX(result.original_log_prob);
    const meanX = scaleX(result.mean_perturbed_log_prob);
    const stdLeftX = scaleX(result.mean_perturbed_log_prob - result.std_perturbed_log_prob);
    const stdRightX = scaleX(result.mean_perturbed_log_prob + result.std_perturbed_log_prob);

    const pertPoints = result.perturbations.map((p, i) => {
      // Jitter y-position for scatter clarity
      const yJitter = 95 + (Math.sin(i * 2.3) * 22);
      return {
        id: p.id,
        x: scaleX(p.log_prob),
        y: yJitter,
        log_prob: p.log_prob,
        delta: p.delta_from_original
      };
    });

    return {
      width,
      height,
      domainMin,
      domainMax,
      origX,
      meanX,
      stdLeftX,
      stdRightX,
      pertPoints
    };
  }, [result]);

  return (
    <div className="tab-content">
      {/* Header & Overview */}
      <div className="section-header">
        <div>
          <h2>⚡ DetectGPT: Perturbation Log-Probability Curvature</h2>
          <p>
            Zero-shot machine text detection based on{' '}
            <a
              href="https://arxiv.org/abs/2301.11305"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
            >
              Mitchell et al. (ICML 2023)
            </a>
            . Evaluates whether the candidate passage occupies a sharp local maximum (negative curvature) in probability space compared to perturbed variations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a
            href="https://arxiv.org/abs/2301.11305"
            target="_blank"
            rel="noreferrer"
            className="button secondary"
            style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
            DetectGPT Paper
          </a>
        </div>
      </div>

      {/* Preset Comparison Cases */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={16} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-dim)' }}>
            LOAD COMPARISON PRESETS:
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {presets.map(p => {
            const isAI = p.category === 'ai_generated';
            return (
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
                      : isAI
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(16, 185, 129, 0.12)',
                  borderColor:
                    selectedPresetId === p.id
                      ? 'var(--color-primary)'
                      : isAI
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'rgba(16, 185, 129, 0.4)',
                  color:
                    selectedPresetId === p.id
                      ? '#fff'
                      : isAI
                      ? '#ef4444'
                      : '#10b981'
                }}
                onClick={() => handleSelectPreset(p.id)}
              >
                <span>{isAI ? '🤖' : '✍️'}</span>
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Input & Parameters */}
      <div className="grid-2col" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '20px' }}>
        {/* Left: Passage Input */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label className="label" style={{ margin: 0 }}>
              Passage for Curvature Evaluation
            </label>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
              <span>{inputText.length} chars</span>
              <span>•</span>
              <span>{inputText.trim() ? inputText.trim().split(/\s+/).length : 0} words</span>
            </div>
          </div>

          <textarea
            className="textarea"
            rows={8}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              setSelectedPresetId('');
            }}
            placeholder="Paste candidate text to evaluate log-probability curvature across perturbed mutations..."
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button secondary"
                onClick={() => {
                  setInputText('');
                  setSelectedPresetId('');
                  setResult(null);
                }}
                disabled={!inputText}
              >
                <RotateCcw size={14} />
                Clear
              </button>

              {onSendToRadar && result && (
                <button
                  className="button secondary"
                  onClick={() => onSendToRadar(inputText)}
                  title="Scan text in Signs of AI Heuristics Radar"
                >
                  <ScanSearch size={14} />
                  Scan in Radar
                </button>
              )}

              {onSendToWatermark && result && (
                <button
                  className="button secondary"
                  onClick={() => onSendToWatermark(inputText)}
                  title="Test if text contains cryptographic token watermark"
                >
                  <Layers size={14} />
                  Test Watermark
                </button>
              )}
            </div>

            <button
              className="button primary"
              onClick={() => handleRunDetectGPT()}
              disabled={isAnalyzing || !inputText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isAnalyzing ? <Activity size={16} className="spin" /> : <Play size={16} />}
              <span>{isAnalyzing ? 'Evaluating Curvature...' : 'Run DetectGPT Analysis'}</span>
            </button>
          </div>

          {error && (
            <div className="alert error" style={{ marginTop: '12px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right: DetectGPT Hyperparameters & Model Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card-header" style={{ marginBottom: '0px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>Perturbation Parameters</h3>
            </div>
          </div>

          {/* Number of Perturbations slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                Perturbations Sampled (k)
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {numPerturbations} samples
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={25}
              step={1}
              value={numPerturbations}
              onChange={e => setNumPerturbations(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
              Number of perturbed text variants generated to estimate the local log-likelihood distribution.
            </span>
          </div>

          {/* Perturbation Percentage slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                Mutation Rate (α)
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {Math.round(perturbationPct * 100)}% of words
              </span>
            </div>
            <input
              type="range"
              min={0.08}
              max={0.30}
              step={0.01}
              value={perturbationPct}
              onChange={e => setPerturbationPct(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
              Fraction of candidate content words substituted per perturbation (standard DetectGPT range: 10–20%).
            </span>
          </div>

          {/* Scoring Engine Notice */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              fontSize: '11.5px',
              color: 'var(--color-text-dim)',
              lineHeight: '1.45'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--color-text)' }}>
              <Activity size={14} color="var(--color-primary)" />
              <strong>Evaluation Engine</strong>
            </div>
            <span>
              {selectedModel
                ? `Using active local GGUF model: ${selectedModel}`
                : 'Using calibrated zero-shot statistical language model evaluator.'}
            </span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Verdict & Key Metrics Cards */}
          <div className="grid-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {/* Metric 1: Verdict */}
            <div
              className="card"
              style={{
                padding: '16px',
                border: '1px solid',
                borderColor:
                  result.verdict === 'likely_ai'
                    ? 'rgba(239, 68, 68, 0.6)'
                    : result.verdict === 'uncertain'
                    ? 'rgba(234, 179, 8, 0.6)'
                    : 'rgba(16, 185, 129, 0.6)',
                background:
                  result.verdict === 'likely_ai'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : result.verdict === 'uncertain'
                    ? 'rgba(234, 179, 8, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {result.verdict === 'likely_ai' ? (
                  <AlertTriangle size={18} color="#ef4444" />
                ) : result.verdict === 'uncertain' ? (
                  <HelpCircle size={18} color="#eab308" />
                ) : (
                  <CheckCircle2 size={18} color="#10b981" />
                )}
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                  DETECTGPT VERDICT
                </span>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color:
                    result.verdict === 'likely_ai'
                      ? '#ef4444'
                      : result.verdict === 'uncertain'
                      ? '#eab308'
                      : '#10b981',
                  marginBottom: '4px'
                }}
              >
                {result.verdict === 'likely_ai'
                  ? 'Likely AI-Generated'
                  : result.verdict === 'uncertain'
                  ? 'Uncertain Curvature'
                  : 'Likely Human-Written'}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                Confidence: {result.confidence_pct}%
              </span>
            </div>

            {/* Metric 2: Z-Score */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                DETECTGPT Z-SCORE
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: result.z_score >= 1.75 ? '#ef4444' : result.z_score >= 0.85 ? '#eab308' : '#10b981',
                  marginBottom: '4px'
                }}
              >
                {result.z_score > 0 ? `+${result.z_score}` : result.z_score}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                {result.z_score >= 1.75 ? 'Strong negative curvature (Peak)' : 'Within normal human variance'}
              </span>
            </div>

            {/* Metric 3: Discrepancy Score */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                CURVATURE DISCREPANCY (Δ)
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: result.discrepancy_score > 0 ? '#f97316' : '#38bdf8',
                  marginBottom: '4px'
                }}
              >
                {result.discrepancy_score > 0 ? `+${result.discrepancy_score}` : result.discrepancy_score}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center' }}>
                <span>log p(x) − μ(log p(</span><XTilde /><span>))</span>
              </span>
            </div>

            {/* Metric 4: Perplexity Comparison */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                PERPLEXITY COMPARISON
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>
                  {result.original_perplexity}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  vs {result.mean_perturbed_perplexity} (μ perturbed)
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                {result.original_perplexity < result.mean_perturbed_perplexity
                  ? 'Perturbations increase perplexity (Expected for AI)'
                  : 'Perturbations have comparable perplexity'}
              </span>
            </div>
          </div>

          {/* Probability Curvature Chart */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={18} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Log-Probability Landscape: Original <em>x</em> vs Perturbations</span>
                  <XTilde />
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span>Original Candidate <em>x</em></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                  <span>Perturbations <XTilde subscript="i" /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '2px', background: '#eab308', display: 'inline-block' }} />
                  <span>Perturbed Mean (μ)</span>
                </div>
              </div>
            </div>

            {/* SVG Plot */}
            {plotData && (
              <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <svg width={plotData.width} height={plotData.height} viewBox={`0 0 ${plotData.width} ${plotData.height}`}>
                  {/* Axis baseline */}
                  <line
                    x1="30"
                    y1="130"
                    x2={plotData.width - 30}
                    y2="130"
                    stroke="#2a3c56"
                    strokeWidth="1.5"
                  />

                  {/* Standard deviation band [mu - sigma, mu + sigma] */}
                  <rect
                    x={plotData.stdLeftX}
                    y="45"
                    width={Math.max(4, plotData.stdRightX - plotData.stdLeftX)}
                    height="85"
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeDasharray="3 3"
                    rx="4"
                  />

                  {/* Perturbed Mean Vertical Line */}
                  <line
                    x1={plotData.meanX}
                    y1="35"
                    x2={plotData.meanX}
                    y2="130"
                    stroke="#eab308"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={plotData.meanX}
                    y="28"
                    textAnchor="middle"
                    fill="#eab308"
                    fontSize="11"
                    fontWeight="700"
                  >
                    μ = {result.mean_perturbed_log_prob}
                  </text>

                  {/* Perturbation scatter points */}
                  {plotData.pertPoints.map(p => (
                    <g
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActivePerturbationIdx(p.id - 1)}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={activePerturbationIdx === p.id - 1 ? 7 : 5}
                        fill="#38bdf8"
                        stroke={activePerturbationIdx === p.id - 1 ? '#ffffff' : '#0284c7'}
                        strokeWidth={activePerturbationIdx === p.id - 1 ? 2.5 : 1.5}
                        opacity={0.85}
                      />
                      <text
                        x={p.x}
                        y={p.y + 16}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="9.5"
                      >
                        #{p.id}
                      </text>
                    </g>
                  ))}

                  {/* Original Text Peak Marker */}
                  <line
                    x1={plotData.origX}
                    y1="35"
                    x2={plotData.origX}
                    y2="130"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                  <polygon
                    points={`${plotData.origX},40 ${plotData.origX - 8},55 ${plotData.origX + 8},55`}
                    fill="#ef4444"
                  />
                  <circle
                    cx={plotData.origX}
                    cy="85"
                    r="8"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  <text
                    x={plotData.origX}
                    y="28"
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize="11"
                    fontWeight="800"
                  >
                    log p(x) = {result.original_log_prob}
                  </text>

                  {/* Axis domain labels */}
                  <text x="35" y="150" fill="#64748b" fontSize="10">
                    Lower Likelihood ({plotData.domainMin.toFixed(1)})
                  </text>
                  <text x={plotData.width - 35} y="150" textAnchor="end" fill="#64748b" fontSize="10">
                    Higher Likelihood ({plotData.domainMax.toFixed(1)})
                  </text>
                </svg>
              </div>
            )}

            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: 'var(--color-text-dim)', lineHeight: '1.5' }}>
              {result.summary}
            </p>
          </div>

          {/* Side-by-Side Perturbation Inspector */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '15px' }}>
                  Perturbation Inspector: Sample #{activePerturbationIdx + 1} of {result.perturbations.length}
                </h3>
              </div>

              {/* Sample Selector Tabs */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {result.perturbations.map((p, idx) => (
                  <button
                    key={p.id}
                    className={`button ${activePerturbationIdx === idx ? 'primary' : 'secondary'}`}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}
                    onClick={() => setActivePerturbationIdx(idx)}
                  >
                    #{p.id} ({p.delta_from_original > 0 ? `-${p.delta_from_original}` : `+${Math.abs(p.delta_from_original)}`})
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Perturbation Details */}
            {result.perturbations[activePerturbationIdx] && (
              <div>
                {/* Stats Bar */}
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--color-surface-hover)',
                    marginBottom: '12px',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--color-text-dim)' }}>Perturbed Log Prob: </span>
                    <strong style={{ color: 'var(--color-text)' }}>
                      {result.perturbations[activePerturbationIdx].log_prob}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-dim)' }}>Drop from Original (Δ): </span>
                    <strong
                      style={{
                        color:
                          result.perturbations[activePerturbationIdx].delta_from_original > 0
                            ? '#ef4444'
                            : '#10b981'
                      }}
                    >
                      {result.perturbations[activePerturbationIdx].delta_from_original > 0
                        ? `-${result.perturbations[activePerturbationIdx].delta_from_original}`
                        : `+${Math.abs(result.perturbations[activePerturbationIdx].delta_from_original)}`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-dim)' }}>Mutations: </span>
                    <strong style={{ color: 'var(--color-text)' }}>
                      {result.perturbations[activePerturbationIdx].diff_count} words
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-dim)' }}>Perplexity: </span>
                    <strong style={{ color: 'var(--color-text)' }}>
                      {result.perturbations[activePerturbationIdx].perplexity}
                    </strong>
                  </div>
                </div>

                {/* Mutated Words List */}
                {result.perturbations[activePerturbationIdx].mutated_words.length > 0 && (
                  <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                      Mutated Words:
                    </span>
                    {result.perturbations[activePerturbationIdx].mutated_words.map((m, mIdx) => (
                      <span
                        key={mIdx}
                        style={{
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ textDecoration: 'line-through', opacity: 0.75 }}>{m.original}</span>
                        <ArrowRight size={12} />
                        <strong>{m.replacement}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Text View */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    lineHeight: '1.6',
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {result.perturbations[activePerturbationIdx].text}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Embedded "How It Works" Collapsible Panel */}
      <div className="card" style={{ marginTop: '8px', padding: '18px 22px' }}>
        <div
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              How DetectGPT Probability Curvature Works (Mitchell et al., ICML 2023)
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
              DetectGPT operates on the hypothesis that <strong>LLM-generated text lies in local maxima of the model's log-probability function</strong> (negative curvature).
              Small semantic perturbations almost always lower the log-probability for AI text, whereas human prose resides in flatter, more diverse semantic valleys.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="theory-box">
                  <strong style={{ color: '#ef4444', fontSize: '13px' }}>🤖 Machine Text (Local Peak):</strong>
                  <p style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
                    <code>d(x) = log p(x) - (1/k) ∑ log p(</code><XTilde subscript="i" /><code>) &gt;&gt; 0</code>
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                    Discrepancy is large and positive (z ≥ 1.75).
                  </span>
                </div>

                <div className="theory-box">
                  <strong style={{ color: '#10b981', fontSize: '13px' }}>✍️ Human Text (Flat/Valleys):</strong>
                  <p style={{ margin: '4px 0 0 0' }}>
                    <code>d(x) ≈ 0  (z &lt; 0.85)</code>
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                    Perturbations do not systematically lower model probability.
                  </span>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: '6px' }}>
                  CURVATURE Z-SCORE FORMULATION
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--brand-cyan)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>log p(x) = ∑ log p(x<sub>t</sub> | x<sub>&lt;t</sub>)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span>μ(<XTilde />) = (1/k) ∑ log p(</span><XTilde subscript="i" /><span>)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span>σ(<XTilde />) = std(log p(</span><XTilde subscript="i" /><span>))</span>
                  </div>
                  <div style={{ color: 'var(--color-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                    <span>z = (log p(x) - μ(<XTilde />)) / σ(<XTilde />)</span>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                  Threshold: <code>z ≥ 1.75</code> indicates AI peak.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
