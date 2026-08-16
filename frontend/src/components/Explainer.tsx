import React, { useState } from 'react';
import {
  BookOpen,
  Key,
  Layers,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ScanSearch,
  Activity,
  EyeOff,
  Sparkles,
  Lock,
  Zap
} from 'lucide-react';

export const Explainer: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'all' | 'kirchenbauer' | 'radar' | 'detectgpt' | 'utf8'>('all');

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div className="section-header">
        <div>
          <h2>📚 Comprehensive Guide to AI Text Watermarking & Detection</h2>
          <p className="theory-intro">
            An in-depth technical breakdown of the four complementary provenance and forensic detection paradigms implemented in this studio.
          </p>
        </div>

        {/* Section Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className={`button ${activeSection === 'all' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSection('all')}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            All Paradigms
          </button>
          <button
            className={`button ${activeSection === 'kirchenbauer' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSection('kirchenbauer')}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <Sparkles size={13} />
            Token Watermark
          </button>
          <button
            className={`button ${activeSection === 'radar' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSection('radar')}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <ScanSearch size={13} />
            AI Signs Radar
          </button>
          <button
            className={`button ${activeSection === 'detectgpt' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSection('detectgpt')}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <Activity size={13} />
            DetectGPT Curvature
          </button>
          <button
            className={`button ${activeSection === 'utf8' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveSection('utf8')}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <EyeOff size={13} />
            Invisible UTF-8 & Parity
          </button>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '16px' }}>Comparative Matrix: 4 Detection Paradigms</h3>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-dim)' }}>
                <th style={{ padding: '10px 12px' }}>Method</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Perceptual Impact</th>
                <th style={{ padding: '10px 12px' }}>Requires Model?</th>
                <th style={{ padding: '10px 12px' }}>Tamper Localization</th>
                <th style={{ padding: '10px 12px' }}>Core Strengths</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: 'var(--brand-cyan)' }}>
                  🔮 Token Watermark (Kirchenbauer)
                </td>
                <td style={{ padding: '12px', color: 'var(--color-text)' }}>Active Logit Biasing</td>
                <td style={{ padding: '12px', color: '#10b981' }}>100% Invisible in Text</td>
                <td style={{ padding: '12px', color: '#38bdf8' }}>Yes (Tokenizer & RNG)</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Global Z-Score</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Cryptographically robust, survives minor synonym edits</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#f59e0b' }}>
                  🔍 Signs of AI Forensic Radar
                </td>
                <td style={{ padding: '12px', color: 'var(--color-text)' }}>Passive Heuristics & MoS</td>
                <td style={{ padding: '12px', color: '#10b981' }}>Zero Modification</td>
                <td style={{ padding: '12px', color: '#10b981' }}>No (Fast Zero-Shot)</td>
                <td style={{ padding: '12px', color: '#f59e0b' }}>Exact Span Highlights</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Instant passive scan, catches leaks, buzzwords & puffery</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#38bdf8' }}>
                  ⚡ DetectGPT Curvature
                </td>
                <td style={{ padding: '12px', color: 'var(--color-text)' }}>Perturbation Curvature</td>
                <td style={{ padding: '12px', color: '#10b981' }}>Zero Modification</td>
                <td style={{ padding: '12px', color: '#38bdf8' }}>Yes (Log-Likelihood)</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Document Level</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Detects unwatermarked AI text via local probability peaks</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', fontWeight: 700, color: '#c084fc' }}>
                  🥷 Invisible UTF-8 & Parity
                </td>
                <td style={{ padding: '12px', color: 'var(--color-text)' }}>Zero-Width Steganography</td>
                <td style={{ padding: '12px', color: '#10b981' }}>Zero-Width Invisible</td>
                <td style={{ padding: '12px', color: '#10b981' }}>No (Pure String Math)</td>
                <td style={{ padding: '12px', color: '#c084fc' }}>Exact Word Block (100%)</td>
                <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>Embeds arbitrary payloads & pinpoints exact modified words</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 1: KIRCHENBAUER STATISTICAL WATERMARKING */}
      {(activeSection === 'all' || activeSection === 'kirchenbauer') && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color="var(--brand-cyan)" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                1. Statistical Token Watermarking (Kirchenbauer et al., ICML 2023)
              </h3>
            </div>
          </div>

          <p className="theory-intro" style={{ marginBottom: '20px' }}>
            Kirchenbauer statistical watermarking intercepts the model’s autoregressive sampling loop. Without modifying model weights, it imperceptibly guides token selection into a pseudo-random <strong>Green List</strong> seeded by the preceding tokens.
          </p>

          <div className="step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div className="step-card">
              <span className="step-num">STEP 01</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <Key size={16} color="var(--brand-cyan)" />
                <h4>Context Hashing</h4>
              </div>
              <p>
                At step <code>t</code>, context token <code>x_(t-1)</code> and secret key <code>K</code> are hashed into a deterministic seed:
                <br />
                <code style={{ color: 'var(--brand-cyan)', fontSize: '11.5px', marginTop: '4px', display: 'inline-block' }}>
                  seed = hash(x_(t-1), K)
                </code>
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">STEP 02</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <Layers size={16} color="var(--watermark-green)" />
                <h4>Vocabulary Partition</h4>
              </div>
              <p>
                Using the seed, vocabulary <code>V</code> is split into a <strong>Green List</strong> <code>G</code> of size <code>γ|V|</code> (e.g. 25%) and a <strong>Red List</strong> <code>R</code> of size <code>(1-γ)|V|</code>.
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">STEP 03</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <TrendingUp size={16} color="var(--brand-cyan)" />
                <h4>Logit Biasing</h4>
              </div>
              <p>
                Before Softmax, add bias <code>δ &gt; 0</code> to logits in <code>G</code>:
                <br />
                <code style={{ color: 'var(--brand-cyan)', fontSize: '11.5px', marginTop: '4px', display: 'inline-block' }}>
                  logits'[v] = logits[v] + δ · 𝟙(v ∈ G)
                </code>
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">STEP 04</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <ShieldCheck size={16} color="var(--watermark-green)" />
                <h4>Statistical Z-Score Verification</h4>
              </div>
              <p>
                Tests if observed green count <code>N_G</code> significantly exceeds expected <code>γN</code>:
                <br />
                <code style={{ color: 'var(--watermark-green)', fontSize: '11.5px', marginTop: '4px', display: 'inline-block' }}>
                  z = (N_G - γN) / √(Nγ(1-γ))
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SIGNS OF AI FORENSIC RADAR */}
      {(activeSection === 'all' || activeSection === 'radar') && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ScanSearch size={20} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                2. Signs of AI Forensic Radar & De-AI-ifier (Wikipedia MoS Guidelines)
              </h3>
            </div>
          </div>

          <p className="theory-intro" style={{ marginBottom: '20px' }}>
            Inspired directly by <a href="https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Wikipedia:Signs of AI writing</a>. Evaluates 6 independent layers of stylistic, structural, and platform hallmarks that language models habitually generate.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div className="theory-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>
                🔴 1. Machine Artifacts
              </div>
              <p>
                Leaked search/citation tokens (<code>turn0search0</code>, <code>【1†source】</code>, <code>[cite: 1]</code>), URL trackers (<code>utm_source=chatgpt.com</code>), and assistant bleed (*"Certainly! Here is..."*).
              </p>
            </div>

            <div className="theory-box" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#eab308', marginBottom: '4px' }}>
                🟡 2. AI Vocabulary & Copula
              </div>
              <p>
                Overrepresented buzzwords (*delve, tapestry, testament, beacon, pivotal, multifaceted*) and copula avoidance (*"stands as a testament to"* instead of *"is"*).
              </p>
            </div>

            <div className="theory-box" style={{ borderColor: 'rgba(249, 115, 22, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>
                🟠 3. Rhetoric & Syntax
              </div>
              <p>
                Negative parallelisms (*"not only X, but also Y"*, *"rather than X, Y"*, *"not on speed, but on safety"*) and formulaic gerund tricolon lists (*"fostering X, enhancing Y, and driving Z"*).
              </p>
            </div>

            <div className="theory-box" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#a855f7', marginBottom: '4px' }}>
                🟣 4. Structure & MoS
              </div>
              <p>
                Inline bold vertical lists (<code>* **Item:** Desc</code>), clustered em-dashes, Title Case headings, and excessive thematic break lines.
              </p>
            </div>

            <div className="theory-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                🔵 5. Puffery & Weasel Words
              </div>
              <p>
                Significance puffery (*"marking a pivotal moment"*, *"enduring legacy"*), generic ecosystem homilies, and vague passive attributions (*"prompted broader reflection"*).
              </p>
            </div>

            <div className="theory-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                🟢 6. Cadence & Citations
              </div>
              <p>
                ISBN-10/13 mathematical checksum validation, DOI verification, and stylometric burstiness (sentence length std dev and coefficient of variation).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DETECTGPT PROBABILITY CURVATURE */}
      {(activeSection === 'all' || activeSection === 'detectgpt') && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                3. DetectGPT: Perturbation Log-Probability Curvature (Mitchell et al., ICML 2023)
              </h3>
            </div>
          </div>

          <p className="theory-intro" style={{ marginBottom: '16px' }}>
            DetectGPT detects machine-generated text without training a separate classifier by exploiting the <strong>negative curvature</strong> of an LLM's log-probability landscape.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="theory-box">
                <strong style={{ color: '#ef4444' }}>🤖 Machine Text (Local Peak):</strong>
                <p style={{ margin: '4px 0 0 0' }}>
                  Model-generated texts reside at local probability maxima. Small semantic perturbations <code>x̃_i</code> almost always decrease log-likelihood:
                  <br />
                  <code style={{ color: '#f97316' }}>d(x) = log p(x) - (1/k) ∑ log p(x̃_i) &gt;&gt; 0</code>
                </p>
              </div>

              <div className="theory-box">
                <strong style={{ color: '#10b981' }}>✍️ Human Text (Flat/Valleys):</strong>
                <p style={{ margin: '4px 0 0 0' }}>
                  Human writing explores diverse, non-greedy semantic choices. Perturbations do not consistently reduce model probability:
                  <br />
                  <code style={{ color: '#10b981' }}>d(x) ≈ 0  (z &lt; 0.85)</code>
                </p>
              </div>
            </div>

            {/* Formula Block */}
            <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: '8px' }}>
                DETECTGPT FORMULATION
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--brand-cyan)', lineHeight: '1.7' }}>
                log p(x) = ∑ log p(x_t | x_&lt;t)<br />
                μ_x̃ = (1/k) ∑ log p(x̃_i)<br />
                σ_x̃ = std(log p(x̃_i))<br />
                <strong style={{ color: 'var(--color-text)' }}>z = (log p(x) - μ_x̃) / σ_x̃</strong>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--color-text-dim)' }}>
                Verdict: <code>z ≥ 1.75</code> → Likely AI Peak
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: INVISIBLE UTF-8 & BLOCK-BASED PARITY */}
      {(activeSection === 'all' || activeSection === 'utf8') && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOff size={20} color="#c084fc" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                4. Invisible UTF-8 Steganography & Block-Based Parity
              </h3>
            </div>
          </div>

          <p className="theory-intro" style={{ marginBottom: '20px' }}>
            Zero-perceptual-distortion steganographic watermarking using 4-symbol unrendered Unicode characters, combined with <strong>cryptographic block parity checksums</strong> to achieve exact tamper localization.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="theory-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#c084fc', fontWeight: 700, fontSize: '13px' }}>
                <EyeOff size={16} />
                <span>Zero-Width Encoding</span>
              </div>
              <p>
                Maps 2 bits per symbol into invisible zero-width Unicode characters:
                <br />
                <code>[ZWSP]</code> (00), <code>[ZWNJ]</code> (01), <code>[ZWJ]</code> (10), <code>[WJ]</code> (11).
                Frame delimiters use <code>[BOM]</code>.
              </p>
            </div>

            <div className="theory-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#10b981', fontWeight: 700, fontSize: '13px' }}>
                <Lock size={16} />
                <span>Provenance Payload</span>
              </div>
              <p>
                Embeds arbitrary metadata signatures (model name, generation timestamp, author key, license) with 16-bit CRC checksum verification.
              </p>
            </div>

            <div className="theory-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}>
                <ShieldAlert size={16} />
                <span>Block Parity Localization</span>
              </div>
              <p>
                Partitions text into $N$-word blocks with embedded parity hashes. If an adversary edits or deletes any word, the verifier <strong>isolates and highlights the exact tampered block</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
