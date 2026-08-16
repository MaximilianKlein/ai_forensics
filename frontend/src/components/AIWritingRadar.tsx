import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScanSearch,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Wand2,
  BookOpen,
  ArrowRight,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type {
  AIAnalysisResult,
  HeuristicHit,
  SampleCase,
  CategoryType,
  SuggestionFix
} from '../types';

interface AIWritingRadarProps {
  initialText?: string;
  onSendToWatermarkDetector?: (text: string) => void;
  onSendToDetectGPT?: (text: string) => void;
}

export function AIWritingRadar({
  initialText = '',
  onSendToWatermarkDetector,
  onSendToDetectGPT
}: AIWritingRadarProps) {
  const [inputText, setInputText] = useState<string>(initialText);
  const [analysisMode, setAnalysisMode] = useState<string>('wikipedia');
  const [samples, setSamples] = useState<SampleCase[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedClean, setCopiedClean] = useState<boolean>(false);
  const [activeLayerFilters, setActiveLayerFilters] = useState<Record<CategoryType, boolean>>({
    machine_artifacts: true,
    ai_vocabulary: true,
    rhetorical_syntax: true,
    structural_style: true,
    discourse_puffery: true,
    citations_integrity: true
  });
  const [hoveredHit, setHoveredHit] = useState<HeuristicHit | null>(null);
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);

  // Fetch preset samples on mount
  useEffect(() => {
    fetch('/api/ai-heuristics/samples')
      .then(res => res.json())
      .then((data: SampleCase[]) => {
        setSamples(data);
        if (data.length > 0) {
          setSelectedSampleId(prevId => {
            if (!prevId) {
              setInputText(prevText => prevText || data[0].text);
              return data[0].id;
            }
            return prevId;
          });
        }
      })
      .catch(err => console.warn('Could not fetch samples:', err));
  }, []);

  // Update text when initialText prop changes
  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
    }
  }, [initialText]);

  const handleAnalyze = useCallback(async (textToAnalyze?: string) => {
    const text = textToAnalyze !== undefined ? textToAnalyze : inputText;
    if (!text || !text.trim()) {
      setResult(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-heuristics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: analysisMode })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Analysis request failed');
      }

      const data: AIAnalysisResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown analysis error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, analysisMode]);

  // Debounced auto-analysis on text input or mode change
  useEffect(() => {
    if (!inputText.trim()) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => {
      handleAnalyze(inputText);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputText, analysisMode, handleAnalyze]);

  const handleSelectSample = (sampleId: string) => {
    const s = samples.find(x => x.id === sampleId);
    if (s) {
      setSelectedSampleId(sampleId);
      setInputText(s.text);
      handleAnalyze(s.text);
    }
  };

  const toggleLayer = (cat: CategoryType) => {
    setActiveLayerFilters(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleApplySingleSuggestion = (sugg: SuggestionFix) => {
    if (!result) return;
    const newText =
      inputText.slice(0, sugg.start_char) +
      sugg.replacement_text +
      inputText.slice(sugg.end_char);
    setInputText(newText);
    handleAnalyze(newText);
  };

  const handleApplyAllSuggestions = () => {
    if (!result || !result.cleaned_draft) return;
    setInputText(result.cleaned_draft);
    handleAnalyze(result.cleaned_draft);
    setCopiedClean(true);
    navigator.clipboard.writeText(result.cleaned_draft);
    setTimeout(() => setCopiedClean(false), 2500);
  };

  // Category visual metadata
  const categoryStyles: Record<CategoryType, { label: string; color: string; border: string; bg: string; icon: string }> = {
    machine_artifacts: {
      label: 'Platform Leaks & Search Tokens',
      color: '#ef4444',
      border: 'rgba(239, 68, 68, 0.4)',
      bg: 'rgba(239, 68, 68, 0.15)',
      icon: '🔴'
    },
    ai_vocabulary: {
      label: 'AI Vocabulary & Copula Avoidance',
      color: '#eab308',
      border: 'rgba(234, 179, 8, 0.4)',
      bg: 'rgba(234, 179, 8, 0.15)',
      icon: '🟡'
    },
    rhetorical_syntax: {
      label: 'Rhetorical Symmetry & Parallelisms',
      color: '#f97316',
      border: 'rgba(249, 115, 22, 0.4)',
      bg: 'rgba(249, 115, 22, 0.15)',
      icon: '🟠'
    },
    structural_style: {
      label: 'Markdown & Structural Uniformity',
      color: '#a855f7',
      border: 'rgba(168, 85, 247, 0.4)',
      bg: 'rgba(168, 85, 247, 0.15)',
      icon: '🟣'
    },
    discourse_puffery: {
      label: 'Significance Puffery & Weasel Tropes',
      color: '#3b82f6',
      border: 'rgba(59, 130, 246, 0.4)',
      bg: 'rgba(59, 130, 246, 0.15)',
      icon: '🔵'
    },
    citations_integrity: {
      label: 'Citations & DOI/ISBN Integrity',
      color: '#10b981',
      border: 'rgba(16, 185, 129, 0.4)',
      bg: 'rgba(16, 185, 129, 0.15)',
      icon: '🟢'
    }
  };

  // Build annotated text slices for highlighting
  const textSegments = useMemo(() => {
    if (!result || !result.text) return [{ text: inputText, hit: null }];

    const activeHits = result.hits.filter(h => activeLayerFilters[h.category]);
    if (activeHits.length === 0) return [{ text: result.text, hit: null }];

    // Sort hits
    const sorted = [...activeHits].sort((a, b) => a.start_char - b.start_char);

    const segments: Array<{ text: string; hit: HeuristicHit | null }> = [];
    let curIdx = 0;

    for (const h of sorted) {
      if (h.start_char < curIdx) continue; // Skip overlaps for visual simplicity

      if (h.start_char > curIdx) {
        segments.push({ text: result.text.slice(curIdx, h.start_char), hit: null });
      }

      segments.push({
        text: result.text.slice(h.start_char, h.end_char),
        hit: h
      });
      curIdx = h.end_char;
    }

    if (curIdx < result.text.length) {
      segments.push({ text: result.text.slice(curIdx), hit: null });
    }

    return segments;
  }, [result, activeLayerFilters, inputText]);

  // Compute 6-axis Radar Chart coordinates
  const radarAxes = useMemo(() => {
    if (!result) return [];
    return [
      { key: 'machine_artifacts', label: 'Platform Leaks', score: result.radar_scores.machine_artifacts, angle: -90 },
      { key: 'ai_vocabulary', label: 'AI Vocabulary', score: result.radar_scores.ai_vocabulary, angle: -30 },
      { key: 'rhetorical_syntax', label: 'Rhetoric / Syntax', score: result.radar_scores.rhetorical_syntax, angle: 30 },
      { key: 'structural_style', label: 'Structure / MoS', score: result.radar_scores.structural_style, angle: 90 },
      { key: 'discourse_puffery', label: 'Puffery & Tropes', score: result.radar_scores.discourse_puffery, angle: 150 },
      { key: 'stylometry_burstiness', label: 'Cadence Monotony', score: result.radar_scores.stylometry_burstiness, angle: 210 }
    ];
  }, [result]);

  const radarVertices = useMemo(() => {
    if (!radarAxes.length) return [];
    const cx = 160;
    const cy = 135;
    const maxR = 85;

    return radarAxes.map(axis => {
      const rad = (axis.angle * Math.PI) / 180;
      const r = (Math.max(6, Math.min(100, axis.score)) / 100) * maxR;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      return { x, y, score: axis.score, label: axis.label };
    });
  }, [radarAxes]);

  const radarPolygonPoints = useMemo(() => {
    return radarVertices.map(v => `${v.x},${v.y}`).join(' ');
  }, [radarVertices]);

  return (
    <div className="tab-content">
      {/* Top Header & Overview */}
      <div className="section-header">
        <div>
          <h2>🔍 Signs of AI Writing: Forensic Radar & Linter</h2>
          <p>
            Passive forensic detection based on{' '}
            <a
              href="https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
            >
              Wikipedia:Signs of AI writing
            </a>
            . Surfacing structural hallmarks, platform leaks, elevated vocabulary, copula avoidance, and significance puffery.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="select-input"
            value={analysisMode}
            onChange={e => setAnalysisMode(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            <option value="wikipedia">Mode: Wikipedia NPOV & MoS</option>
            <option value="general">Mode: General Prose & Essays</option>
            <option value="academic">Mode: Academic Papers</option>
          </select>
        </div>
      </div>

      {/* Mode Description Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          marginBottom: '16px'
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--brand-cyan)', whiteSpace: 'nowrap' }}>
          {analysisMode === 'wikipedia' ? '🏛️ Wikipedia NPOV & MoS Mode:' : analysisMode === 'general' ? '✍️ General Prose Mode:' : '🎓 Academic Papers Mode:'}
        </span>
        <span>
          {analysisMode === 'wikipedia' && 'Strict encyclopedic guidelines. Flags copula avoidance ("stands as a testament to"), unearned significance puffery, inline bold bullet lists, Title Case section headers, and search/platform leaks.'}
          {analysisMode === 'general' && 'Tuned for essays and creative prose. Relaxes encyclopedic formatting while flagging overrepresented AI buzzwords ("delve", "tapestry", "pivotal"), negative parallelisms ("not only... but also"), and sentence monotony.'}
          {analysisMode === 'academic' && 'Tuned for scholarly research. Flags generic methodology framing, repetitive gerund tricolons, citation/ISBN check-digit anomalies, and inflated academic hedging.'}
        </span>
      </div>

      {/* Preset Wikipedia AI Cases */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <BookOpen size={16} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-dim)' }}>
            LOAD PRESET TEST CASES FROM WIKIPEDIA ESSAY:
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {samples.map(s => {
            const isHuman = s.category === 'Human Control Baseline';
            const isLeak = s.category === 'Hard Machine Leaks';
            return (
              <button
                key={s.id}
                className={`button ${selectedSampleId === s.id ? 'primary' : 'secondary'}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background:
                    selectedSampleId === s.id
                      ? 'var(--color-primary)'
                      : isHuman
                      ? 'rgba(16, 185, 129, 0.12)'
                      : isLeak
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'var(--color-surface-hover)',
                  borderColor:
                    selectedSampleId === s.id
                      ? 'var(--color-primary)'
                      : isHuman
                      ? 'rgba(16, 185, 129, 0.4)'
                      : isLeak
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'var(--color-border)',
                  color:
                    selectedSampleId === s.id
                      ? '#fff'
                      : isHuman
                      ? '#10b981'
                      : isLeak
                      ? '#ef4444'
                      : 'var(--color-text)'
                }}
                onClick={() => handleSelectSample(s.id)}
              >
                <span>{isHuman ? '🟢' : isLeak ? '🔴' : '🟡'}</span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Input & Forensic Radar */}
      <div className="grid-2col" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        {/* Left Column: Text Input & Action */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label className="label" style={{ margin: 0 }}>
              Text Passage for Analysis
            </label>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
              <span>{inputText.length} chars</span>
              <span>•</span>
              <span>{inputText.trim() ? inputText.trim().split(/\s+/).length : 0} words</span>
            </div>
          </div>

          <textarea
            className="textarea"
            rows={9}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              setSelectedSampleId('');
            }}
            placeholder="Paste any article paragraph, Wikipedia diff, or AI response to scan for hallmarks of AI writing..."
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button secondary"
                onClick={() => {
                  setInputText('');
                  setSelectedSampleId('');
                  setResult(null);
                }}
                disabled={!inputText}
              >
                Clear
              </button>

              {onSendToWatermarkDetector && result && (
                <button
                  className="button secondary"
                  onClick={() => onSendToWatermarkDetector(inputText)}
                  title="Verify if text contains a cryptographic token watermark"
                >
                  <Layers size={14} />
                  Test Watermark
                </button>
              )}

              {onSendToDetectGPT && result && (
                <button
                  className="button secondary"
                  onClick={() => onSendToDetectGPT(inputText)}
                  title="Evaluate probability curvature under perturbations (DetectGPT)"
                >
                  <Activity size={14} />
                  DetectGPT Curvature
                </button>
              )}
            </div>

            <button
              className="button primary"
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !inputText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isAnalyzing ? <RefreshCw size={16} className="spin" /> : <ScanSearch size={16} />}
              <span>{isAnalyzing ? 'Scanning Heuristics...' : 'Run Forensic Scan'}</span>
            </button>
          </div>

          {error && (
            <div className="alert error" style={{ marginTop: '12px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: 6-Axis Radar & Overall Confidence Verdict */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>6-Axis AI Forensic Radar</h3>
            </div>
          </div>

          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              {/* SVG Radar Chart */}
              <div style={{ position: 'relative', width: '320px', height: '280px', display: 'flex', justifyContent: 'center' }}>
                <svg width="320" height="280" viewBox="0 0 320 280">
                  {/* Concentric guide hexagons */}
                  {[0.25, 0.5, 0.75, 1.0].map((level, lvlIdx) => {
                    const r = 85 * level;
                    const hexPoints = [0, 1, 2, 3, 4, 5]
                      .map(i => {
                        const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
                        return `${160 + r * Math.cos(angle)},${135 + r * Math.sin(angle)}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={lvlIdx}
                        points={hexPoints}
                        fill="none"
                        stroke="#223147"
                        strokeWidth="1"
                        strokeDasharray={level < 1.0 ? '3 3' : undefined}
                      />
                    );
                  })}

                  {/* Axis lines */}
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
                    const x = 160 + 85 * Math.cos(angle);
                    const y = 135 + 85 * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1="160"
                        y1="135"
                        x2={x}
                        y2={y}
                        stroke="#2a3c56"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Dynamic Radar Score Polygon */}
                  <polygon
                    points={radarPolygonPoints}
                    fill={
                      result.radar_scores.confidence_tier === 'definitive_machine_leak'
                        ? 'rgba(239, 68, 68, 0.35)'
                        : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                        ? 'rgba(249, 115, 22, 0.35)'
                        : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                        ? 'rgba(234, 179, 8, 0.35)'
                        : 'rgba(16, 185, 129, 0.3)'
                    }
                    stroke={
                      result.radar_scores.confidence_tier === 'definitive_machine_leak'
                        ? '#ef4444'
                        : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                        ? '#f97316'
                        : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                        ? '#eab308'
                        : '#10b981'
                    }
                    strokeWidth="2.5"
                  />

                  {/* Vertex Circles */}
                  {radarVertices.map((v, i) => (
                    <circle
                      key={i}
                      cx={v.x}
                      cy={v.y}
                      r="4"
                      fill={
                        result.radar_scores.confidence_tier === 'definitive_machine_leak'
                          ? '#ef4444'
                          : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                          ? '#f97316'
                          : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                          ? '#eab308'
                          : '#10b981'
                      }
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* Axis Text Labels */}
                  {radarAxes.map((axis, i) => {
                    const rad = (axis.angle * Math.PI) / 180;
                    const labelR = 108;
                    const x = 160 + labelR * Math.cos(rad);
                    const y = 135 + labelR * Math.sin(rad);
                    return (
                      <g key={i}>
                        <text
                          x={x}
                          y={y - 2}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#f1f5f9"
                          fontWeight="600"
                        >
                          {axis.label}
                        </text>
                        <text
                          x={x}
                          y={y + 11}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill={axis.score >= 50 ? '#f87171' : axis.score >= 25 ? '#fbbf24' : '#34d399'}
                          fontWeight="700"
                        >
                          {Math.round(axis.score)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Confidence Verdict Card */}
              <div
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor:
                    result.radar_scores.confidence_tier === 'definitive_machine_leak'
                      ? 'rgba(239, 68, 68, 0.6)'
                      : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                      ? 'rgba(249, 115, 22, 0.6)'
                      : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                      ? 'rgba(234, 179, 8, 0.6)'
                      : 'rgba(16, 185, 129, 0.6)',
                  background:
                    result.radar_scores.confidence_tier === 'definitive_machine_leak'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                      ? 'rgba(249, 115, 22, 0.15)'
                      : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {result.radar_scores.confidence_tier === 'low_evidence' ? (
                      <CheckCircle2 size={17} color="#10b981" />
                    ) : (
                      <AlertTriangle
                        size={17}
                        color={
                          result.radar_scores.confidence_tier === 'definitive_machine_leak'
                            ? '#ef4444'
                            : '#f97316'
                        }
                      />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                      {result.radar_scores.confidence_tier === 'definitive_machine_leak'
                        ? 'Definitive Machine Leak'
                        : result.radar_scores.confidence_tier === 'strong_stylistic_ai'
                        ? 'Strong AI Writing Hallmarks'
                        : result.radar_scores.confidence_tier === 'moderate_stylistic_ai'
                        ? 'Moderate AI Stylistic Markers'
                        : 'Clean / Natural Human Flow'}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text)' }}>
                    {result.radar_scores.overall_ai_score}/100
                  </span>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-dim)', lineHeight: '1.45' }}>
                  {result.radar_scores.verdict_summary}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)' }}>
              <span>Click "Run Forensic Scan" to view radar metrics</span>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Highlighter & De-AI Linter Section */}
      {result && (
        <div style={{ marginTop: '20px' }}>
          {/* Layer Filter Toggles */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="var(--color-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Active Evidence Layers:</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Object.keys(categoryStyles) as CategoryType[]).map(catKey => {
                  const meta = categoryStyles[catKey];
                  const breakdown = result.category_breakdowns[catKey];
                  const count = breakdown ? breakdown.count : 0;
                  const isActive = activeLayerFilters[catKey];

                  return (
                    <button
                      key={catKey}
                      onClick={() => toggleLayer(catKey)}
                      className="button"
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isActive ? meta.bg : 'var(--color-surface)',
                        borderColor: isActive ? meta.border : 'var(--color-border)',
                        color: isActive ? meta.color : 'var(--color-text-dim)',
                        opacity: isActive ? 1 : 0.6
                      }}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span
                        style={{
                          background: isActive ? meta.color : 'var(--color-border)',
                          color: isActive ? '#000' : 'var(--color-text-dim)',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '10px'
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sentence Rhythm & Cadence Barcode */}
          {result.sentences.length > 1 && (
            <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    Sentence Cadence & Burstiness Rhythm ({result.sentences.length} sentences):
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                  <span>Avg length: {result.metrics.avg_sentence_length}w</span>
                  <span style={{ margin: '0 6px' }}>•</span>
                  <span>StdDev: {result.metrics.sentence_length_std}w</span>
                  <span style={{ margin: '0 6px' }}>•</span>
                  <span>
                    Cadence: {result.metrics.burstiness_score < 40 ? '🟢 Bursty (Human-like)' : '🟡 Monotonous (AI-like)'}
                  </span>
                </div>
              </div>

              {/* Barcode Strip */}
              <div style={{ display: 'flex', gap: '4px', height: '42px', alignItems: 'flex-end', background: 'var(--bg-input)', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                {result.sentences.map((s, sIdx) => {
                  const maxW = Math.max(...result.sentences.map(x => x.word_count), 30);
                  const hPct = Math.max(20, Math.min(100, (s.word_count / maxW) * 100));
                  const isSelected = selectedSentenceIdx === sIdx;

                  let barColor = '#10b981';
                  if (s.has_critical) barColor = '#ef4444';
                  else if (s.hit_count > 0) barColor = '#f97316';

                  return (
                    <div
                      key={sIdx}
                      onClick={() => setSelectedSentenceIdx(isSelected ? null : sIdx)}
                      title={`Click to inspect Sentence #${s.index}: ${s.word_count} words, ${s.hit_count} hits`}
                      style={{
                        flex: 1,
                        height: `${hPct}%`,
                        background: barColor,
                        borderRadius: '2px',
                        cursor: 'pointer',
                        opacity: isSelected ? 1 : 0.75,
                        outline: isSelected ? '2px solid var(--brand-cyan)' : 'none',
                        transform: isSelected ? 'scaleY(1.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>

              {/* Cadence Detail Inspector */}
              <div style={{ marginTop: '10px', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                {selectedSentenceIdx !== null && result.sentences[selectedSentenceIdx] ? (
                  (() => {
                    const sel = result.sentences[selectedSentenceIdx];
                    const isTypicalLLM = sel.word_count >= 16 && sel.word_count <= 26;
                    const isShort = sel.word_count <= 10;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--brand-cyan)' }}>
                              Sentence #{sel.index} of {result.sentences.length}
                            </span>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'var(--bg-input)', fontSize: '0.75rem', fontWeight: 600 }}>
                              {sel.word_count} words
                            </span>
                            <span style={{ fontSize: '0.76rem', color: isTypicalLLM ? '#eab308' : isShort ? '#10b981' : '#38bdf8' }}>
                              {isTypicalLLM ? '🟡 Typical LLM Window (16–26 words)' : isShort ? '🟢 Short Punchy Sentence' : '🔵 Complex / Extended Sentence'}
                            </span>
                          </div>
                          <button
                            className="button secondary"
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                            onClick={() => setSelectedSentenceIdx(null)}
                          >
                            Deselect
                          </button>
                        </div>
                        <div style={{ fontStyle: 'italic', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid var(--brand-cyan)' }}>
                          "{sel.text}"
                        </div>
                        {sel.hit_count > 0 && (
                          <div style={{ fontSize: '0.76rem', color: '#f97316' }}>
                            ⚠️ Contains {sel.hit_count} flagged forensic hallmark(s) in this sentence.
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <span>
                      💡 <strong>Sentence Cadence Rhythm:</strong> Bar height represents sentence word count. Human writers vary between 4-word punchy sentences and 30-word complex thoughts. LLMs cluster monotonously around 18–25 words.
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      Click any bar above to inspect text
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Forensic Highlight Viewer and Linter Suggestions */}
          <div className="grid-2col" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
            {/* Interactive Annotated Text Box */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Annotated Forensic Text Inspector</h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  Hover highlighted spans for evidence details
                </span>
              </div>

              <div
                style={{
                  background: 'var(--color-surface)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  lineHeight: '1.8',
                  fontSize: '14px',
                  fontFamily: 'serif',
                  minHeight: '220px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {textSegments.map((seg, idx) => {
                  if (!seg.hit) {
                    return <span key={idx}>{seg.text}</span>;
                  }

                  const meta = categoryStyles[seg.hit.category];
                  const isHovered = hoveredHit === seg.hit;

                  return (
                    <mark
                      key={idx}
                      onMouseEnter={() => setHoveredHit(seg.hit)}
                      onMouseLeave={() => setHoveredHit(null)}
                      style={{
                        background: isHovered ? meta.color : meta.bg,
                        color: isHovered ? '#000' : 'inherit',
                        borderBottom: `2px solid ${meta.color}`,
                        padding: '1px 3px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {seg.text}
                    </mark>
                  );
                })}
              </div>

              {/* Hover Tooltip / Detail Card */}
              {hoveredHit && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: categoryStyles[hoveredHit.category].bg,
                    border: `1px solid ${categoryStyles[hoveredHit.category].border}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{categoryStyles[hoveredHit.category].icon}</span>
                      <strong style={{ fontSize: '13px', color: categoryStyles[hoveredHit.category].color }}>
                        {hoveredHit.rule_name}
                      </strong>
                    </div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>
                      Severity: {hoveredHit.severity}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--color-text)' }}>
                    {hoveredHit.explanation}
                  </p>
                  {hoveredHit.suggestion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--color-text-dim)' }}>Suggested Fix:</span>
                      <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        {hoveredHit.suggestion || '(Remove)'}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* De-AI-ifier Linter Suggestion Drawer */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wand2 size={16} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>"De-AI-ifier" Linter Fixes</h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  {result.suggestions.length} suggestions
                </span>
              </div>

              {result.suggestions.length > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                    <button
                      className="button primary"
                      style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleApplyAllSuggestions}
                    >
                      {copiedClean ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedClean ? 'Applied & Copied!' : 'Apply All & Copy Neutral Draft'}</span>
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.suggestions.map((sugg, sIdx) => (
                      <div
                        key={sugg.id || sIdx}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--color-surface)',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>
                              "{sugg.original_text}"
                            </span>
                            <ArrowRight size={12} />
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              {sugg.replacement_text ? `"${sugg.replacement_text}"` : '(Delete)'}
                            </span>
                          </div>

                          <button
                            className="button secondary"
                            style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                            onClick={() => handleApplySingleSuggestion(sugg)}
                          >
                            Apply Fix
                          </button>
                        </div>
                        <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: '11px' }}>
                          {sugg.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>No Linter Fixes Needed</span>
                  <span style={{ fontSize: '12px', marginTop: '4px' }}>Text follows clean encyclopedic tone.</span>
                </div>
              )}
            </div>
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
            <BookOpen size={18} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              How the 6-Axis AI Forensic Radar Works (Wikipedia MoS Guidelines)
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
              Based directly on <a href="https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Wikipedia:Signs of AI writing</a>. Evaluates 6 independent layers of stylistic, structural, and platform hallmarks that LLMs frequently exhibit.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="theory-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>
                  🔴 1. Machine Artifacts
                </div>
                <p>
                  Search leaks (<code>turn0search0</code>, <code>【1†source】</code>, <code>[cite: 1]</code>), tracking tags (<code>utm_source</code>), and assistant preambles.
                </p>
              </div>

              <div className="theory-box" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#eab308', marginBottom: '4px' }}>
                  🟡 2. AI Vocabulary & Copula
                </div>
                <p>
                  Overrepresented words (<em>delve, tapestry, testament, beacon, pivotal</em>) and copula avoidance (<em>"stands as a testament"</em>).
                </p>
              </div>

              <div className="theory-box" style={{ borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>
                  🟠 3. Rhetoric & Syntax
                </div>
                <p>
                  Negative parallelisms (<em>"not only X, but also Y"</em>, <em>"is not X, but Y"</em>) and formulaic gerund tricolons.
                </p>
              </div>

              <div className="theory-box" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#a855f7', marginBottom: '4px' }}>
                  🟣 4. Structure & MoS
                </div>
                <p>
                  Inline bold vertical lists (<code>* **Item:**</code>), clustered em-dashes, Title Case headings, and excess thematic breaks.
                </p>
              </div>

              <div className="theory-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                  🔵 5. Puffery & Weasels
                </div>
                <p>
                  Unearned significance (<em>"marking a pivotal moment"</em>), ecosystem homilies, and vague passive attributions.
                </p>
              </div>

              <div className="theory-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                  🟢 6. Cadence & Citations
                </div>
                <p>
                  Mathematical ISBN-10/13 checksum verification, DOI link validation, and stylometric burstiness (sentence variance).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
