import { query } from '../db';
import { ClaimRow, ClaimStatus, DisruptionEvent } from '../types';

export interface CreateClaimInput {
  event: DisruptionEvent;
  policy_id: string;
  worker_id: string;
  fraud_score?: number;
}

export const createClaim = async (input: CreateClaimInput): Promise<ClaimRow | null> => {
  const result = await query<ClaimRow>(
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
        status,
        guidewire_status
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, 'PENDING_FRAUD_CHECK', NULL)
      ON CONFLICT (policy_id, event_id) DO NOTHING
      RETURNING
        id::text,
        event_id::text,
        policy_id,
        worker_id,
        h3_zone,
        trigger_type,
        severity,
        payout_pct::float8,
        fraud_score::float8,
        status,
        guidewire_status,
        guidewire_claim_id,
        created_at::text,
        updated_at::text
    `,
    [
      input.event.event_id,
      input.policy_id,
      input.worker_id,
      input.event.zone_h3,
      input.event.trigger_type,
      input.event.severity,
      input.event.payout_pct,
      input.fraud_score ?? null,
    ],
  );

  return result.rows[0] ?? null;
};

export const updateClaimStatus = async (
  claimId: string,
  status: ClaimStatus,
  options?: {
    fraudScore?: number;
    guidewireStatus?: string;
    guidewireClaimId?: string;
    errorReason?: string | null;
  },
): Promise<void> => {
  await query(
    `
      UPDATE claims
      SET status = $2,
          fraud_score = COALESCE($3, fraud_score),
          guidewire_status = COALESCE($4, guidewire_status),
          guidewire_claim_id = COALESCE($5, guidewire_claim_id),
          error_reason = COALESCE($6, error_reason),
          updated_at = now()
      WHERE id = $1::uuid
    `,
    [
      claimId,
      status,
      typeof options?.fraudScore === 'number' ? options.fraudScore : null,
      options?.guidewireStatus ?? null,
      options?.guidewireClaimId ?? null,
      options?.errorReason ?? null,
    ],
  );
};

export const addManualReviewEntry = async (claimId: string, reason: string): Promise<void> => {
  await query(
    `
      INSERT INTO claim_manual_review (claim_id, reason)
      VALUES ($1::uuid, $2)
      ON CONFLICT (claim_id) DO UPDATE
        SET reason = EXCLUDED.reason,
            created_at = now()
    `,
    [claimId, reason],
  );
};

export const getClaimById = async (claimId: string): Promise<ClaimRow | null> => {
  const result = await query<ClaimRow>(
    `
      SELECT
        id::text,
        event_id::text,
        policy_id,
        worker_id,
        h3_zone,
        trigger_type,
        severity,
        payout_pct::float8,
        fraud_score::float8,
        status,
        guidewire_status,
        guidewire_claim_id,
        created_at::text,
        updated_at::text
      FROM claims
      WHERE id = $1::uuid
    `,
    [claimId],
  );
  return result.rows[0] ?? null;
};

export const getClaimsByWorker = async (workerId: string): Promise<ClaimRow[]> => {
  const result = await query<ClaimRow>(
    `
      SELECT
        id::text,
        event_id::text,
        policy_id,
        worker_id,
        h3_zone,
        trigger_type,
        severity,
        payout_pct::float8,
        fraud_score::float8,
        status,
        guidewire_status,
        guidewire_claim_id,
        created_at::text,
        updated_at::text
      FROM claims
      WHERE worker_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [workerId],
  );
  return result.rows;
};
