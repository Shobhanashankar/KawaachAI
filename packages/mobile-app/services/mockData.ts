/**
 * Mock data for demo — simulates backend API responses.
 * Used when backend is not running.
 */

import { WorkerProfile } from './storage';

export const MOCK_WORKER: WorkerProfile = {
  worker_id: 'WKR-BLR-001',
  name: 'Raju',
  platform: 'zepto',
  partner_id: 'ZPT-98765',
  daily_wage: 450,
  zone_h3: '8928308280fffff',
  city: 'Bengaluru',
  policy_id: 'POL-2026-001',
  policy_status: 'ACTIVE',
  saferider_tier: 2,
  premium: 69,
  protected_earnings: 2700,
  total_premiums_paid: 414,
  squad_id: 'SQD-BLR-01',
};

export const MOCK_PREMIUM_BREAKDOWN = {
  base: 63,
  zone_factor: 1.3,
  zone_adjusted: 82,
  saferider_discount: -4,
  dost_shield_discount: -9,
  final: 69,
  features: [
    { name: 'Zone Flood History', value: 0.35, impact: 'high' as const },
    { name: 'Monsoon Season', value: 0.25, impact: 'high' as const },
    { name: 'AQI Exposure', value: 0.12, impact: 'medium' as const },
    { name: 'Wind Exposure', value: 0.08, impact: 'low' as const },
    { name: 'Claim History', value: -0.05, impact: 'low' as const },
    { name: 'SafeRider Score', value: -0.15, impact: 'medium' as const },
  ],
};

export const MOCK_CLAIMS = [
  {
    id: 'CLM-001',
    event_id: 'EVT-001',
    worker_id: 'WKR-BLR-001',
    trigger_type: 'RAIN' as const,
    severity: 'FULL' as const,
    status: 'APPROVED',
    payout_pct: 1.0,
    payout_amount: 450,
    fraud_score: 0.12,
    rba_outcome: 'AUTO_APPROVE',
    created_at: '2026-03-28T14:30:00Z',
  },
  {
    id: 'CLM-002',
    event_id: 'EVT-002',
    worker_id: 'WKR-BLR-001',
    trigger_type: 'RAIN' as const,
    severity: 'PARTIAL' as const,
    status: 'APPROVED',
    payout_pct: 0.5,
    payout_amount: 225,
    fraud_score: 0.18,
    rba_outcome: 'AUTO_APPROVE',
    created_at: '2026-03-25T09:15:00Z',
  },
  {
    id: 'CLM-003',
    event_id: 'EVT-003',
    worker_id: 'WKR-BLR-001',
    trigger_type: 'AQI' as const,
    severity: 'FULL' as const,
    status: 'SOFT_HOLD',
    payout_pct: 1.0,
    payout_amount: 450,
    fraud_score: 0.52,
    rba_outcome: 'SOFT_HOLD',
    created_at: '2026-04-02T11:45:00Z',
  },
  {
    id: 'CLM-004',
    event_id: 'EVT-004',
    worker_id: 'WKR-BLR-001',
    trigger_type: 'WIND' as const,
    severity: 'FULL' as const,
    status: 'STEP_UP',
    payout_pct: 1.0,
    payout_amount: 450,
    fraud_score: 0.74,
    rba_outcome: 'STEP_UP',
    created_at: '2026-04-04T08:00:00Z',
  },
  {
    id: 'CLM-005',
    event_id: 'EVT-005',
    worker_id: 'WKR-BLR-001',
    trigger_type: 'PLATFORM_DOWN' as const,
    severity: 'PARTIAL' as const,
    status: 'APPROVED',
    payout_pct: 0.4,
    payout_amount: 180,
    fraud_score: 0.08,
    rba_outcome: 'AUTO_APPROVE',
    created_at: '2026-03-20T16:20:00Z',
  },
];

export const MOCK_ZONE_RISK = {
  flood: 72,
  aqi: 35,
  wind: 48,
};

export const MOCK_SQUAD = {
  squad_id: 'SQD-BLR-01',
  zone_h3: '8928308280fffff',
  members: [
    { worker_id: 'WKR-BLR-001', name: 'Raju', avatar: '🏍️' },
    { worker_id: 'WKR-BLR-002', name: 'Amit', avatar: '🛵' },
    { worker_id: 'WKR-BLR-003', name: 'Sanjay', avatar: '🏍️' },
    { worker_id: 'WKR-BLR-004', name: 'Vikram', avatar: '🛵' },
    { worker_id: 'WKR-BLR-005', name: 'Deepak', avatar: '🏍️' },
  ],
  claim_free_weeks: 3,
  cashback_eligible: true,
  cashback_amount: 6.9,
};

export const MOCK_DAILY_FORECAST = {
  risk_level: 'high' as const,
  rain_probability: 78,
  aqi_forecast: 185,
  wind_forecast: 32,
  message_key: 'home.high_risk',
};
