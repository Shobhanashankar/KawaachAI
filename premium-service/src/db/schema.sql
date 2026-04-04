-- KawaachAI Premium Service — Database Schema
-- Requires: PostgreSQL 14+ with PostGIS extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Workers ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_worker_id    VARCHAR(100) NOT NULL,
  platform              VARCHAR(20)  NOT NULL CHECK (platform IN ('zepto', 'blinkit')),
  name                  VARCHAR(200) NOT NULL,
  phone                 VARCHAR(15)  NOT NULL UNIQUE,
  upi_id                VARCHAR(100) NOT NULL,
  h3_zone               VARCHAR(20)  NOT NULL,
  daily_wage_est        NUMERIC(10,2) NOT NULL DEFAULT 400.00,
  razorpay_customer_id  VARCHAR(100),
  razorpay_mandate_id   VARCHAR(100),
  mandate_status        VARCHAR(20)  CHECK (mandate_status IN ('pending','active','paused','cancelled')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_platform_worker
  ON workers(platform_worker_id, platform);
CREATE INDEX IF NOT EXISTS idx_workers_h3_zone ON workers(h3_zone);
CREATE INDEX IF NOT EXISTS idx_workers_mandate ON workers(razorpay_mandate_id);

-- ─── Policies ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policies (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id             UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','lapsed','cancelled')),
  guidewire_policy_id   VARCHAR(100),
  weekly_premium        NUMERIC(10,2) NOT NULL,
  start_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date              DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_worker_id ON policies(worker_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);

-- ─── Premium Ledger ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS premium_ledger (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  policy_id               UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  week_start              DATE NOT NULL,
  base_premium            NUMERIC(10,2) NOT NULL,
  zone_multiplier         NUMERIC(6,4)  NOT NULL DEFAULT 1.0,
  saferider_discount_pct  NUMERIC(5,4)  NOT NULL DEFAULT 0.0,
  dost_flat_discount      NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  final_premium           NUMERIC(10,2) NOT NULL,
  shap_breakdown          JSONB         NOT NULL DEFAULT '{}',
  deducted_at             TIMESTAMPTZ,
  razorpay_payment_id     VARCHAR(100),
  status                  VARCHAR(20)   NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','deducted','failed')),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(worker_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ledger_worker_week ON premium_ledger(worker_id, week_start);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON premium_ledger(status);
CREATE INDEX IF NOT EXISTS idx_ledger_week_start ON premium_ledger(week_start);

-- ─── SafeRider Scores ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saferider_scores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id           UUID NOT NULL UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
  tier                SMALLINT NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  consecutive_weeks   INT      NOT NULL DEFAULT 0,
  total_weeks         INT      NOT NULL DEFAULT 0,
  fraud_flags         INT      NOT NULL DEFAULT 0,
  last_tier_change    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saferider_worker_id ON saferider_scores(worker_id);
CREATE INDEX IF NOT EXISTS idx_saferider_tier ON saferider_scores(tier);

-- ─── Dost Squads ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dost_squads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(200) NOT NULL,
  dark_store_h3       VARCHAR(20)  NOT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','disbanded')),
  zero_claim_streak   INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squads_dark_store ON dost_squads(dark_store_h3);
CREATE INDEX IF NOT EXISTS idx_squads_status ON dost_squads(status);

-- ─── Dost Squad Members ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dost_squad_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  squad_id    UUID NOT NULL REFERENCES dost_squads(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(squad_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_worker ON dost_squad_members(worker_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON dost_squad_members(squad_id);

-- ─── Payouts ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  type                    VARCHAR(20) NOT NULL CHECK (type IN ('claim','cashback','refund')),
  amount                  NUMERIC(10,2) NOT NULL,
  upi_id                  VARCHAR(100) NOT NULL,
  razorpay_payout_id      VARCHAR(100) UNIQUE,
  razorpay_fund_account_id VARCHAR(100),
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','completed','failed')),
  idempotency_key         VARCHAR(200) NOT NULL UNIQUE,
  reference_id            VARCHAR(200),
  failure_reason          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_worker_id ON payouts(worker_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_razorpay_id ON payouts(razorpay_payout_id);
CREATE INDEX IF NOT EXISTS idx_payouts_idempotency ON payouts(idempotency_key);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['workers','policies','dost_squads','payouts']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
      CREATE TRIGGER trg_updated_at_%1$s
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', tbl);
  END LOOP;
END;
$$;