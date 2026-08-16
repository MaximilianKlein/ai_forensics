import React, { useState } from 'react';
import {
  Sparkles,
  Cpu,
  Target,
  Activity,
  Play,
  Square,
  Search,
  RefreshCw,
  Columns2
} from 'lucide-react';
import type { ModelInfo, WatermarkConfig, WatermarkSubTab } from '../types';

interface WatermarkControlsSidebarProps {
  models: ModelInfo[];
  selectedModel: string;
  config: WatermarkConfig;
  onChangeConfig: (config: WatermarkConfig) => void;
  maxTokens: number;
  onChangeMaxTokens: (val: number) => void;
  temperature: number;
  onChangeTemperature: (val: number) => void;
  activeSubTab: WatermarkSubTab;
  isModelReady?: boolean;
  // Contextual actions
  isGenerating?: boolean;
  onStartGeneration?: () => void;
  onStopGeneration?: () => void;
  isAnalyzingDetector?: boolean;
  onRunDetection?: () => void;
  isComparing?: boolean;
  onRunCompare?: () => void;
  onRunTamper?: () => void;
}

export const WatermarkControlsSidebar: React.FC<WatermarkControlsSidebarProps> = ({
  models,
  selectedModel,
  config,
  onChangeConfig,
  maxTokens,
  onChangeMaxTokens,
  temperature,
  onChangeTemperature,
  activeSubTab,
  isModelReady = true,
  isGenerating = false,
  onStartGeneration,
  onStopGeneration,
  isAnalyzingDetector = false,
  onRunDetection,
  isComparing = false,
  onRunCompare,
  onRunTamper
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationMsg, setCalibrationMsg] = useState<string | null>(null);

  const activeModel = models.find((m) => m.name === selectedModel);

  const handleAutoCalibrate = async () => {
    const target = selectedModel || (models[0]?.name ?? 'gemma4:12b');
    setIsCalibrating(true);
    setCalibrationMsg(null);
    try {
      const res = await fetch('/api/models/calibrate-delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: target })
      });
      if (res.ok) {
        const data = await res.json();
        onChangeConfig({ ...config, delta: data.recommended_delta });
        setCalibrationMsg(`🎯 Calibrated δ = ${data.recommended_delta} for ${data.model_name}`);
        setTimeout(() => setCalibrationMsg(null), 4500);
      }
    } catch (e) {
      console.error('Calibration error:', e);
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div className="panel-card" style={{ height: 'fit-content' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Sparkles size={18} color="var(--brand-cyan)" />
            Generation Controls
          </h2>
          <p className="panel-subtitle">Persistent Watermarking Parameters</p>
        </div>
      </div>

      {/* Active Model Indicator */}
      <div className="control-group">
        <div className="control-label">
          <span>Active Model</span>
          <span className="control-val" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Header Selector
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={15} color="var(--brand-cyan)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedModel || 'No Model Loaded'}
            </span>
          </div>
          {activeModel && (
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {activeModel.size_gb} GB
              {activeModel.recommended_delta !== undefined
                ? ` • [δ ≈ ${activeModel.recommended_delta}]`
                : ''}
            </span>
          )}
        </div>
      </div>

      {/* Green List Fraction (gamma) */}
      <div className="control-group">
        <div className="control-label">
          <span>Green List Fraction (γ)</span>
          <span className="control-val">{(config.gamma * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="range-slider"
          min="0.10"
          max="0.60"
          step="0.05"
          value={config.gamma}
          onChange={(e) =>
            onChangeConfig({ ...config, gamma: parseFloat(e.target.value) })
          }
          disabled={isGenerating || isComparing}
        />
        <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
          Portion of vocabulary hashed into green list at each token step.
        </small>
      </div>

      {/* Watermark Boost (delta) */}
      <div className="control-group">
        <div className="control-label">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Watermark Boost (δ)</span>
            <button
              type="button"
              className="button secondary"
              onClick={handleAutoCalibrate}
              disabled={isCalibrating || isGenerating || isComparing}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Auto-estimate optimal delta from model logit dispersion"
            >
              {isCalibrating ? (
                <Activity size={12} className="spin" />
              ) : (
                <Target size={12} color="var(--brand-cyan)" />
              )}
              <span>Auto-Calibrate</span>
            </button>
          </div>
          <span className="control-val">{config.delta.toFixed(1)}</span>
        </div>
        <input
          type="range"
          className="range-slider"
          min="0.0"
          max="8.0"
          step="0.2"
          value={config.delta}
          onChange={(e) =>
            onChangeConfig({ ...config, delta: parseFloat(e.target.value) })
          }
          disabled={isGenerating || isComparing}
        />
        {calibrationMsg && (
          <div style={{ fontSize: '11.5px', color: 'var(--brand-cyan)', fontWeight: 600, marginTop: '2px' }}>
            {calibrationMsg}
          </div>
        )}
        <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
          Logit boost added to green tokens (e.g. δ ≈ 2.0 for Qwen, δ ≈ 5.8 for Gemma).
        </small>
      </div>

      {/* Max Tokens & Temperature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="control-group">
          <div className="control-label">
            <span>Max Tokens</span>
            <span className="control-val">{maxTokens}</span>
          </div>
          <input
            type="number"
            className="text-input"
            min="30"
            max="512"
            value={maxTokens}
            onChange={(e) => onChangeMaxTokens(parseInt(e.target.value) || 100)}
            disabled={isGenerating || isComparing}
          />
        </div>
        <div className="control-group">
          <div className="control-label">
            <span>Temp</span>
            <span className="control-val">{temperature.toFixed(1)}</span>
          </div>
          <input
            type="number"
            className="text-input"
            min="0.1"
            max="1.5"
            step="0.1"
            value={temperature}
            onChange={(e) => onChangeTemperature(parseFloat(e.target.value) || 0.7)}
            disabled={isGenerating || isComparing}
          />
        </div>
      </div>

      {/* Secret Hash Key & Context Width */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '12px' }}>
        <div className="control-group">
          <div className="control-label">
            <span>Secret Hash Key</span>
            <span className="control-val">{config.hash_key}</span>
          </div>
          <input
            type="number"
            className="text-input"
            value={config.hash_key}
            onChange={(e) =>
              onChangeConfig({ ...config, hash_key: parseInt(e.target.value) || 89173511 })
            }
            disabled={isGenerating || isComparing}
          />
        </div>
        <div className="control-group">
          <div className="control-label">
            <span>Context (k)</span>
            <span className="control-val">{config.context_width}</span>
          </div>
          <input
            type="number"
            className="text-input"
            min="1"
            max="4"
            value={config.context_width}
            onChange={(e) =>
              onChangeConfig({ ...config, context_width: parseInt(e.target.value) || 1 })
            }
            disabled={isGenerating || isComparing}
          />
        </div>
      </div>

      {/* Contextual Action Button based on Active Sub-Tab */}
      <div style={{ marginTop: '4px' }}>
        {activeSubTab === 'studio' && (
          !isGenerating ? (
            <button
              className="btn-primary"
              style={{ width: '100%', opacity: !isModelReady ? 0.7 : 1 }}
              onClick={onStartGeneration}
              disabled={!isModelReady}
              title={!isModelReady ? "Model weights are currently loading into memory..." : undefined}
            >
              {!isModelReady ? <Activity size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
              <span>{!isModelReady ? 'Initializing Model...' : 'Generate Watermarked Text'}</span>
            </button>
          ) : (
            <button
              className="button"
              style={{ width: '100%', background: 'var(--watermark-red)' }}
              onClick={onStopGeneration}
            >
              <Square size={16} fill="currentColor" />
              Stop Generation
            </button>
          )
        )}

        {activeSubTab === 'detector' && (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={onRunDetection}
            disabled={isAnalyzingDetector}
          >
            {isAnalyzingDetector ? <Activity size={16} className="spin" /> : <Search size={16} />}
            <span>{isAnalyzingDetector ? 'Analyzing Tokens...' : 'Analyze & Check Watermark'}</span>
          </button>
        )}

        {activeSubTab === 'compare' && (
          <button
            className="btn-primary"
            style={{ width: '100%', opacity: !isModelReady ? 0.7 : 1 }}
            onClick={onRunCompare}
            disabled={isComparing || !isModelReady}
            title={!isModelReady ? "Model weights are currently loading into memory..." : undefined}
          >
            {isComparing || !isModelReady ? <Activity size={16} className="spin" /> : <Columns2 size={16} />}
            <span>{!isModelReady ? 'Initializing Model...' : isComparing ? 'Comparing Models...' : 'Run Side-by-Side Comparison'}</span>
          </button>
        )}

        {activeSubTab === 'tamper' && (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={onRunTamper}
          >
            <RefreshCw size={16} />
            <span>Simulate Edits & Re-Analyze</span>
          </button>
        )}
      </div>
    </div>
  );
};
