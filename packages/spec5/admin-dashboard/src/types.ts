export interface DashboardKpis {
  active_policies: number;
  claims_this_week: number;
  auto_approval_rate_pct: number;
  manual_review_queue_depth: number;
  revenue_this_week_inr: number;
  avg_claim_to_payout_latency_ms: number;
}

export interface ClaimRow {
  id: string;
  policy_id: string;
  worker_id: string;
  h3_zone: string;
  trigger_type: string;
  payout_pct: number;
  payout_amount_inr: number;
  fraud_score: number | null;
  rba_outcome: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  guidewire_status: string | null;
  guidewire_claim_id: string | null;
  error_reason: string | null;
  worker_name: string | null;
  city: string | null;
  saferider_tier: number | null;
  daily_wage_inr: number | null;
  fraud_detail: {
    shap_values?: Record<string, number>;
    layer_outcomes?: Record<string, string | number>;
    feature_vector?: Record<string, number | string | boolean>;
  } | null;
  decision: string | null;
  decision_reason: string | null;
  decision_by: string | null;
  decision_at: string | null;
}

export interface HeatmapZone {
  h3_index: string;
  city: string;
  lat: number;
  lng: number;
  active_policies: number;
  claim_rate_pct: number;
  loss_ratio_pct: number;
  top_fraud_signals: string[];
  risk_color: 'green' | 'yellow' | 'orange' | 'red';
  fraud_flag_count: number;
  weather_history: string[];
}

export interface LayerStat {
  layer: string;
  total_claims_processed: number;
  pass_rate_pct: number;
  reject_rate_pct: number;
  avg_latency_ms: number;
}

export interface FraudRing {
  bssid_hash: string;
  worker_ids: string[];
  claim_ids: string[];
  worker_count: number;
  last_seen_at: string;
}

export interface ServiceHealthRow {
  service: string;
  status: 'up' | 'down';
  details?: unknown;
}

export interface ExclusionState {
  war: boolean;
  pandemic_WHO_declared: boolean;
  government_force_majeure: boolean;
  reason?: string;
  set_by?: string;
  set_at?: string;
}

export interface LlmReviewResult {
  summary: string;
  top_signals: Array<{ signal: string; explanation: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  recommendation: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export interface LlmReviewPayload {
  available: boolean;
  provider: string;
  model: string;
  prompt: string;
  result?: LlmReviewResult;
  fallback_message?: string;
  raw_text?: string;
}
