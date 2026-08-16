import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Search,
  Columns2,
  ShieldAlert,
  BookOpen,
  Layers,
  Cpu,
  BarChart3,
  ScanSearch,
  Activity,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Sliders,
  X,
  Save,
  ExternalLink
} from 'lucide-react';
import type { ModelInfo, WatermarkConfig, PrimaryTab, WatermarkSubTab } from './types';
import { WatermarkStudio } from './components/WatermarkStudio';
import { WatermarkDetector } from './components/WatermarkDetector';
import { WatermarkCompare } from './components/WatermarkCompare';
import { TamperLab } from './components/TamperLab';
import { Explainer } from './components/Explainer';
import { BrownBenchmark } from './components/BrownBenchmark';
import { AIWritingRadar } from './components/AIWritingRadar';
import { DetectGPTLab } from './components/DetectGPTLab';
import { UTF8WatermarkStudio } from './components/UTF8WatermarkStudio';
import { WatermarkControlsSidebar } from './components/WatermarkControlsSidebar';

type ThemeMode = 'system' | 'light' | 'dark';

export function App() {
  // Navigation State
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('token_watermark');
  const [watermarkSubTab, setWatermarkSubTab] = useState<WatermarkSubTab>('studio');

  // Backend & Model State
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  // Cross-tool shared input text
  const [detectorInitialText, setDetectorInitialText] = useState<string>('');
  const [radarInitialText, setRadarInitialText] = useState<string>('');
  const [detectGPTInitialText, setDetectGPTInitialText] = useState<string>('');
  const [tamperInitialText, setTamperInitialText] = useState<string>('');

  // Watermark Configuration & Generation Parameters (Shared & Persistent)
  const [config, setConfig] = useState<WatermarkConfig>({
    gamma: 0.25,
    delta: 5.0,
    hash_key: 89173511,
    context_width: 1
  });
  const [maxTokens, setMaxTokens] = useState<number>(160);
  const [temperature, setTemperature] = useState<number>(0.7);

  // Action hook bridges between persistent sidebar and active subtab
  const [isStudioGenerating, setIsStudioGenerating] = useState(false);
  const [isDetectorAnalyzing, setIsDetectorAnalyzing] = useState(false);
  const [isCompareRunning, setIsCompareRunning] = useState(false);
  const studioStartGenRef = useRef<(() => void) | undefined>(undefined);
  const studioStopGenRef = useRef<(() => void) | undefined>(undefined);
  const detectorRunRef = useRef<(() => void) | undefined>(undefined);
  const compareRunRef = useRef<(() => void) | undefined>(undefined);
  const tamperRunRef = useRef<(() => void) | undefined>(undefined);

  // Model Profile & Thinking Bypass Settings Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editModelName, setEditModelName] = useState<string>('');
  const [editDelta, setEditDelta] = useState<number>(3.0);
  const [editPromptSuffix, setEditPromptSuffix] = useState<string>('\n');
  const [editDisableThinking, setEditDisableThinking] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Theme Management (Default: system)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = (localStorage.getItem('ai-forensics-theme') || localStorage.getItem('veritas-theme')) as ThemeMode | null;
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    localStorage.setItem('ai-forensics-theme', themeMode);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let resolved: 'light' | 'dark';
      if (themeMode === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        resolved = themeMode;
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  // Model Polling
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        const modelList: ModelInfo[] = data.models || [];
        setModels(modelList);
        if (modelList.length > 0 && !selectedModel) {
          const initial = data.current_model || modelList[0].name;
          setSelectedModel(initial);
          const m = modelList.find((x) => x.name === initial);
          if (m && m.recommended_delta !== undefined) {
            setConfig((prev) => ({ ...prev, delta: m.recommended_delta! }));
          }
        }
        setIsBackendOnline(true);
      }
    } catch (e) {
      console.warn('Backend not responding yet:', e);
      setIsBackendOnline(false);
    }
  }, [selectedModel]);

  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    const m = models.find((x) => x.name === newModel);
    if (m && m.recommended_delta !== undefined) {
      setConfig((prev) => ({ ...prev, delta: m.recommended_delta! }));
    } else if (newModel) {
      try {
        const res = await fetch('/api/models/calibrate-delta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_name: newModel })
        });
        if (res.ok) {
          const data = await res.json();
          setConfig((prev) => ({ ...prev, delta: data.recommended_delta }));
        }
      } catch (e) {
        console.warn('Auto-calibration error on model switch:', e);
      }
    }
  };

  const openModelConfigModal = (mName?: string) => {
    const target = mName || selectedModel || (models[0]?.name ?? 'gemma4:12b');
    const m = models.find((x) => x.name === target);
    setEditModelName(target);
    setEditDelta(m?.recommended_delta ?? config.delta);
    setEditPromptSuffix(
      m?.prompt_suffix ??
        (target.toLowerCase().includes('gemma')
          ? '\n<|channel>\n<channel|>\n'
          : '\n')
    );
    setEditDisableThinking(m?.disable_thinking ?? true);
    setIsConfigModalOpen(true);
    setSaveStatus(null);
  };

  const handleSaveModelConfig = async () => {
    try {
      const res = await fetch('/api/models/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: editModelName,
          recommended_delta: editDelta,
          prompt_suffix: editPromptSuffix,
          disable_thinking: editDisableThinking
        })
      });
      if (res.ok) {
        setSaveStatus('✅ Profile saved to persistence store!');
        fetchModels();
        if (editModelName === selectedModel) {
          setConfig((prev) => ({ ...prev, delta: editDelta }));
        }
        setTimeout(() => {
          setIsConfigModalOpen(false);
          setSaveStatus(null);
        }, 1100);
      }
    } catch (e) {
      console.error('Failed to save model profile:', e);
      setSaveStatus('❌ Error saving profile');
    }
  };

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 5000);
    return () => clearInterval(interval);
  }, [fetchModels]);

  const activeModelProfile = models.find((x) => x.name === selectedModel);

  // Cross-Navigation Handlers
  const handleSendToDetector = (text: string) => {
    setDetectorInitialText(text);
    setPrimaryTab('token_watermark');
    setWatermarkSubTab('detector');
  };

  const handleSendToRadar = (text: string) => {
    setRadarInitialText(text);
    setPrimaryTab('radar');
  };

  const handleSendToDetectGPT = (text: string) => {
    setDetectGPTInitialText(text);
    setPrimaryTab('detectgpt');
  };

  const handleSendToTamper = (text: string) => {
    setTamperInitialText(text);
    setPrimaryTab('token_watermark');
    setWatermarkSubTab('tamper');
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">
            <Layers size={22} />
          </div>
          <div className="header-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0 }}>AI Forensics</h1>
              <a
                href="https://maximilianklein.github.io/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  color: 'var(--brand-cyan)',
                  textDecoration: 'none',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 500,
                  transition: 'all 0.15s ease'
                }}
                title="Maximilian Klein's Homepage"
              >
                <span>maximilianklein.github.io</span>
                <ExternalLink size={11} />
              </a>
            </div>
            <p>Statistical Token Watermarking • Zero-Width Steganography • DetectGPT Curvature • AI Stylistic Forensics</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Global Model Selector */}
          <div className="header-model-selector" title="Active Model across all Forensic Paradigms">
            <div className={`status-indicator ${isBackendOnline ? '' : 'offline'}`} />
            <Cpu size={14} color="var(--brand-cyan)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Model:</span>
            <select
              className="header-model-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={!isBackendOnline || models.length === 0}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.size_gb} GB){m.recommended_delta !== undefined ? ` • δ ≈ ${m.recommended_delta}` : ''}
                </option>
              ))}
              {models.length === 0 && (
                <option value="">{isBackendOnline ? 'No Models Found' : 'Backend Offline'}</option>
              )}
            </select>
          </div>

          {/* Model Profile & Thinking Bypass Settings Button */}
          <button
            className="theme-btn"
            onClick={() => openModelConfigModal()}
            title="Configure Model Suffix, Thinking Bypass & Delta Persistence"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)'
            }}
          >
            <Sliders size={13} color="var(--brand-cyan)" />
            <span>Config</span>
          </button>

          {/* Theme Switcher */}
          <div className="theme-switcher">
            <button
              className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`}
              onClick={() => setThemeMode('system')}
              title="System Default Theme"
            >
              <Monitor size={14} />
            </button>
            <button
              className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => setThemeMode('light')}
              title="Light Theme"
            >
              <Sun size={14} />
            </button>
            <button
              className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => setThemeMode('dark')}
              title="Dark Theme"
            >
              <Moon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Primary Paradigm Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${primaryTab === 'token_watermark' ? 'active' : ''}`}
          onClick={() => setPrimaryTab('token_watermark')}
        >
          <Sparkles size={16} />
          <span>🔮 Token Watermarking</span>
        </button>

        <button
          className={`nav-tab ${primaryTab === 'utf8_parity' ? 'active' : ''}`}
          onClick={() => setPrimaryTab('utf8_parity')}
          style={{ color: primaryTab === 'utf8_parity' ? '#c084fc' : undefined }}
        >
          <EyeOff size={16} />
          <span>🥷 Invisible UTF-8 & Parity</span>
        </button>

        <button
          className={`nav-tab ${primaryTab === 'detectgpt' ? 'active' : ''}`}
          onClick={() => setPrimaryTab('detectgpt')}
          style={{ color: primaryTab === 'detectgpt' ? '#38bdf8' : undefined }}
        >
          <Activity size={16} />
          <span>⚡ DetectGPT Curvature</span>
        </button>

        <button
          className={`nav-tab ${primaryTab === 'radar' ? 'active' : ''}`}
          onClick={() => setPrimaryTab('radar')}
          style={{ color: primaryTab === 'radar' ? '#f59e0b' : undefined }}
        >
          <ScanSearch size={16} />
          <span>🔍 Signs of AI Forensic Radar</span>
        </button>

        <button
          className={`nav-tab ${primaryTab === 'explainer' ? 'active' : ''}`}
          onClick={() => setPrimaryTab('explainer')}
        >
          <BookOpen size={16} />
          <span>📚 How It Works & Theory</span>
        </button>
      </nav>

      {/* Secondary Sub-Navigation Bar (Only for Token Watermarking) */}
      {primaryTab === 'token_watermark' && (
        <div className="sub-nav-bar">
          <button
            className={`sub-nav-pill ${watermarkSubTab === 'studio' ? 'active' : ''}`}
            onClick={() => setWatermarkSubTab('studio')}
          >
            <Sparkles size={14} />
            <span>Generation Studio</span>
          </button>

          <button
            className={`sub-nav-pill ${watermarkSubTab === 'detector' ? 'active' : ''}`}
            onClick={() => setWatermarkSubTab('detector')}
          >
            <Search size={14} />
            <span>Detector & Verifier</span>
          </button>

          <button
            className={`sub-nav-pill ${watermarkSubTab === 'compare' ? 'active' : ''}`}
            onClick={() => setWatermarkSubTab('compare')}
          >
            <Columns2 size={14} />
            <span>Side-by-Side Compare</span>
          </button>

          <button
            className={`sub-nav-pill ${watermarkSubTab === 'tamper' ? 'active' : ''}`}
            onClick={() => setWatermarkSubTab('tamper')}
          >
            <ShieldAlert size={14} />
            <span>Tamper & Robustness Lab</span>
          </button>

          <button
            className={`sub-nav-pill ${watermarkSubTab === 'benchmark' ? 'active' : ''}`}
            onClick={() => setWatermarkSubTab('benchmark')}
          >
            <BarChart3 size={14} />
            <span>Brown Corpus Benchmark</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main>
        {/* PARADIGM 1: Token Watermarking */}
        {primaryTab === 'token_watermark' && (
          <div className="tab-content">
            {watermarkSubTab !== 'benchmark' ? (
              <div className="grid-two-cols">
                {/* Persistent Generation Controls Sidebar */}
                <WatermarkControlsSidebar
                  models={models}
                  selectedModel={selectedModel}
                  config={config}
                  onChangeConfig={setConfig}
                  maxTokens={maxTokens}
                  onChangeMaxTokens={setMaxTokens}
                  temperature={temperature}
                  onChangeTemperature={setTemperature}
                  activeSubTab={watermarkSubTab}
                  isGenerating={isStudioGenerating}
                  onStartGeneration={() => studioStartGenRef.current?.()}
                  onStopGeneration={() => studioStopGenRef.current?.()}
                  isAnalyzingDetector={isDetectorAnalyzing}
                  onRunDetection={() => detectorRunRef.current?.()}
                  isComparing={isCompareRunning}
                  onRunCompare={() => compareRunRef.current?.()}
                  onRunTamper={() => tamperRunRef.current?.()}
                />

                {/* Active Sub-Tab View */}
                <div style={{ minWidth: 0 }}>
                  {watermarkSubTab === 'studio' && (
                    <WatermarkStudio
                      models={models}
                      selectedModel={selectedModel}
                      config={config}
                      onChangeConfig={setConfig}
                      maxTokens={maxTokens}
                      temperature={temperature}
                      onSendToDetector={handleSendToDetector}
                      onSendToRadar={handleSendToRadar}
                      onSendToDetectGPT={handleSendToDetectGPT}
                      onSendToTamper={handleSendToTamper}
                      onRegisterControls={(startFn, stopFn, isGen) => {
                        studioStartGenRef.current = startFn;
                        studioStopGenRef.current = stopFn;
                        setIsStudioGenerating(isGen);
                      }}
                    />
                  )}

                  {watermarkSubTab === 'detector' && (
                    <WatermarkDetector
                      selectedModel={selectedModel}
                      config={config}
                      initialText={detectorInitialText}
                      onRegisterRun={(runFn, isAnalyzing) => {
                        detectorRunRef.current = runFn;
                        setIsDetectorAnalyzing(isAnalyzing);
                      }}
                    />
                  )}

                  {watermarkSubTab === 'compare' && (
                    <WatermarkCompare
                      selectedModel={selectedModel}
                      config={config}
                      maxTokens={maxTokens}
                      temperature={temperature}
                      promptSuffix={activeModelProfile?.prompt_suffix}
                      disableThinking={activeModelProfile?.disable_thinking}
                      onRegisterRun={(runFn, isComp) => {
                        compareRunRef.current = runFn;
                        setIsCompareRunning(isComp);
                      }}
                    />
                  )}

                  {watermarkSubTab === 'tamper' && (
                    <TamperLab
                      selectedModel={selectedModel}
                      config={config}
                      initialText={tamperInitialText}
                      onRegisterRun={(runFn) => {
                        tamperRunRef.current = runFn;
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <BrownBenchmark />
            )}
          </div>
        )}

        {/* PARADIGM 2: Invisible UTF-8 & Parity */}
        {primaryTab === 'utf8_parity' && (
          <UTF8WatermarkStudio
            selectedModel={selectedModel}
            onSendToRadar={handleSendToRadar}
            onSendToDetectGPT={handleSendToDetectGPT}
            onSendToTokenWatermark={handleSendToDetector}
            onSendToTamper={handleSendToTamper}
          />
        )}

        {/* PARADIGM 3: DetectGPT Probability Curvature */}
        {primaryTab === 'detectgpt' && (
          <DetectGPTLab
            initialText={detectGPTInitialText}
            selectedModel={selectedModel}
            onSendToRadar={handleSendToRadar}
            onSendToWatermark={handleSendToDetector}
          />
        )}

        {/* PARADIGM 4: Signs of AI Forensic Radar */}
        {primaryTab === 'radar' && (
          <AIWritingRadar
            initialText={radarInitialText}
            onSendToWatermarkDetector={handleSendToDetector}
            onSendToDetectGPT={handleSendToDetectGPT}
          />
        )}

        {/* PARADIGM 5: How It Works & Theory */}
        {primaryTab === 'explainer' && (
          <Explainer />
        )}
      </main>

      {/* Model Profile & Thinking Bypass Configuration Modal */}
      {isConfigModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px'
          }}
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={20} color="var(--brand-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Model Profile & Thinking Bypass</h3>
              </div>
              <button
                className="button secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setIsConfigModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
              Configure model-specific parameters stored in the server in-memory persistence layer. These settings persist across all forensic tools.
            </p>

            <div className="control-group">
              <label className="control-label">Target Model</label>
              <select
                className="select-input"
                value={editModelName}
                onChange={(e) => openModelConfigModal(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.size_gb} GB)
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Calibrated Watermark Boost (δ)</span>
                <span className="control-val">{editDelta.toFixed(1)}</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="0.5"
                max="8.0"
                step="0.1"
                value={editDelta}
                onChange={(e) => setEditDelta(parseFloat(e.target.value))}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Optimal logit bias for this model architecture (e.g. ~2.0 for Qwen, ~5.8 for Gemma).
              </small>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Auto-Append Suffix (Thinking Bypass)</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editDisableThinking}
                    onChange={(e) => setEditDisableThinking(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: editDisableThinking ? 'var(--watermark-green)' : 'var(--text-muted)' }}>
                    {editDisableThinking ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
              <textarea
                className="textarea"
                rows={2}
                value={editPromptSuffix}
                onChange={(e) => setEditPromptSuffix(e.target.value)}
                placeholder="e.g. \n<|channel>\n<channel|>\n"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
              />

              {/* Visual Whitespace & Newline Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Visual Structure (Newlines Highlighted):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', minHeight: '32px' }}>
                  {(() => {
                    if (!editPromptSuffix) {
                      return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>No suffix (raw prompt passed)</span>;
                    }
                    const tokens: Array<{ type: 'newline' | 'tab' | 'text', value: string }> = [];
                    let i = 0;
                    while (i < editPromptSuffix.length) {
                      if (editPromptSuffix.startsWith('\\n', i)) {
                        tokens.push({ type: 'newline', value: '\\n' });
                        i += 2;
                      } else if (editPromptSuffix[i] === '\n') {
                        tokens.push({ type: 'newline', value: '\\n' });
                        i += 1;
                      } else if (editPromptSuffix.startsWith('\\t', i)) {
                        tokens.push({ type: 'tab', value: '\\t' });
                        i += 2;
                      } else if (editPromptSuffix[i] === '\t') {
                        tokens.push({ type: 'tab', value: '\\t' });
                        i += 1;
                      } else {
                        let text = '';
                        while (i < editPromptSuffix.length && editPromptSuffix[i] !== '\n' && editPromptSuffix[i] !== '\t' && !editPromptSuffix.startsWith('\\n', i) && !editPromptSuffix.startsWith('\\t', i)) {
                          text += editPromptSuffix[i];
                          i++;
                        }
                        if (text) tokens.push({ type: 'text', value: text });
                      }
                    }
                    return tokens.map((tok, idx) => {
                      if (tok.type === 'newline') {
                        return (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 7px',
                              background: 'rgba(56, 189, 248, 0.22)',
                              border: '1px solid rgba(56, 189, 248, 0.55)',
                              color: 'var(--brand-cyan)',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}
                            title="Newline return"
                          >
                            ↵ \n (Newline)
                          </span>
                        );
                      }
                      if (tok.type === 'tab') {
                        return (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 7px',
                              background: 'rgba(192, 132, 252, 0.22)',
                              border: '1px solid rgba(192, 132, 252, 0.55)',
                              color: '#c084fc',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}
                            title="Tab"
                          >
                            ⇥ \t (Tab)
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          style={{
                            padding: '2px 6px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            borderRadius: '3px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem'
                          }}
                        >
                          {tok.value}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick Insert:</span>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setEditPromptSuffix(prev => prev + '\n')}
                >
                  + \n (Newline)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setEditPromptSuffix('\n<|channel>\n<channel|>\n')}
                >
                  Gemma Bypass Preset
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setEditPromptSuffix('\n')}
                >
                  Single Newline Preset
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setEditPromptSuffix('')}
                >
                  Clear
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                Appended to prompts so models answer immediately without entering reasoning loops.
              </small>
            </div>

            {saveStatus && (
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-cyan)', textAlign: 'center' }}>
                {saveStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                className="button secondary"
                onClick={() => setIsConfigModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={handleSaveModelConfig}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={14} />
                <span>Save to Model Store</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
