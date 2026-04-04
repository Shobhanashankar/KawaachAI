export type LlmRecommendation = 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO';
export type LlmConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type SignalSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LlmTopSignal {
  signal: string;
  explanation: string;
  severity: SignalSeverity;
}

export interface LlmReviewResult {
  summary: string;
  top_signals: LlmTopSignal[];
  recommendation: LlmRecommendation;
  confidence: LlmConfidence;
  reasoning: string;
}

export interface ManualReviewClaimRow {
  id: string;
  policy_id: string;
  worker_id: string;
  h3_zone: string;
  trigger_type: string;
  payout_pct: number;
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
  fraud_detail: Record<string, unknown> | null;
  decision: string | null;
  decision_reason: string | null;
  decision_by: string | null;
  decision_at: string | null;
}
