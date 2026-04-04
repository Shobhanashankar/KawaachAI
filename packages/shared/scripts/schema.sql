CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS active_zones (
  h3_index TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  risk_multiplier NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_policies (
  policy_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(worker_id),
  h3_zone TEXT NOT NULL REFERENCES active_zones(h3_index),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  daily_wage_inr NUMERIC NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exclusion_flags (
  key TEXT PRIMARY KEY,
  active BOOLEAN DEFAULT FALSE,
  reason TEXT,
  set_by TEXT,
  set_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  policy_id TEXT NOT NULL REFERENCES active_policies(policy_id),
  worker_id TEXT NOT NULL REFERENCES workers(worker_id),
  h3_zone TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  payout_pct NUMERIC NOT NULL,
  fraud_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDING_FRAUD_CHECK',
  guidewire_status TEXT,
  guidewire_claim_id TEXT,
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (policy_id, event_id)
);

CREATE TABLE IF NOT EXISTS claim_manual_review (
  claim_id UUID PRIMARY KEY REFERENCES claims(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_active_policies_zone_status ON active_policies(h3_zone, status);
CREATE INDEX IF NOT EXISTS idx_claims_zone_created ON claims(h3_zone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_worker_created ON claims(worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_status_created ON claims(status, created_at DESC);
