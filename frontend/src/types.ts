export type PrimaryTab = 'token_watermark' | 'utf8_parity' | 'detectgpt' | 'radar' | 'explainer';
export type WatermarkSubTab = 'studio' | 'detector' | 'compare' | 'tamper' | 'benchmark';

export interface ModelInfo {
  name: string;
  path: string;
  size_gb: number;
  is_ollama: boolean;
  recommended_delta?: number;
  prompt_suffix?: string;
  disable_thinking?: boolean;
}

export interface CalibrationResult {
  model_name: string;
  recommended_delta: number;
  prompt_suffix?: string;
  disable_thinking?: boolean;
  source: string;
  explanation: string;
  top_gap_1_2?: number;
  top_gap_1_5?: number;
  top_50_std?: number;
}

export interface WatermarkConfig {
  gamma: number;
  delta: number;
  hash_key: number;
  context_width: number;
}

export interface TokenItem {
  id: number;
  text: string;
  is_green: boolean | null;
  is_evaluated?: boolean;
  position?: number;
}

export interface DetectionResult {
  total_tokens: number;
  evaluated_tokens: number;
  green_tokens: number;
  red_tokens: number;
  green_fraction: number;
  expected_fraction: number;
  z_score: number;
  p_value: number;
  is_watermarked: boolean;
  confidence_level: string;
  tokens: TokenItem[];
  summary: string;
}

export interface StreamTokenEvent {
  type: 'token';
  token_id: number;
  text: string;
  is_green: boolean;
  green_count: number;
  total_generated: number;
  green_fraction: number;
  z_score: number;
  finish_reason?: string;
}

export interface BenchmarkDocItem {
  id: string;
  filename: string;
  category: string;
  total_tokens: number;
  evaluated_tokens: number;
  green_tokens: number;
  red_tokens: number;
  green_fraction: number;
  z_score: number;
  p_value: number;
  is_watermarked_z3: boolean;
  is_watermarked_z2: boolean;
  is_watermarked_z4: boolean;
  is_watermarked_z5: boolean;
  preview: string;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  bin_label: string;
  count: number;
  percentage: number;
}

export interface CategorySummaryItem {
  category: string;
  doc_count: number;
  total_tokens: number;
  mean_z_score: number;
  std_z_score: number;
  mean_green_fraction: number;
  false_positives_z3: number;
  false_positive_rate_z3: number;
}

export interface FalsePositiveTier {
  threshold: number;
  theoretical_fpr: number;
  empirical_false_positives: number;
  empirical_fpr: number;
  empirical_fpr_percent: number;
}

export interface BenchmarkDataset {
  metadata: {
    model_name: string;
    vocab_size: number;
    watermark_config: {
      gamma: number;
      hash_key: number;
      context_width: number;
    };
    total_documents: number;
    total_tokens_evaluated: number;
    average_tokens_per_doc: number;
    execution_time_seconds: number;
    timestamp: string;
  };
  aggregate_metrics: {
    mean_z_score: number;
    median_z_score: number;
    std_z_score: number;
    min_z_score: number;
    max_z_score: number;
    mean_green_fraction: number;
    std_green_fraction: number;
    expected_green_fraction: number;
  };
  false_positive_analysis: {
    threshold_z2: FalsePositiveTier;
    threshold_z3: FalsePositiveTier;
    threshold_z4: FalsePositiveTier;
    threshold_z5: FalsePositiveTier;
  };
  histogram: HistogramBin[];
  category_summary: CategorySummaryItem[];
  documents: BenchmarkDocItem[];
}

export interface WatermarkedSampleStats {
  text: string;
  total_tokens: number;
  evaluated_tokens: number;
  green_tokens: number;
  red_tokens: number;
  green_fraction: number;
  z_score: number;
  p_value: number;
  is_detected_z3: boolean;
  is_detected_z4: boolean;
  is_detected_z5: boolean;
}

export interface WatermarkedPairSample {
  id: string;
  prompt: string;
  watermarked: WatermarkedSampleStats;
  unwatermarked: WatermarkedSampleStats;
}

export interface WatermarkedDataset {
  metadata: {
    model_name: string;
    watermark_config: {
      gamma: number;
      delta: number;
      hash_key: number;
      context_width: number;
    };
    total_prompts: number;
    execution_time_seconds?: number;
    timestamp: string;
  };
  aggregate_comparison?: {
    watermarked: {
      mean_z_score: number;
      median_z_score: number;
      std_z_score: number;
      mean_green_fraction: number;
      true_positive_rate_z3: number;
      true_positive_rate_z4: number;
      true_positive_rate_z5: number;
    };
    unwatermarked: {
      mean_z_score: number;
      median_z_score: number;
      std_z_score: number;
      mean_green_fraction: number;
      false_positive_rate_z3: number;
      false_positive_rate_z4: number;
      false_positive_rate_z5: number;
    };
  };
  samples: WatermarkedPairSample[];
}

export type SeverityLevel = 'info' | 'warning' | 'critical';
export type CategoryType =
  | 'machine_artifacts'
  | 'ai_vocabulary'
  | 'rhetorical_syntax'
  | 'structural_style'
  | 'discourse_puffery'
  | 'citations_integrity';

export interface HeuristicHit {
  rule_id: string;
  category: CategoryType;
  rule_name: string;
  severity: SeverityLevel;
  start_char: number;
  end_char: number;
  matched_text: string;
  explanation: string;
  suggestion?: string | null;
  confidence: number;
}

export interface CategoryBreakdown {
  count: number;
  score: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  description: string;
}

export interface RadarScores {
  machine_artifacts: number;
  ai_vocabulary: number;
  rhetorical_syntax: number;
  structural_style: number;
  discourse_puffery: number;
  stylometry_burstiness: number;
  overall_ai_score: number;
  confidence_tier: 'low_evidence' | 'moderate_stylistic_ai' | 'strong_stylistic_ai' | 'definitive_machine_leak';
  verdict_summary: string;
}

export interface SentenceStat {
  index: number;
  text: string;
  word_count: number;
  start_char: number;
  end_char: number;
  hit_count: number;
  has_critical: boolean;
}

export interface StylometryMetrics {
  total_words: number;
  total_sentences: number;
  avg_sentence_length: number;
  sentence_length_std: number;
  burstiness_score: number;
  type_token_ratio: number;
  em_dash_count: number;
  copula_ratio: number;
  ai_vocab_density: number;
}

export interface SuggestionFix {
  id: string;
  rule_id: string;
  start_char: number;
  end_char: number;
  original_text: string;
  replacement_text: string;
  reason: string;
}

export interface AIAnalysisResult {
  text: string;
  mode: string;
  metrics: StylometryMetrics;
  radar_scores: RadarScores;
  hits: HeuristicHit[];
  category_breakdowns: Record<string, CategoryBreakdown>;
  sentences: SentenceStat[];
  suggestions: SuggestionFix[];
  cleaned_draft: string;
}

export interface SampleCase {
  id: string;
  title: string;
  category: string;
  source_description: string;
  text: string;
  expected_highlights: string[];
}

export interface MutatedWord {
  original: string;
  replacement: string;
}

export interface PerturbationItem {
  id: number;
  text: string;
  log_prob: number;
  avg_token_log_prob: number;
  perplexity: number;
  diff_count: number;
  delta_from_original: number;
  mutated_words: MutatedWord[];
}

export interface CurvaturePoint {
  sample_index: number;
  name: string;
  log_prob: number;
  avg_token_log_prob: number;
  is_original: boolean;
}

export interface DetectGPTHistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
  is_original_bin: boolean;
}

export interface DetectGPTResult {
  original_text: string;
  num_tokens: number;
  original_log_prob: number;
  original_avg_log_prob: number;
  original_perplexity: number;
  
  num_perturbations: number;
  perturbation_pct: number;
  perturbations: PerturbationItem[];
  
  mean_perturbed_log_prob: number;
  std_perturbed_log_prob: number;
  mean_perturbed_perplexity: number;
  
  discrepancy_score: number;
  z_score: number;
  normalized_discrepancy: number;
  
  verdict: 'likely_ai' | 'uncertain' | 'likely_human';
  confidence_pct: number;
  summary: string;
  
  curve_points: CurvaturePoint[];
  histogram: DetectGPTHistogramBin[];
}

export interface DetectGPTPreset {
  id: string;
  title: string;
  category: 'ai_generated' | 'human_written';
  model_or_source: string;
  text: string;
  expected_verdict: string;
}

export interface UTF8BlockParityDetail {
  block_index: number;
  block_text: string;
  clean_text: string;
  start_char: number;
  end_char: number;
  expected_hash: string;
  actual_hash: string;
  status: 'verified' | 'tampered' | 'unwatermarked';
  explanation: string;
}

export interface UTF8EmbedResult {
  original_text: string;
  watermarked_text: string;
  payload: string;
  block_word_size: number;
  total_blocks: number;
  hidden_char_count: number;
  revealed_text: string;
  summary: string;
  blocks: UTF8BlockParityDetail[];
}

export interface UTF8VerifyResult {
  is_watermarked: boolean;
  payload_extracted: string | null;
  total_blocks: number;
  verified_blocks: number;
  tampered_blocks: number;
  unwatermarked_blocks: number;
  integrity_score: number;
  verdict: 'intact' | 'partially_tampered' | 'severely_tampered' | 'not_watermarked';
  blocks: UTF8BlockParityDetail[];
  revealed_text: string;
  hidden_char_count: number;
  summary: string;
}

export interface UTF8Preset {
  id: string;
  title: string;
  description: string;
  watermarked_text: string;
  payload: string;
  is_tampered: boolean;
  tamper_description: string | null;
}
