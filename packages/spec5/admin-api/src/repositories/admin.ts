import { query, withTransaction } from '../db';
import { ManualReviewClaimRow } from '../types';

interface KpiRow {
  active_policies: number;
  claims_this_week: number;
  auto_approval_rate_pct: number;
  manual_review_queue_depth: number;
  revenue_this_week_inr: number;
  avg_claim_to_payout_latency_ms: number;
}

interface ZoneAggregateRow {
  h3_index: string;
  city: string;
  lat: number;
  lng: number;
  active_policies: number;
  claims_week: number;
  payout_loss_inr: number;
  premium_week_inr: number;
  fraud_flag_count: number;
}

interface TriggerHistoryRow {
  h3_zone: string;
  trigger_type: string;
  total: number;
}

interface LlmContextBaseRow {
  claim_id: string;
  worker_id: string;
  policy_id: string;
  h3_zone: string;
  city: string | null;
  trigger_type: string;
  claim_timestamp: string;
  fraud_score: number | null;
  rba_outcome: string | null;
  saferider_tier: number | null;
  fraud_detail: Record<string, unknown> | null;
}

interface WorkerHistoryRow {
  weeks_active: number;
  prior_fraud_rejections: number;
}

interface ZoneRatioRow {
  loss_ratio_pct: number;
}

const buildStatusFilter = (statuses: string[] | undefined): { clause: string; values: unknown[] } => {
  if (!statuses || statuses.length === 0) {
    return { clause: '', values: [] };
  }

  return {
    clause: 'AND c.status = ANY($1::text[])',
    values: [statuses],
  };
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const initializeAdminTables = async (): Promise<void> => {
  await query(`
    CREATE TABLE IF NOT EXISTS admin_llm_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL REFERENCES claims(id),
      prompt TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      response_json JSONB,
      recommendation TEXT,
      confidence TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_claim_decisions (
      claim_id UUID PRIMARY KEY REFERENCES claims(id),
      decision TEXT NOT NULL,
      reason TEXT,
      decided_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
};

export const getDashboardKpis = async (): Promise<KpiRow> => {
  const result = await query<KpiRow>(`
    WITH claims_week AS (
      SELECT *
      FROM claims
      WHERE created_at >= date_trunc('week', now())
    )
    SELECT
      (SELECT COUNT(*)::int FROM active_policies WHERE status = 'ACTIVE') AS active_policies,
      (SELECT COUNT(*)::int FROM claims_week) AS claims_this_week,
      (
        SELECT COALESCE(
          ROUND(
            100.0 * SUM(CASE WHEN rba_outcome = 'AUTO_APPROVE' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0),
            2
          ),
          0
        )::float8
        FROM claims_week
      ) AS auto_approval_rate_pct,
      (
        SELECT COUNT(*)::int
        FROM claims
        WHERE status IN ('STEP_UP', 'MANUAL_REVIEW', 'SOFT_HOLD')
      ) AS manual_review_queue_depth,
      (
        SELECT COALESCE(
          SUM(LEAST(GREATEST((daily_wage_inr::float8 * 7 * 0.02), 49), 99)),
          0
        )::float8
        FROM active_policies
        WHERE status = 'ACTIVE'
      ) AS revenue_this_week_inr,
      (
        SELECT COALESCE(
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000),
          0
        )::float8
        FROM claims
        WHERE status IN ('FNOL_SUBMITTED', 'PAYOUT_QUEUED')
      ) AS avg_claim_to_payout_latency_ms
  `);

  return result.rows[0] ?? {
    active_policies: 0,
    claims_this_week: 0,
    auto_approval_rate_pct: 0,
    manual_review_queue_depth: 0,
    revenue_this_week_inr: 0,
    avg_claim_to_payout_latency_ms: 0,
  };
};

export const getClaims = async (limit: number, statuses?: string[]): Promise<ManualReviewClaimRow[]> => {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { clause, values } = buildStatusFilter(statuses);

  const limitPlaceholder = values.length + 1;
  const result = await query<ManualReviewClaimRow>(
    `
      SELECT
        c.id::text,
        c.policy_id,
        c.worker_id,
        c.h3_zone,
        c.trigger_type,
        c.payout_pct::float8,
        c.fraud_score::float8,
        c.rba_outcome,
        c.status,
        c.created_at::text,
        c.updated_at::text,
        c.guidewire_status,
        c.guidewire_claim_id,
        c.error_reason,
        w.name AS worker_name,
        z.city,
        p.saferider_tier,
        p.daily_wage_inr::float8,
        c.fraud_detail,
        d.decision,
        d.reason AS decision_reason,
        d.decided_by AS decision_by,
        d.updated_at::text AS decision_at
      FROM claims c
      LEFT JOIN workers w ON w.worker_id = c.worker_id
      LEFT JOIN active_policies p ON p.policy_id = c.policy_id
      LEFT JOIN active_zones z ON z.h3_index = c.h3_zone
      LEFT JOIN admin_claim_decisions d ON d.claim_id = c.id
      WHERE 1 = 1
      ${clause}
      ORDER BY c.created_at DESC
      LIMIT $${limitPlaceholder}::int
    `,
    [...values, safeLimit],
  );

  return result.rows;
};

export const getClaimById = async (claimId: string): Promise<ManualReviewClaimRow | null> => {
  const result = await query<ManualReviewClaimRow>(
    `
      SELECT
        c.id::text,
        c.policy_id,
        c.worker_id,
        c.h3_zone,
        c.trigger_type,
        c.payout_pct::float8,
        c.fraud_score::float8,
        c.rba_outcome,
        c.status,
        c.created_at::text,
        c.updated_at::text,
        c.guidewire_status,
        c.guidewire_claim_id,
        c.error_reason,
        w.name AS worker_name,
        z.city,
        p.saferider_tier,
        p.daily_wage_inr::float8,
        c.fraud_detail,
        d.decision,
        d.reason AS decision_reason,
        d.decided_by AS decision_by,
        d.updated_at::text AS decision_at
      FROM claims c
      LEFT JOIN workers w ON w.worker_id = c.worker_id
      LEFT JOIN active_policies p ON p.policy_id = c.policy_id
      LEFT JOIN active_zones z ON z.h3_index = c.h3_zone
      LEFT JOIN admin_claim_decisions d ON d.claim_id = c.id
      WHERE c.id = $1::uuid
      LIMIT 1
    `,
    [claimId],
  );

  return result.rows[0] ?? null;
};

export const getHeatmapData = async (): Promise<
  Array<{
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
  }>
> => {
  const zones = await query<ZoneAggregateRow>(`
    WITH policy_premium AS (
      SELECT
        h3_zone,
        COUNT(*)::int AS active_policies,
        SUM(LEAST(GREATEST((daily_wage_inr::float8 * 7 * 0.02), 49), 99))::float8 AS premium_week_inr
      FROM active_policies
      WHERE status = 'ACTIVE'
      GROUP BY h3_zone
    ),
    claims_week AS (
      SELECT
        c.h3_zone,
        COUNT(*)::int AS claims_week,
        SUM(
          CASE
            WHEN c.status IN ('APPROVED', 'FNOL_SUBMITTED', 'PAYOUT_QUEUED')
              THEN (c.payout_pct::float8 / 100.0) * COALESCE(ap.daily_wage_inr::float8, 0)
            ELSE 0
          END
        )::float8 AS payout_loss_inr,
        SUM(
          CASE
            WHEN c.status IN ('MANUAL_REVIEW', 'STEP_UP', 'SOFT_HOLD', 'REJECTED') THEN 1
            ELSE 0
          END
        )::int AS fraud_flag_count
      FROM claims c
      LEFT JOIN active_policies ap ON ap.policy_id = c.policy_id
      WHERE c.created_at >= date_trunc('week', now())
      GROUP BY c.h3_zone
    )
    SELECT
      z.h3_index,
      z.city,
      z.lat::float8,
      z.lng::float8,
      COALESCE(pp.active_policies, 0) AS active_policies,
      COALESCE(cw.claims_week, 0) AS claims_week,
      COALESCE(cw.payout_loss_inr, 0)::float8 AS payout_loss_inr,
      COALESCE(pp.premium_week_inr, 0)::float8 AS premium_week_inr,
      COALESCE(cw.fraud_flag_count, 0) AS fraud_flag_count
    FROM active_zones z
    LEFT JOIN policy_premium pp ON pp.h3_zone = z.h3_index
    LEFT JOIN claims_week cw ON cw.h3_zone = z.h3_index
    ORDER BY z.city
  `);

  const shapRows = await query<{ h3_zone: string; shap_values: Record<string, number> | null }>(`
    SELECT
      h3_zone,
      (fraud_detail -> 'shap_values')::jsonb AS shap_values
    FROM claims
    WHERE created_at >= now() - interval '7 days'
      AND fraud_detail IS NOT NULL
  `);

  const triggerHistory = await query<TriggerHistoryRow>(`
    SELECT
      h3_zone,
      trigger_type,
      COUNT(*)::int AS total
    FROM claims
    WHERE created_at >= now() - interval '7 days'
    GROUP BY h3_zone, trigger_type
  `);

  const signalMap = new Map<string, Map<string, number>>();
  for (const row of shapRows.rows) {
    const shap = toRecord(row.shap_values);
    if (!shap) continue;

    let zoneSignals = signalMap.get(row.h3_zone);
    if (!zoneSignals) {
      zoneSignals = new Map<string, number>();
      signalMap.set(row.h3_zone, zoneSignals);
    }

    for (const [key, value] of Object.entries(shap)) {
      const absValue = Math.abs(Number(value));
      if (!Number.isFinite(absValue)) continue;
      zoneSignals.set(key, (zoneSignals.get(key) ?? 0) + absValue);
    }
  }

  const weatherHistoryMap = new Map<string, string[]>();
  for (const row of triggerHistory.rows) {
    const list = weatherHistoryMap.get(row.h3_zone) ?? [];
    list.push(`${row.trigger_type}: ${row.total}`);
    weatherHistoryMap.set(row.h3_zone, list);
  }

  const toRiskColor = (lossRatio: number): 'green' | 'yellow' | 'orange' | 'red' => {
    if (lossRatio < 60) return 'green';
    if (lossRatio < 90) return 'yellow';
    if (lossRatio <= 120) return 'orange';
    return 'red';
  };

  return zones.rows.map((row) => {
    const claimRatePct = row.active_policies > 0 ? (row.claims_week / row.active_policies) * 100 : 0;
    const lossRatioPct = row.premium_week_inr > 0 ? (row.payout_loss_inr / row.premium_week_inr) * 100 : 0;

    const signalScores = Array.from(signalMap.get(row.h3_index)?.entries() ?? []);
    signalScores.sort((a, b) => b[1] - a[1]);

    return {
      h3_index: row.h3_index,
      city: row.city,
      lat: Number(row.lat),
      lng: Number(row.lng),
      active_policies: Number(row.active_policies),
      claim_rate_pct: Number(claimRatePct.toFixed(2)),
      loss_ratio_pct: Number(lossRatioPct.toFixed(2)),
      top_fraud_signals: signalScores.slice(0, 3).map(([signal]) => signal),
      risk_color: toRiskColor(lossRatioPct),
      fraud_flag_count: Number(row.fraud_flag_count),
      weather_history: weatherHistoryMap.get(row.h3_index) ?? [],
    };
  });
};

export const getFraudLayerStats = async (): Promise<
  Array<{
    layer: string;
    total_claims_processed: number;
    pass_rate_pct: number;
    reject_rate_pct: number;
    avg_latency_ms: number;
  }>
> => {
  const result = await query<{
    fraud_detail: Record<string, unknown> | null;
    fraud_latency_ms: number | null;
    fraud_score: number | null;
  }>(`
    SELECT fraud_detail, fraud_latency_ms, fraud_score::float8
    FROM claims
    WHERE fraud_detail IS NOT NULL
      AND created_at >= now() - interval '30 days'
    ORDER BY created_at DESC
    LIMIT 2000
  `);

  const layers = [
    'mock_check',
    'geo_validation',
    'dedup',
    'source_consensus',
    'isolation_forest',
    'syndicate_graph',
  ] as const;

  const stats = new Map<
    string,
    {
      total: number;
      passed: number;
      failed: number;
      latencyTotal: number;
    }
  >();

  for (const layer of layers) {
    stats.set(layer, { total: 0, passed: 0, failed: 0, latencyTotal: 0 });
  }

  for (const row of result.rows) {
    const detail = toRecord(row.fraud_detail);
    const layerOutcomes = toRecord(detail?.layer_outcomes);
    if (!layerOutcomes) continue;

    for (const layer of layers) {
      const current = stats.get(layer);
      if (!current) continue;

      current.total += 1;
      current.latencyTotal += Number(row.fraud_latency_ms ?? 0);

      const value = layerOutcomes[layer];
      let passed = false;

      if (layer === 'isolation_forest') {
        passed = Number(row.fraud_score ?? 1) < 0.4;
      } else if (layer === 'syndicate_graph') {
        const degreeRaw = typeof value === 'string' ? value.replace('DEGREE_', '') : '99';
        const degree = Number(degreeRaw);
        passed = Number.isFinite(degree) && degree <= 2;
      } else {
        passed = String(value) === 'PASS';
      }

      if (passed) current.passed += 1;
      else current.failed += 1;
    }
  }

  return layers.map((layer) => {
    const layerStats = stats.get(layer) ?? { total: 0, passed: 0, failed: 0, latencyTotal: 0 };
    const passRate = layerStats.total > 0 ? (layerStats.passed / layerStats.total) * 100 : 0;
    const rejectRate = layerStats.total > 0 ? (layerStats.failed / layerStats.total) * 100 : 0;

    return {
      layer,
      total_claims_processed: layerStats.total,
      pass_rate_pct: Number(passRate.toFixed(2)),
      reject_rate_pct: Number(rejectRate.toFixed(2)),
      avg_latency_ms: Number(
        (layerStats.total > 0 ? layerStats.latencyTotal / layerStats.total : 0).toFixed(2),
      ),
    };
  });
};

export const getFraudRings = async (): Promise<
  Array<{
    bssid_hash: string;
    worker_ids: string[];
    claim_ids: string[];
    worker_count: number;
    last_seen_at: string;
  }>
> => {
  const result = await query<{
    bssid_hash: string;
    worker_ids: string[];
    claim_ids: string[];
    worker_count: number;
    last_seen_at: string;
  }>(`
    SELECT
      cb.bssid_hash,
      ARRAY_AGG(DISTINCT c.worker_id) AS worker_ids,
      ARRAY_AGG(DISTINCT c.id::text) AS claim_ids,
      COUNT(DISTINCT c.worker_id)::int AS worker_count,
      MAX(cb.claimed_at)::text AS last_seen_at
    FROM claim_bssids cb
    JOIN claims c ON c.id = cb.claim_id
    WHERE cb.claimed_at > now() - interval '1 hour'
    GROUP BY cb.bssid_hash
    HAVING COUNT(DISTINCT c.worker_id) >= 3
    ORDER BY MAX(cb.claimed_at) DESC
  `);

  return result.rows;
};

export interface LlmPromptContext {
  claim_id: string;
  worker_id: string;
  tier: number;
  weeks_active: number;
  prior_fraud_claims: number;
  h3_zone: string;
  city: string;
  zone_loss_ratio: number;
  trigger_type: string;
  timestamp: string;
  fraud_score: number;
  rba_outcome: string;
  shap_values: Record<string, number>;
  layer_outcomes: Record<string, string | number>;
  feature_vector: Record<string, number | string | boolean>;
}

export const getLlmPromptContext = async (claimId: string): Promise<LlmPromptContext | null> => {
  const claimResult = await query<LlmContextBaseRow>(
    `
      SELECT
        c.id::text AS claim_id,
        c.worker_id,
        c.policy_id,
        c.h3_zone,
        z.city,
        c.trigger_type,
        c.created_at::text AS claim_timestamp,
        c.fraud_score::float8,
        c.rba_outcome,
        p.saferider_tier,
        c.fraud_detail
      FROM claims c
      LEFT JOIN active_policies p ON p.policy_id = c.policy_id
      LEFT JOIN active_zones z ON z.h3_index = c.h3_zone
      WHERE c.id = $1::uuid
      LIMIT 1
    `,
    [claimId],
  );

  const claim = claimResult.rows[0];
  if (!claim) return null;

  const workerHistory = await query<WorkerHistoryRow>(
    `
      SELECT
        COALESCE(
          CEIL(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 604800)::int,
          1
        ) AS weeks_active,
        COUNT(*) FILTER (
          WHERE status = 'REJECTED'
        )::int AS prior_fraud_rejections
      FROM claims
      WHERE worker_id = $1
    `,
    [claim.worker_id],
  );

  const zoneRatio = await query<ZoneRatioRow>(
    `
      WITH premium AS (
        SELECT
          SUM(LEAST(GREATEST((daily_wage_inr::float8 * 7 * 0.02), 49), 99))::float8 AS premium_week
        FROM active_policies
        WHERE h3_zone = $1
          AND status = 'ACTIVE'
      ),
      losses AS (
        SELECT
          SUM(
            CASE
              WHEN c.status IN ('APPROVED', 'FNOL_SUBMITTED', 'PAYOUT_QUEUED')
                THEN (c.payout_pct::float8 / 100.0) * COALESCE(ap.daily_wage_inr::float8, 0)
              ELSE 0
            END
          )::float8 AS loss_week
        FROM claims c
        LEFT JOIN active_policies ap ON ap.policy_id = c.policy_id
        WHERE c.h3_zone = $1
          AND c.created_at >= date_trunc('week', now())
      )
      SELECT COALESCE((losses.loss_week / NULLIF(premium.premium_week, 0)) * 100, 0)::float8 AS loss_ratio_pct
      FROM premium, losses
    `,
    [claim.h3_zone],
  );

  const fraudDetail = toRecord(claim.fraud_detail) ?? {};
  const shapValuesRaw = toRecord(fraudDetail.shap_values) ?? {};
  const featureVectorRaw = toRecord(fraudDetail.feature_vector) ?? {};
  const layerOutcomesRaw = toRecord(fraudDetail.layer_outcomes) ?? {};

  const shapValues: Record<string, number> = {};
  for (const [key, value] of Object.entries(shapValuesRaw)) {
    const num = Number(value);
    if (Number.isFinite(num)) shapValues[key] = num;
  }

  const featureVector: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(featureVectorRaw)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      featureVector[key] = value;
    }
  }

  const layerOutcomes: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(layerOutcomesRaw)) {
    if (typeof value === 'number' || typeof value === 'string') {
      layerOutcomes[key] = value;
    }
  }

  return {
    claim_id: claim.claim_id,
    worker_id: claim.worker_id,
    tier: Number(claim.saferider_tier ?? 1),
    weeks_active: Number(workerHistory.rows[0]?.weeks_active ?? 1),
    prior_fraud_claims: Number(workerHistory.rows[0]?.prior_fraud_rejections ?? 0),
    h3_zone: claim.h3_zone,
    city: claim.city ?? 'Unknown',
    zone_loss_ratio: Number((zoneRatio.rows[0]?.loss_ratio_pct ?? 0).toFixed(2)),
    trigger_type: claim.trigger_type,
    timestamp: claim.claim_timestamp,
    fraud_score: Number(claim.fraud_score ?? 0),
    rba_outcome: claim.rba_outcome ?? 'UNKNOWN',
    shap_values: shapValues,
    layer_outcomes: layerOutcomes,
    feature_vector: featureVector,
  };
};

export const saveLlmReview = async (input: {
  claimId: string;
  prompt: string;
  provider: string;
  model: string;
  responseJson: Record<string, unknown> | null;
  recommendation?: string;
  confidence?: string;
}): Promise<void> => {
  await query(
    `
      INSERT INTO admin_llm_reviews (
        claim_id,
        prompt,
        provider,
        model,
        response_json,
        recommendation,
        confidence
      )
      VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)
    `,
    [
      input.claimId,
      input.prompt,
      input.provider,
      input.model,
      input.responseJson ? JSON.stringify(input.responseJson) : null,
      input.recommendation ?? null,
      input.confidence ?? null,
    ],
  );
};

export const getLatestLlmReview = async (claimId: string): Promise<Record<string, unknown> | null> => {
  const result = await query<{
    prompt: string;
    provider: string;
    model: string;
    response_json: Record<string, unknown> | null;
    recommendation: string | null;
    confidence: string | null;
    created_at: string;
  }>(
    `
      SELECT
        prompt,
        provider,
        model,
        response_json,
        recommendation,
        confidence,
        created_at::text
      FROM admin_llm_reviews
      WHERE claim_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [claimId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    response_json: row.response_json,
    recommendation: row.recommendation,
    confidence: row.confidence,
    created_at: row.created_at,
  };
};

const decisionToClaimStatus = (decision: string): string => {
  if (decision === 'APPROVE') return 'APPROVED';
  if (decision === 'REJECT') return 'REJECTED';
  return 'MANUAL_REVIEW';
};

export const saveAdminDecision = async (input: {
  claimId: string;
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO';
  reason: string;
  adminUser: string;
}): Promise<void> => {
  await withTransaction(async (client) => {
    const nextStatus = decisionToClaimStatus(input.decision);

    await client.query(
      `
        UPDATE claims
        SET status = $2,
            error_reason = CASE
              WHEN $3::text = '' THEN error_reason
              ELSE $3::text
            END,
            updated_at = now()
        WHERE id = $1::uuid
      `,
      [input.claimId, nextStatus, input.reason],
    );

    await client.query(
      `
        INSERT INTO admin_claim_decisions (claim_id, decision, reason, decided_by)
        VALUES ($1::uuid, $2, $3, $4)
        ON CONFLICT (claim_id)
        DO UPDATE SET
          decision = EXCLUDED.decision,
          reason = EXCLUDED.reason,
          decided_by = EXCLUDED.decided_by,
          updated_at = now()
      `,
      [input.claimId, input.decision, input.reason, input.adminUser],
    );

    await client.query(
      `
        UPDATE claim_manual_review
        SET
          resolved = CASE WHEN $2 IN ('APPROVE', 'REJECT') THEN TRUE ELSE FALSE END,
          resolved_at = CASE WHEN $2 IN ('APPROVE', 'REJECT') THEN now() ELSE NULL END,
          resolved_by = CASE WHEN $2 IN ('APPROVE', 'REJECT') THEN $3 ELSE NULL END
        WHERE claim_id = $1::uuid
      `,
      [input.claimId, input.decision, input.adminUser],
    );
  });
};
