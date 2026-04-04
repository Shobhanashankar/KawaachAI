export const TRIGGER_TYPES = ['RAIN', 'AQI', 'WIND', 'CURFEW', 'PLATFORM_DOWN'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const EVENT_SEVERITIES = ['PARTIAL', 'FULL'] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const CLAIM_STATUSES = [
  'PENDING_FRAUD_CHECK',
  'FRAUD_FLAGGED',
  'MANUAL_REVIEW',
  'APPROVED',
  'FNOL_SUBMITTED',
  'PAYOUT_QUEUED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface DisruptionEvent {
  event_id: string;
  zone_h3: string;
  trigger_type: TriggerType;
  severity: EventSeverity;
  payout_pct: number;
  timestamp: string;
  source_apis: string[];
  raw_values: {
    rainfall_mm: number | null;
    wind_kmph: number | null;
    aqi: number | null;
  };
  exclusion_active: boolean;
}

export interface ExclusionState {
  war: boolean;
  pandemic_WHO_declared: boolean;
  government_force_majeure: boolean;
  reason?: string;
  set_by?: string;
  set_at?: string;
}

export interface ActiveZone {
  h3_index: string;
  city: string;
  lat: number;
  lng: number;
  risk_multiplier: number;
}

export interface ActivePolicy {
  policy_id: string;
  worker_id: string;
  h3_zone: string;
  status: 'ACTIVE' | 'LAPSED' | 'CANCELLED';
  daily_wage_inr: number;
}

export interface FnolPayload {
  policy_id: string;
  worker_id: string;
  claim_type: 'PARAMETRIC_INCOME_LOSS';
  loss_date: string;
  h3_zone: string;
  trigger: TriggerType;
  payout_pct: number;
  fraud_score: number;
  status: 'DRAFT';
}

export interface ClaimRow {
  id: string;
  event_id: string;
  policy_id: string;
  worker_id: string;
  h3_zone: string;
  trigger_type: TriggerType;
  severity: EventSeverity;
  payout_pct: number;
  fraud_score: number | null;
  status: ClaimStatus;
  guidewire_status: string | null;
  guidewire_claim_id: string | null;
  created_at: string;
  updated_at: string;
}
