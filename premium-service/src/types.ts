// ─── Domain Types ──────────────────────────────────────────────────────────────

export type SafeRiderTier = 1 | 2 | 3 | 4 | 5;

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PayoutType = 'claim' | 'cashback' | 'refund';

export type PolicyStatus = 'active' | 'lapsed' | 'cancelled';

export type SquadStatus = 'active' | 'disbanded';

// ─── Database Row Types ────────────────────────────────────────────────────────

export interface Worker {
  id: string;
  platform_worker_id: string;
  platform: 'zepto' | 'blinkit';
  name: string;
  phone: string;
  upi_id: string;
  h3_zone: string;
  daily_wage_est: number;
  razorpay_customer_id: string | null;
  razorpay_mandate_id: string | null;
  mandate_status: 'pending' | 'active' | 'paused' | 'cancelled' | null;
  created_at: Date;
  updated_at: Date;
}

export interface Policy {
  id: string;
  worker_id: string;
  status: PolicyStatus;
  guidewire_policy_id: string | null;
  weekly_premium: number;
  start_date: Date;
  end_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PremiumLedger {
  id: string;
  worker_id: string;
  policy_id: string;
  week_start: Date;
  base_premium: number;
  zone_multiplier: number;
  saferider_discount_pct: number;
  dost_flat_discount: number;
  final_premium: number;
  shap_breakdown: ShapBreakdown;
  deducted_at: Date | null;
  razorpay_payment_id: string | null;
  status: 'pending' | 'deducted' | 'failed';
  created_at: Date;
}

export interface SafeRiderScore {
  id: string;
  worker_id: string;
  tier: SafeRiderTier;
  consecutive_weeks: number;
  total_weeks: number;
  fraud_flags: number;
  last_tier_change: Date;
  updated_at: Date;
}

export interface DostSquad {
  id: string;
  name: string;
  dark_store_h3: string;
  status: SquadStatus;
  zero_claim_streak: number;
  created_at: Date;
  updated_at: Date;
}

export interface DostSquadMember {
  id: string;
  squad_id: string;
  worker_id: string;
  joined_at: Date;
  is_active: boolean;
}

export interface Payout {
  id: string;
  worker_id: string;
  type: PayoutType;
  amount: number;
  upi_id: string;
  razorpay_payout_id: string | null;
  razorpay_fund_account_id: string | null;
  status: PayoutStatus;
  idempotency_key: string;
  reference_id: string | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Business Logic Types ──────────────────────────────────────────────────────

export interface ShapBreakdown {
  base_premium: number;
  zone_contribution: number;
  saferider_contribution: number;
  dost_contribution: number;
  final_premium: number;
  features: {
    daily_wage_est: number;
    h3_zone: string;
    zone_multiplier: number;
    saferider_tier: SafeRiderTier;
    in_dost_squad: boolean;
  };
}

export interface PremiumCalculationResult {
  worker_id: string;
  week_start: Date;
  base_premium: number;
  zone_multiplier: number;
  zone_adjusted: number;
  saferider_discount_pct: number;
  after_sr: number;
  dost_flat_discount: number;
  after_dost: number;
  final_premium: number;
  shap_breakdown: ShapBreakdown;
  ml_used: boolean;
}

export interface MLPremiumResponse {
  zone_multiplier: number;
  shap_values: Record<string, number>;
  model_version: string;
}

export interface TierRule {
  tier: SafeRiderTier;
  min_consecutive_weeks: number;
  discount_pct: number;
  fraud_threshold: number;
  label: string;
}

export interface DostCashbackResult {
  squad_id: string;
  week_start: Date;
  eligible: boolean;
  member_count: number;
  cashback_amount_per_member: number;
  payouts_initiated: string[];
}

// ─── Kafka Event Types ─────────────────────────────────────────────────────────

export interface ClaimApprovedEvent {
  claim_id: string;
  worker_id: string;
  policy_id: string;
  payout_amount: number;
  upi_id: string;
  disruption_type: string;
  approved_at: string;
}

export interface PayoutCompletedEvent {
  payout_id: string;
  worker_id: string;
  amount: number;
  type: PayoutType;
  razorpay_payout_id: string;
  completed_at: string;
}

export interface SafeRiderTierChangedEvent {
  worker_id: string;
  old_tier: SafeRiderTier;
  new_tier: SafeRiderTier;
  reason: 'promotion' | 'fraud_demotion' | 'reset';
  changed_at: string;
}

// ─── API Request / Response Types ─────────────────────────────────────────────

export interface CreateMandateRequest {
  worker_id: string;
  upi_id: string;
  max_amount: number;
}

export interface CreateSquadRequest {
  name: string;
  dark_store_h3: string;
  member_worker_ids: string[];
}

export interface FraudThresholdResponse {
  worker_id: string;
  tier: SafeRiderTier;
  fraud_score_threshold: number;
  fast_track: boolean;
  description: string;
}

export interface WeeklyDeductionSummary {
  week_start: Date;
  total_workers: number;
  successful_deductions: number;
  failed_deductions: number;
  total_amount_deducted: number;
  errors: Array<{ worker_id: string; error: string }>;
}

// ─── Razorpay Types ────────────────────────────────────────────────────────────

export interface RazorpayContact {
  id: string;
  name: string;
  email?: string;
  contact?: string;
  type: string;
  reference_id: string;
}

export interface RazorpayFundAccount {
  id: string;
  contact_id: string;
  account_type: string;
  vpa: { address: string };
}

export interface RazorpayPayout {
  id: string;
  fund_account_id: string;
  amount: number;
  currency: string;
  mode: string;
  purpose: string;
  status: string;
  reference_id: string;
}

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payout?: { entity: RazorpayPayout };
    payment?: { entity: Record<string, unknown> };
  };
  created_at: number;
}