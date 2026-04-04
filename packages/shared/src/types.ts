export const TRIGGER_TYPES = ['RAIN', 'AQI', 'WIND', 'CURFEW', 'PLATFORM_DOWN'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const EVENT_SEVERITIES = ['PARTIAL', 'FULL'] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const CLAIM_STATUSES = [
  'PENDING_FRAUD_CHECK',
  'FRAUD_FLAGGED',
  'MANUAL_REVIEW',
  'SOFT_HOLD',
  'STEP_UP',
  'REJECTED',
  'APPROVED',
  'FNOL_SUBMITTED',
  'PAYOUT_QUEUED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const RBA_OUTCOMES = ['AUTO_APPROVE', 'SOFT_HOLD', 'STEP_UP', 'REJECT'] as const;
export type RBAOutcome = (typeof RBA_OUTCOMES)[number];

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
  saferider_tier: number;
}

export interface WorkerTelemetryProfile {
  worker_id: string;
  mock_provider: boolean;
  allow_mock_location: boolean;
  lat: number;
  lng: number;
  hdop: number;
  accelerometer_variance: number;
  barometric_pressure_hpa: number;
  gnss_cn0: number;
  gnss_agc: number;
  gps_timestamp_ms: number;
  ntp_timestamp_ms: number;
  battery_drain_z_score: number;
  speed_samples: number[];
  bssids: string[];
  cell_tower_ids: string[];
  recent_app_activity_in_zone: boolean;
  shared_network_flag: boolean;
}

export interface FraudFeatureVector {
  mock_location_flag: number;
  accelerometer_variance: number;
  barometric_delta_match: number;
  gnss_cn0_agc_anomaly: number;
  gnss_ntp_time_delta: number;
  bssid_zone_match: number;
  cell_tower_zone_match: number;
  battery_drain_z_score: number;
  speed_variance_30min: number;
  route_vector_linearity: number;
  recent_app_activity_in_zone: number;
  claim_burst_rank: number;
  device_proximity_graph_degree: number;
  shared_network_flag: number;
  source_consensus_score: number;
}

export interface FraudDetail {
  claim_id: string;
  fraud_score: number;
  rba_outcome: RBAOutcome;
  shap_values: Record<string, number>;
  feature_vector: FraudFeatureVector;
  layer_outcomes: {
    mock_check: 'PASS' | 'FAIL';
    geo_validation: 'PASS' | 'FAIL';
    dedup: 'PASS' | 'FAIL';
    source_consensus: 'PASS' | 'FAIL';
    isolation_forest: number;
    syndicate_graph: string;
  };
}

export interface FraudRingSnapshot {
  bssid_hash: string;
  worker_ids: string[];
  claim_ids: string[];
  worker_count: number;
  last_seen_at: string;
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
  fraud_latency_ms: number | null;
  rba_outcome: RBAOutcome | null;
  fraud_detail: FraudDetail | null;
  status: ClaimStatus;
  guidewire_status: string | null;
  guidewire_claim_id: string | null;
  created_at: string;
  updated_at: string;
}
