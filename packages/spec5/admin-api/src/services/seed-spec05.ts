import { randomUUID } from 'node:crypto';
import { withTransaction } from '../db';

const STATUSES = [
  'AUTO_APPROVE',
  'SOFT_HOLD',
  'STEP_UP',
  'MANUAL_REVIEW',
  'REJECTED',
  'FNOL_SUBMITTED',
] as const;

const toClaimStatus = (bucket: (typeof STATUSES)[number]): string => {
  if (bucket === 'AUTO_APPROVE') return 'APPROVED';
  if (bucket === 'SOFT_HOLD') return 'SOFT_HOLD';
  if (bucket === 'STEP_UP') return 'STEP_UP';
  if (bucket === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
  if (bucket === 'FNOL_SUBMITTED') return 'FNOL_SUBMITTED';
  return 'REJECTED';
};

export const seedSpec05Claims = async (): Promise<void> => {
  await withTransaction(async (client) => {
    await client.query(`
      DELETE FROM admin_llm_reviews
      WHERE claim_id IN (
        SELECT id FROM claims WHERE error_reason = 'SPEC5_SEED'
      )
    `);

    await client.query(`
      DELETE FROM admin_claim_decisions
      WHERE claim_id IN (
        SELECT id FROM claims WHERE error_reason = 'SPEC5_SEED'
      )
    `);

    await client.query(`
      DELETE FROM claim_manual_review
      WHERE claim_id IN (
        SELECT id FROM claims WHERE error_reason = 'SPEC5_SEED'
      )
    `);

    await client.query(`
      DELETE FROM claims
      WHERE error_reason = 'SPEC5_SEED'
    `);

    const policies = await client.query<{
      policy_id: string;
      worker_id: string;
      h3_zone: string;
      daily_wage_inr: number;
    }>(`
      SELECT policy_id, worker_id, h3_zone, daily_wage_inr::float8
      FROM active_policies
      WHERE status = 'ACTIVE'
      ORDER BY policy_id
      LIMIT 20
    `);

    if (policies.rows.length === 0) {
      throw new Error('No active policies found. Run shared seed first.');
    }

    for (let i = 0; i < 20; i += 1) {
      const policy = policies.rows[i % policies.rows.length];
      const bucket = STATUSES[i % STATUSES.length];
      const claimStatus = toClaimStatus(bucket);
      const fraudScore = Number((0.15 + ((i % 9) * 0.09)).toFixed(2));
      const payoutPct = i % 3 === 0 ? 100 : i % 3 === 1 ? 75 : 50;
      const claimCreatedAt = new Date(Date.now() - i * 3_600_000);

      const claimInsert = await client.query<{ id: string }>(
        `
          INSERT INTO claims (
            event_id,
            policy_id,
            worker_id,
            h3_zone,
            trigger_type,
            severity,
            payout_pct,
            fraud_score,
            fraud_latency_ms,
            rba_outcome,
            fraud_detail,
            status,
            guidewire_status,
            error_reason,
            created_at,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            'PARTIAL',
            $6,
            $7,
            $8,
            $9,
            $10::jsonb,
            $11,
            $12,
            'SPEC5_SEED',
            $13::timestamptz,
            $13::timestamptz + interval '8 minutes'
          )
          RETURNING id::text
        `,
        [
          randomUUID(),
          policy.policy_id,
          policy.worker_id,
          policy.h3_zone,
          i % 2 === 0 ? 'RAIN' : 'AQI',
          payoutPct,
          fraudScore,
          22 + (i % 10) * 7,
          bucket === 'REJECTED'
            ? 'REJECT'
            : bucket === 'SOFT_HOLD'
              ? 'SOFT_HOLD'
              : bucket === 'STEP_UP' || bucket === 'MANUAL_REVIEW'
                ? 'STEP_UP'
                : 'AUTO_APPROVE',
          JSON.stringify({
            claim_id: randomUUID(),
            fraud_score: fraudScore,
            rba_outcome:
              bucket === 'REJECTED'
                ? 'REJECT'
                : bucket === 'SOFT_HOLD'
                  ? 'SOFT_HOLD'
                  : bucket === 'STEP_UP' || bucket === 'MANUAL_REVIEW'
                    ? 'STEP_UP'
                    : 'AUTO_APPROVE',
            shap_values: {
              route_vector_linearity: 0.31,
              gnss_cn0_agc_anomaly: 0.26,
              claim_burst_rank: 0.12,
              mock_location_flag: bucket === 'REJECTED' ? 0.4 : 0.03,
            },
            feature_vector: {
              accelerometer_variance: bucket === 'REJECTED' ? 0.05 : 0.33,
              gnss_cn0_agc_anomaly: bucket === 'REJECTED' ? 1 : 0,
              route_vector_linearity: bucket === 'REJECTED' ? 0.92 : 0.24,
              gnss_ntp_time_delta: bucket === 'REJECTED' ? 9 : 0.8,
              device_proximity_graph_degree: bucket === 'REJECTED' ? 4 : 1,
              mock_location_flag: bucket === 'REJECTED' ? 1 : 0,
            },
            layer_outcomes: {
              mock_check: bucket === 'REJECTED' ? 'FAIL' : 'PASS',
              geo_validation: 'PASS',
              dedup: 'PASS',
              source_consensus: 'PASS',
              isolation_forest: fraudScore,
              syndicate_graph: bucket === 'REJECTED' ? 'DEGREE_4' : 'DEGREE_1',
            },
          }),
          claimStatus,
          claimStatus === 'FNOL_SUBMITTED' ? 'DRAFT' : null,
          claimCreatedAt.toISOString(),
        ],
      );

      const claimId = claimInsert.rows[0]?.id;
      if (!claimId) continue;

      if (claimStatus === 'MANUAL_REVIEW' || claimStatus === 'STEP_UP') {
        await client.query(
          `
            INSERT INTO claim_manual_review (claim_id, reason, created_at)
            VALUES ($1::uuid, $2, now())
            ON CONFLICT (claim_id) DO UPDATE
            SET reason = EXCLUDED.reason,
                created_at = EXCLUDED.created_at,
                resolved = FALSE,
                resolved_at = NULL,
                resolved_by = NULL
          `,
          [claimId, 'SPEC5 seeded manual review case'],
        );
      }
    }
  });
};
