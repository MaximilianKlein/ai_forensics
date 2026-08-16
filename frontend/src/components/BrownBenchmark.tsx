import { useState, useEffect } from 'react';
import {
  BarChart3,
  ShieldCheck,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  Bot,
  User,
  Zap,
  Columns2,
  X
} from 'lucide-react';
import type {
  BenchmarkDataset,
  WatermarkedDataset,
  WatermarkedPairSample,
  DetectionResult,
  TokenItem
} from '../types';

export const BrownBenchmark = () => {
  const [activeDataset, setActiveDataset] = useState<'brown' | 'llm' | 'watermarked'>('brown');
  const [brownData, setBrownData] = useState<BenchmarkDataset | null>(null);
  const [llmData, setLlmData] = useState<BenchmarkDataset | null>(null);
  const [wmData, setWmData] = useState<WatermarkedDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'z_score' | 'green_fraction' | 'total_tokens'>('z_score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Inspect single document state
  const [inspectedDocId, setInspectedDocId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<{ clean_text: string; result: DetectionResult; prompt?: string } | null>(null);
  const [selectedWmPair, setSelectedWmPair] = useState<WatermarkedPairSample | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hoveredToken, setHoveredToken] = useState<TokenItem | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Brown results
      const resBrown = await fetch('/api/benchmark/results');
      if (resBrown.ok) {
        const jsonBrown: BenchmarkDataset = await resBrown.json();
        setBrownData(jsonBrown);
      }

      // 2. Fetch LLM results
      try {
        const resLlm = await fetch('/api/benchmark/llm/results');
        if (resLlm.ok) {
          const jsonLlm: BenchmarkDataset = await resLlm.json();
          setLlmData(jsonLlm);
        }
      } catch {}

      // 3. Fetch Watermarked Eval results
      try {
        const resWm = await fetch('/api/benchmark/watermarked/results');
        if (resWm.ok) {
          const jsonWm: WatermarkedDataset = await resWm.json();
          setWmData(jsonWm);
        }
      } catch {}

    } catch (e: any) {
      setError(e.message || "Failed to load benchmark results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
    const interval = setInterval(fetchDatasets, 6000);
    return () => clearInterval(interval);
  }, []);

  const openDocumentDetail = async (docId: string) => {
    setInspectedDocId(docId);
    setLoadingDetail(true);

    if (activeDataset === 'brown') {
      try {
        const res = await fetch(`/api/benchmark/document/${docId}`);
        if (!res.ok) throw new Error("Failed to load document details");
        const json = await res.json();
        setDocDetail(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingDetail(false);
      }
    } else {
      const item = llmData?.documents.find((d: any) => d.id === docId);
      if (item) {
        setDocDetail({
          clean_text: item.preview,
          prompt: (item as any).prompt,
          result: {
            total_tokens: item.total_tokens,
            evaluated_tokens: item.evaluated_tokens,
            green_tokens: item.green_tokens,
            red_tokens: item.red_tokens,
            green_fraction: item.green_fraction,
            expected_fraction: 0.25,
            z_score: item.z_score,
            p_value: item.p_value,
            is_watermarked: item.is_watermarked_z3,
            confidence_level: item.is_watermarked_z3 ? "False Positive (z >= 3)" : "True Negative (Unwatermarked LLM)",
            tokens: [],
            summary: `LLM Response from ${item.category} (${item.total_tokens} tokens, Z: ${item.z_score})`
          }
        });
      }
      setLoadingDetail(false);
    }
  };

  const closeDocumentDetail = () => {
    setInspectedDocId(null);
    setDocDetail(null);
    setSelectedWmPair(null);
  };

  if (loading && !brownData && !llmData && !wmData) {
    return (
      <div className="tab-content">
        <div className="panel-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Clock size={36} color="var(--brand-cyan)" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Loading Benchmark Datasets...</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>
            {error || 'Fetching human baseline, unwatermarked AI, and empirical watermarked generations.'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="tab-content">
      {/* Dataset Selector Bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '12px 18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary ${activeDataset === 'brown' ? 'active-btn' : ''}`}
            style={{
              background: activeDataset === 'brown' ? 'var(--brand-cyan-dim)' : 'var(--bg-input)',
              borderColor: activeDataset === 'brown' ? 'var(--brand-cyan)' : 'var(--border-color)',
              color: activeDataset === 'brown' ? 'var(--brand-cyan)' : 'var(--text-secondary)',
              fontWeight: activeDataset === 'brown' ? 600 : 500,
              padding: '8px 14px'
            }}
            onClick={() => {
              setActiveDataset('brown');
              setSelectedCategory('all');
            }}
          >
            <User size={15} />
            Human Prose (Brown Corpus - 500 Docs)
          </button>

          <button
            className={`btn-secondary ${activeDataset === 'llm' ? 'active-btn' : ''}`}
            style={{
              background: activeDataset === 'llm' ? 'var(--brand-cyan-dim)' : 'var(--bg-input)',
              borderColor: activeDataset === 'llm' ? 'var(--brand-cyan)' : 'var(--border-color)',
              color: activeDataset === 'llm' ? 'var(--brand-cyan)' : 'var(--text-secondary)',
              fontWeight: activeDataset === 'llm' ? 600 : 500,
              padding: '8px 14px'
            }}
            onClick={() => {
              setActiveDataset('llm');
              setSelectedCategory('all');
            }}
          >
            <Bot size={15} />
            Unwatermarked LLMs (UltraFeedback Baseline - 500 Docs)
          </button>

          <button
            className={`btn-secondary ${activeDataset === 'watermarked' ? 'active-btn' : ''}`}
            style={{
              background: activeDataset === 'watermarked' ? 'var(--brand-cyan-dim)' : 'var(--bg-input)',
              borderColor: activeDataset === 'watermarked' ? 'var(--brand-cyan)' : 'var(--border-color)',
              color: activeDataset === 'watermarked' ? 'var(--brand-cyan)' : 'var(--text-secondary)',
              fontWeight: activeDataset === 'watermarked' ? 600 : 500,
              padding: '8px 14px'
            }}
            onClick={() => {
              setActiveDataset('watermarked');
              setSelectedCategory('all');
            }}
          >
            <Zap size={15} />
            Watermarked vs Unwatermarked Pairs (Gemma 4 on UltraFeedback)
            {wmData && <span className="badge-tag green" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>{wmData.samples.length} Pairs</span>}
          </button>
        </div>

        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={fetchDatasets}>
          Refresh
        </button>
      </div>

      {/* RENDER WATERMARKED DATASET VIEW */}
      {activeDataset === 'watermarked' ? (
        wmData && wmData.samples.length > 0 ? (
          <div>
            {/* Header Banner */}
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 className="panel-title" style={{ fontSize: '1.25rem' }}>
                      <Zap size={22} color="var(--watermark-green)" />
                      Empirical Watermarked vs Unwatermarked Generations (Gemma 4)
                    </h2>
                    <span className="badge-tag green">{wmData.samples.length} Paired Samples</span>
                  </div>
                  <p className="panel-subtitle" style={{ marginTop: '4px' }}>
                    Identical prompts from <strong>openbmb/UltraFeedback</strong> executed on local <strong>{wmData.metadata.model_name}</strong> with \(\delta = 0.0\) (unwatermarked) vs \(\delta = {wmData.metadata.watermark_config.delta}\) (watermarked).
                  </p>
                </div>
              </div>

              {/* Comparative Stats Grid */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                <div className="stat-item">
                  <span className="stat-label">Total Prompts Evaluated</span>
                  <span className="stat-value">{wmData.samples.length}</span>
                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>From UltraFeedback</small>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Watermarked Mean Green %</span>
                  <span className="stat-value green">
                    {wmData.aggregate_comparison
                      ? `${(wmData.aggregate_comparison.watermarked.mean_green_fraction * 100).toFixed(1)}%`
                      : `${(wmData.samples.reduce((acc, s) => acc + s.watermarked.green_fraction, 0) / wmData.samples.length * 100).toFixed(1)}%`}
                  </span>
                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Baseline: 25.0%</small>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Watermarked Mean Z-Score</span>
                  <span className="stat-value green">
                    {wmData.aggregate_comparison
                      ? `+${wmData.aggregate_comparison.watermarked.mean_z_score.toFixed(2)}`
                      : `+${(wmData.samples.reduce((acc, s) => acc + s.watermarked.z_score, 0) / wmData.samples.length).toFixed(2)}`}
                  </span>
                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unwatermarked: ~0.0</small>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Unwatermarked Mean Z-Score</span>
                  <span className="stat-value">
                    {wmData.aggregate_comparison
                      ? `${wmData.aggregate_comparison.unwatermarked.mean_z_score.toFixed(2)}`
                      : `${(wmData.samples.reduce((acc, s) => acc + s.unwatermarked.z_score, 0) / wmData.samples.length).toFixed(2)}`}
                  </span>
                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Follows N(0, 1)</small>
                </div>
                <div className="stat-item">
                  <span className="stat-label">True Positive Rate (z ≥ 3.0)</span>
                  <span className="stat-value green">
                    {`${((wmData.samples.filter(s => s.watermarked.z_score >= 3.0).length / wmData.samples.length) * 100).toFixed(1)}%`}
                  </span>
                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {wmData.samples.filter(s => s.watermarked.z_score >= 3.0).length} of {wmData.samples.length} detected
                  </small>
                </div>
              </div>
            </div>

            {/* Paired Samples Table */}
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title" style={{ fontSize: '1.05rem' }}>
                    <Columns2 size={18} color="var(--brand-cyan)" />
                    Side-by-Side Paired Completions Browser
                  </h3>
                  <p className="panel-subtitle">Click any sample to inspect the full generated watermarked vs unwatermarked text</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px' }}>ID</th>
                      <th style={{ padding: '10px' }}>Prompt</th>
                      <th style={{ padding: '10px', color: 'var(--watermark-green)' }}>WM Green %</th>
                      <th style={{ padding: '10px', color: 'var(--watermark-green)' }}>WM Z-Score</th>
                      <th style={{ padding: '10px' }}>Unwatermarked Green %</th>
                      <th style={{ padding: '10px' }}>Unwatermarked Z-Score</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wmData.samples.map((sample) => (
                      <tr
                        key={sample.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        className="table-row-hover"
                        onClick={() => setSelectedWmPair(sample)}
                      >
                        <td style={{ padding: '10px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--brand-cyan)' }}>
                          {sample.id}
                        </td>
                        <td style={{ padding: '10px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sample.prompt}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)', fontWeight: 600 }}>
                          {(sample.watermarked.green_fraction * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)', fontWeight: 600 }}>
                          +{sample.watermarked.z_score.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                          {(sample.unwatermarked.green_fraction * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                          {sample.unwatermarked.z_score > 0 ? `+${sample.unwatermarked.z_score.toFixed(2)}` : sample.unwatermarked.z_score.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWmPair(sample);
                            }}
                          >
                            Compare
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal for Paired Sample Comparison */}
            {selectedWmPair && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                  padding: '20px'
                }}
                onClick={() => setSelectedWmPair(null)}
              >
                <div
                  className="panel-card"
                  style={{
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'var(--bg-card)',
                    boxShadow: 'var(--shadow-elevated)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title" style={{ fontSize: '1.15rem' }}>
                        Paired Evaluation: <code>{selectedWmPair.id}</code>
                      </h3>
                      <p className="panel-subtitle">Empirical side-by-side comparison on identical prompt</p>
                    </div>
                    <button className="btn-secondary" onClick={() => setSelectedWmPair(null)} style={{ padding: '6px' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Prompt:
                    </span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {selectedWmPair.prompt}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Watermarked Card */}
                    <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--watermark-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Zap size={16} /> Watermarked (\(\delta = 5.5\))
                        </strong>
                        <span className="badge-tag green">
                          Z = +{selectedWmPair.watermarked.z_score.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', gap: '12px' }}>
                        <span>Green: <strong>{(selectedWmPair.watermarked.green_fraction * 100).toFixed(1)}%</strong></span>
                        <span>Tokens: <strong>{selectedWmPair.watermarked.total_tokens}</strong></span>
                        <span>Status: <strong style={{ color: 'var(--watermark-green)' }}>Detected</strong></span>
                      </div>
                      <div style={{ maxHeight: '280px', overflowY: 'auto', fontSize: '0.86rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                        {selectedWmPair.watermarked.text}
                      </div>
                    </div>

                    {/* Unwatermarked Card */}
                    <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bot size={16} /> Unwatermarked (\(\delta = 0\))
                        </strong>
                        <span className="badge-tag neutral">
                          Z = {selectedWmPair.unwatermarked.z_score.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', gap: '12px' }}>
                        <span>Green: <strong>{(selectedWmPair.unwatermarked.green_fraction * 100).toFixed(1)}%</strong></span>
                        <span>Tokens: <strong>{selectedWmPair.unwatermarked.total_tokens}</strong></span>
                        <span>Status: <strong>Human-like</strong></span>
                      </div>
                      <div style={{ maxHeight: '280px', overflowY: 'auto', fontSize: '0.86rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                        {selectedWmPair.unwatermarked.text}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="panel-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Clock size={32} color="var(--brand-cyan)" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Generating Watermarked vs Unwatermarked Pairs...</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.88rem' }}>
              Prompts from UltraFeedback are currently being processed locally by Gemma 4. Completed pairs will appear here dynamically.
            </p>
          </div>
        )
      ) : null}

      {/* RENDER STANDARD BENCHMARK VIEW (BROWN OR LLM) */}
      {activeDataset !== 'watermarked' && (
        (() => {
          const currentData = activeDataset === 'brown' ? brownData : llmData;
          if (!currentData) {
            return (
              <div className="panel-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <AlertTriangle size={32} color="var(--accent-amber)" style={{ margin: '0 auto 12px' }} />
                <h3>Dataset not available yet.</h3>
              </div>
            );
          }

          const { metadata, aggregate_metrics, false_positive_analysis, histogram, category_summary, documents } = currentData;

          const filteredDocs = documents.filter((doc) => {
            const matchesCat = selectedCategory === 'all' || doc.category === selectedCategory;
            const matchesSearch =
              doc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
              doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
              doc.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ((doc as any).prompt && (doc as any).prompt.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
          });

          filteredDocs.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            if (sortOrder === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
          });

          const uniqueCategories = Array.from(new Set(documents.map((d) => d.category))).sort();

          return (
            <div>
              {/* Overview Banner */}
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 className="panel-title" style={{ fontSize: '1.25rem' }}>
                        <BarChart3 size={22} color="var(--brand-cyan)" />
                        {activeDataset === 'brown'
                          ? 'Brown Corpus Human Baseline & False Positive Benchmark'
                          : 'Unwatermarked Multi-Model LLM False Positive Benchmark'}
                      </h2>
                      <span className="badge-tag green">
                        {activeDataset === 'brown' ? '500 Human Documents' : '500 Multi-Model Completions'}
                      </span>
                    </div>
                    <p className="panel-subtitle" style={{ marginTop: '4px' }}>
                      {activeDataset === 'brown'
                        ? `Evaluation of ~1.26 million human tokens across 15 standard American English genres.`
                        : `Evaluation of diverse unwatermarked completions from top models (GPT-4, Claude, LLaMA-2, Vicuna, etc.).`}
                    </p>
                  </div>
                </div>

                {/* Global KPIs */}
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                  <div className="stat-item">
                    <span className="stat-label">Total Samples</span>
                    <span className="stat-value">{metadata.total_documents}</span>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {activeDataset === 'brown' ? 'Standard English Corpus' : 'Multi-Model Battles'}
                    </small>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Tokens Evaluated</span>
                    <span className="stat-value cyan">{metadata.total_tokens_evaluated.toLocaleString()}</span>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>~{metadata.average_tokens_per_doc} / sample</small>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Empirical Mean Z-Score</span>
                    <span className="stat-value" style={{ color: Math.abs(aggregate_metrics.mean_z_score) < 0.3 ? 'var(--watermark-green)' : 'var(--text-primary)' }}>
                      {aggregate_metrics.mean_z_score > 0 ? `+${aggregate_metrics.mean_z_score}` : aggregate_metrics.mean_z_score}
                    </span>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Theoretical: 0.00 (Std: {aggregate_metrics.std_z_score})</small>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Mean Green Fraction</span>
                    <span className="stat-value" style={{ color: 'var(--watermark-green)' }}>
                      {(aggregate_metrics.mean_green_fraction * 100).toFixed(2)}%
                    </span>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Expected: {(aggregate_metrics.expected_green_fraction * 100).toFixed(1)}%</small>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">False Positive Rate (z ≥ 3.0)</span>
                    <span className="stat-value" style={{ color: false_positive_analysis.threshold_z3.empirical_false_positives <= 1 ? 'var(--watermark-green)' : 'var(--accent-amber)' }}>
                      {false_positive_analysis.threshold_z3.empirical_fpr_percent}%
                    </span>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {false_positive_analysis.threshold_z3.empirical_false_positives} of {metadata.total_documents} samples
                    </small>
                  </div>
                </div>
              </div>

              {/* Analysis Grid: False Positive Matrix & Z-Score Histogram */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* False Positive Rate Matrix */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                        <ShieldCheck size={18} color="var(--watermark-green)" />
                        False Positive Rate Analysis
                      </h3>
                      <p className="panel-subtitle">
                        {activeDataset === 'brown'
                          ? 'Probability of human text exceeding watermark Z-score thresholds'
                          : 'Probability of unwatermarked AI text exceeding watermark Z-score thresholds'}
                      </p>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 6px' }}>Threshold</th>
                        <th style={{ padding: '8px 6px' }}>Theoretical FPR</th>
                        <th style={{ padding: '8px 6px' }}>Empirical False Positives</th>
                        <th style={{ padding: '8px 6px' }}>Empirical FPR</th>
                        <th style={{ padding: '8px 6px' }}>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(false_positive_analysis).map(([key, tier]) => (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 6px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            z ≥ {tier.threshold.toFixed(1)}
                          </td>
                          <td style={{ padding: '10px 6px', color: 'var(--text-secondary)' }}>
                            {(tier.theoretical_fpr * 100).toFixed(3)}% (1 in {Math.round(1 / tier.theoretical_fpr).toLocaleString()})
                          </td>
                          <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>
                            <strong>{tier.empirical_false_positives}</strong> / {metadata.total_documents}
                          </td>
                          <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)', color: tier.empirical_false_positives === 0 ? 'var(--watermark-green)' : 'var(--text-primary)' }}>
                            {tier.empirical_fpr_percent.toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            {tier.empirical_false_positives === 0 ? (
                              <span style={{ color: 'var(--watermark-green)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> 0% Error
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                Within bounds
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Z-Score Histogram Distribution */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                        <BarChart3 size={18} color="var(--brand-cyan)" />
                        Empirical Z-Score Distribution
                      </h3>
                      <p className="panel-subtitle">Distribution compared against Standard Normal N(0, 1)</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '220px', justifyContent: 'center' }}>
                    {histogram.map((bin, idx) => {
                      const isCenter = bin.bin_start >= -1.0 && bin.bin_end <= 1.0;
                      const maxCount = Math.max(...histogram.map((b) => b.count), 1);
                      const barWidth = `${(bin.count / maxCount) * 100}%`;

                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                          <span style={{ width: '85px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {bin.bin_label}
                          </span>
                          <div style={{ flex: 1, background: 'var(--bg-input)', height: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: barWidth,
                                background: isCenter ? 'linear-gradient(90deg, #0284c7, #0ea5e9)' : 'var(--text-muted)',
                                borderRadius: '4px',
                                transition: 'width 0.4s ease'
                              }}
                            />
                          </div>
                          <span style={{ width: '60px', fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {bin.count} ({bin.percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Category / Model Breakdown */}
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title" style={{ fontSize: '1.05rem' }}>
                      <Layers size={18} color="var(--brand-cyan)" />
                      {activeDataset === 'brown' ? 'Genre & Category Breakdown' : 'Breakdown by Generating LLM Model'}
                    </h3>
                    <p className="panel-subtitle">
                      {activeDataset === 'brown'
                        ? 'Mean Z-Scores and Green Ratios across 15 distinct genres in the Brown Corpus'
                        : 'Mean Z-Scores and Green Ratios across diverse unwatermarked LLM architectures'}
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px' }}>{activeDataset === 'brown' ? 'Category / Genre' : 'Generating Model'}</th>
                        <th style={{ padding: '8px 10px' }}>Samples</th>
                        <th style={{ padding: '8px 10px' }}>Tokens</th>
                        <th style={{ padding: '8px 10px' }}>Mean Z-Score</th>
                        <th style={{ padding: '8px 10px' }}>Std Z-Score</th>
                        <th style={{ padding: '8px 10px' }}>Mean Green %</th>
                        <th style={{ padding: '8px 10px' }}>False Positives (z ≥ 3.0)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category_summary.map((cat) => (
                        <tr key={cat.category} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px', fontWeight: 600, textTransform: activeDataset === 'brown' ? 'capitalize' : 'none' }}>
                            {cat.category.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{cat.doc_count}</td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {cat.total_tokens.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: Math.abs(cat.mean_z_score) < 0.25 ? 'var(--watermark-green)' : 'var(--text-primary)' }}>
                              {cat.mean_z_score > 0 ? `+${cat.mean_z_score.toFixed(2)}` : cat.mean_z_score.toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {cat.std_z_score.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)' }}>
                            {(cat.mean_green_fraction * 100).toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px' }}>
                            {cat.false_positives_z3 === 0 ? (
                              <span className="badge-tag green" style={{ fontSize: '0.72rem' }}>0 (0.0%)</span>
                            ) : (
                              <span className="badge-tag neutral" style={{ fontSize: '0.72rem', background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)' }}>
                                {cat.false_positives_z3} ({(cat.false_positive_rate_z3 * 100).toFixed(1)}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Explorer */}
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title" style={{ fontSize: '1.05rem' }}>
                      <FileText size={18} color="var(--brand-cyan)" />
                      Sample Explorer ({filteredDocs.length} of {documents.length})
                    </h3>
                    <p className="panel-subtitle">Click any sample to inspect prompt, response, and statistical properties</p>
                  </div>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                    <input
                      type="text"
                      className="text-input"
                      style={{ paddingLeft: '34px' }}
                      placeholder={activeDataset === 'brown' ? "Search document ID, genre, or preview text..." : "Search model name, prompt, or response..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  <div style={{ width: '200px' }}>
                    <select
                      className="select-input"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="all">All {activeDataset === 'brown' ? 'Categories' : 'Models'} ({documents.length})</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>
                          {c.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sort by:</span>
                    <select
                      className="select-input"
                      style={{ width: '140px' }}
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="z_score">Z-Score</option>
                      <option value="green_fraction">Green %</option>
                      <option value="total_tokens">Tokens</option>
                    </select>
                    <button
                      className="btn-secondary"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    >
                      <ArrowUpDown size={14} />
                      {sortOrder.toUpperCase()}
                    </button>
                  </div>
                </div>

                {/* Samples Table */}
                <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>{activeDataset === 'brown' ? 'Category' : 'Model'}</th>
                        <th style={{ padding: '10px' }}>Tokens</th>
                        <th style={{ padding: '10px' }}>Green Count</th>
                        <th style={{ padding: '10px' }}>Green %</th>
                        <th style={{ padding: '10px' }}>Z-Score</th>
                        <th style={{ padding: '10px' }}>{activeDataset === 'brown' ? 'Text Preview' : 'Prompt / Response Preview'}</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((doc) => (
                        <tr
                          key={doc.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                          onClick={() => openDocumentDetail(doc.id)}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '10px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--brand-cyan)' }}>
                            {doc.id}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span className="badge-tag neutral" style={{ fontSize: '0.72rem' }}>
                              {doc.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{doc.total_tokens}</td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)' }}>
                            {doc.green_tokens}
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--watermark-green)' }}>
                            {(doc.green_fraction * 100).toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: Math.abs(doc.z_score) < 2.0 ? 'var(--watermark-green)' : 'var(--accent-amber)' }}>
                              {doc.z_score > 0 ? `+${doc.z_score.toFixed(2)}` : doc.z_score.toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(doc as any).prompt ? `[Prompt: ${(doc as any).prompt}] ${doc.preview}` : doc.preview}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDocumentDetail(doc.id);
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Inspect Document Modal / Detail Drawer for Brown / LLM */}
      {inspectedDocId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
          onClick={closeDocumentDetail}
        >
          <div
            className="panel-card"
            style={{
              width: '100%',
              maxWidth: '960px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-elevated)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <h3 className="panel-title" style={{ fontSize: '1.15rem' }}>
                  Sample Inspection: <code>{inspectedDocId}</code>
                </h3>
                <p className="panel-subtitle">
                  {activeDataset === 'brown' ? 'Human text token partition analysis' : 'Unwatermarked LLM response statistical evaluation'}
                </p>
              </div>
              <button className="btn-secondary" onClick={closeDocumentDetail} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Clock size={24} color="var(--brand-cyan)" style={{ animation: 'spin 2s linear infinite' }} />
                <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Evaluating sample...</p>
              </div>
            ) : docDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stats */}
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Evaluated Transitions</span>
                    <span className="stat-value">{docDetail.result.evaluated_tokens}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Green Tokens</span>
                    <span className="stat-value green">{docDetail.result.green_tokens}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Green Ratio</span>
                    <span className="stat-value green">
                      {(docDetail.result.green_fraction * 100).toFixed(1)}%{' '}
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ 25.0%</small>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Z-Score</span>
                    <span className="stat-value" style={{ color: Math.abs(docDetail.result.z_score) < 2.0 ? 'var(--watermark-green)' : 'var(--text-primary)' }}>
                      {docDetail.result.z_score.toFixed(2)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Verdict</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: docDetail.result.is_watermarked ? 'var(--watermark-red)' : 'var(--watermark-green)' }}>
                      {docDetail.result.is_watermarked ? 'False Positive' : 'True Negative (Unwatermarked)'}
                    </span>
                  </div>
                </div>

                {docDetail.prompt && (
                  <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Prompt / Instruction:
                    </span>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {docDetail.prompt}
                    </p>
                  </div>
                )}

                {/* Text Box */}
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Response Text:
                  </span>
                  <div className="token-stream-box" style={{ maxHeight: '320px', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {docDetail.result.tokens.length > 0 ? (
                      docDetail.result.tokens.map((tok, i) => (
                        <span
                          key={i}
                          className={`token-pill ${tok.is_green === true ? 'green' : tok.is_green === false ? 'red' : 'unevaluated'}`}
                          onMouseEnter={() => setHoveredToken(tok)}
                          onMouseLeave={() => setHoveredToken(null)}
                        >
                          {tok.text}
                        </span>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{docDetail.clean_text}</p>
                    )}
                  </div>
                </div>

                {hoveredToken && (
                  <div style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '14px' }}>
                    <span>Token: <code style={{ color: 'var(--text-primary)' }}>{JSON.stringify(hoveredToken.text)}</code></span>
                    <span>ID: <code style={{ color: 'var(--brand-cyan)' }}>{hoveredToken.id}</code></span>
                    <span>Status: <strong style={{ color: hoveredToken.is_green ? 'var(--watermark-green)' : 'var(--watermark-red)' }}>{hoveredToken.is_green ? 'GREEN' : 'RED'}</strong></span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
