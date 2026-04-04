import { Pool, PoolClient, QueryResult } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import {
  Worker, Policy, PremiumLedger, SafeRiderScore,
  DostSquad, DostSquadMember, Payout,
  ShapBreakdown, PayoutStatus, PayoutType, SafeRiderTier
} from '../types';

// ─── Pool ─────────────────────────────────────────────────────────────────────

export const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'kawaachai',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('PG pool error', { err }));

// FIX: pg does not execute multiple statements in one pool.query() call.
// Read the SQL file and split on semicolons, executing each statement individually.
export async function initSchema(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

  // Split on semicolons, remove empty/whitespace-only segments
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query('COMMIT');
    logger.info('Database schema initialised', { statements: statements.length });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Schema initialisation failed', { err: (err as Error).message });
    throw err;
  } finally {
    client.release();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Workers ──────────────────────────────────────────────────────────────────

export async function getWorkerById(id: string): Promise<Worker | null> {
  const r = await query<Worker>('SELECT * FROM workers WHERE id = $1', [id]);
  return r.rows[0] || null;
}

export async function getWorkerByPlatformId(platformWorkerId: string, platform: string): Promise<Worker | null> {
  const r = await query<Worker>(
    'SELECT * FROM workers WHERE platform_worker_id = $1 AND platform = $2',
    [platformWorkerId, platform]
  );
  return r.rows[0] || null;
}

export async function getActiveWorkersWithPolicy(): Promise<Array<Worker & { policy_id: string; weekly_premium: number }>> {
  const r = await query<Worker & { policy_id: string; weekly_premium: number }>(`
    SELECT w.*, p.id as policy_id, p.weekly_premium
    FROM workers w
    JOIN policies p ON p.worker_id = w.id
    WHERE p.status = 'active'
      AND w.mandate_status = 'active'
  `);
  return r.rows;
}

export async function updateWorkerMandate(
  workerId: string,
  mandateId: string,
  status: string,
  customerId?: string
): Promise<void> {
  await query(
    `UPDATE workers
     SET razorpay_mandate_id = $1,
         mandate_status = $2,
         razorpay_customer_id = COALESCE($3, razorpay_customer_id),
         updated_at = NOW()
     WHERE id = $4`,
    [mandateId, status, customerId || null, workerId]
  );
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export async function getActivePolicyByWorkerId(workerId: string): Promise<Policy | null> {
  const r = await query<Policy>(
    `SELECT * FROM policies WHERE worker_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [workerId]
  );
  return r.rows[0] || null;
}

export async function createPolicy(
  workerId: string,
  weeklyPremium: number,
  guidewirePolicyId?: string
): Promise<Policy> {
  const r = await query<Policy>(
    `INSERT INTO policies (worker_id, weekly_premium, guidewire_policy_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [workerId, weeklyPremium, guidewirePolicyId || null]
  );
  return r.rows[0];
}

// ─── Premium Ledger ───────────────────────────────────────────────────────────

export async function upsertPremiumLedger(
  workerId: string,
  policyId: string,
  weekStart: Date,
  basePremium: number,
  zoneMultiplier: number,
  saferiderDiscountPct: number,
  dostFlatDiscount: number,
  finalPremium: number,
  shapBreakdown: ShapBreakdown
): Promise<PremiumLedger> {
  const r = await query<PremiumLedger>(`
    INSERT INTO premium_ledger
      (worker_id, policy_id, week_start, base_premium, zone_multiplier,
       saferider_discount_pct, dost_flat_discount, final_premium, shap_breakdown)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (worker_id, week_start) DO UPDATE SET
      base_premium = EXCLUDED.base_premium,
      zone_multiplier = EXCLUDED.zone_multiplier,
      saferider_discount_pct = EXCLUDED.saferider_discount_pct,
      dost_flat_discount = EXCLUDED.dost_flat_discount,
      final_premium = EXCLUDED.final_premium,
      shap_breakdown = EXCLUDED.shap_breakdown
    RETURNING *
  `, [workerId, policyId, weekStart, basePremium, zoneMultiplier,
      saferiderDiscountPct, dostFlatDiscount, finalPremium, JSON.stringify(shapBreakdown)]);
  return r.rows[0];
}

export async function getPendingLedgerForWeek(weekStart: Date): Promise<PremiumLedger[]> {
  const r = await query<PremiumLedger>(
    `SELECT * FROM premium_ledger WHERE week_start = $1 AND status = 'pending'`,
    [weekStart]
  );
  return r.rows;
}

export async function markLedgerDeducted(
  ledgerId: string,
  razorpayPaymentId: string
): Promise<void> {
  await query(
    `UPDATE premium_ledger SET status = 'deducted', deducted_at = NOW(), razorpay_payment_id = $1 WHERE id = $2`,
    [razorpayPaymentId, ledgerId]
  );
}

export async function markLedgerFailed(ledgerId: string): Promise<void> {
  await query(`UPDATE premium_ledger SET status = 'failed' WHERE id = $1`, [ledgerId]);
}

// ─── SafeRider ────────────────────────────────────────────────────────────────

export async function getSafeRiderScore(workerId: string): Promise<SafeRiderScore | null> {
  const r = await query<SafeRiderScore>(
    'SELECT * FROM saferider_scores WHERE worker_id = $1',
    [workerId]
  );
  return r.rows[0] || null;
}

export async function upsertSafeRiderScore(
  workerId: string,
  tier: SafeRiderTier,
  consecutiveWeeks: number,
  totalWeeks: number,
  fraudFlags: number
): Promise<SafeRiderScore> {
  const r = await query<SafeRiderScore>(`
    INSERT INTO saferider_scores (worker_id, tier, consecutive_weeks, total_weeks, fraud_flags, last_tier_change)
    VALUES ($1,$2,$3,$4,$5,NOW())
    ON CONFLICT (worker_id) DO UPDATE SET
      tier = EXCLUDED.tier,
      consecutive_weeks = EXCLUDED.consecutive_weeks,
      total_weeks = EXCLUDED.total_weeks,
      fraud_flags = EXCLUDED.fraud_flags,
      last_tier_change = CASE WHEN saferider_scores.tier != EXCLUDED.tier THEN NOW() ELSE saferider_scores.last_tier_change END,
      updated_at = NOW()
    RETURNING *
  `, [workerId, tier, consecutiveWeeks, totalWeeks, fraudFlags]);
  return r.rows[0];
}

export async function flagWorkerFraud(workerId: string): Promise<SafeRiderScore> {
  const r = await query<SafeRiderScore>(`
    UPDATE saferider_scores
    SET fraud_flags = fraud_flags + 1,
        consecutive_weeks = 0,
        tier = GREATEST(1, tier - 1),
        last_tier_change = NOW(),
        updated_at = NOW()
    WHERE worker_id = $1
    RETURNING *
  `, [workerId]);
  if (!r.rows[0]) throw new Error(`SafeRider score not found for worker ${workerId}`);
  return r.rows[0];
}

// ─── Dost Squad ───────────────────────────────────────────────────────────────

export async function createSquad(
  name: string,
  darkStoreH3: string,
  memberWorkerIds: string[]
): Promise<DostSquad> {
  return withTransaction(async (client) => {
    const squadRes = await client.query<DostSquad>(
      `INSERT INTO dost_squads (name, dark_store_h3) VALUES ($1,$2) RETURNING *`,
      [name, darkStoreH3]
    );
    const squad = squadRes.rows[0];
    for (const wid of memberWorkerIds) {
      await client.query(
        `INSERT INTO dost_squad_members (squad_id, worker_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [squad.id, wid]
      );
    }
    return squad;
  });
}

export async function getSquadById(squadId: string): Promise<DostSquad | null> {
  const r = await query<DostSquad>('SELECT * FROM dost_squads WHERE id = $1', [squadId]);
  return r.rows[0] || null;
}

export async function getActiveSquadForWorker(workerId: string): Promise<DostSquad | null> {
  const r = await query<DostSquad>(`
    SELECT ds.* FROM dost_squads ds
    JOIN dost_squad_members dsm ON dsm.squad_id = ds.id
    WHERE dsm.worker_id = $1 AND dsm.is_active = TRUE AND ds.status = 'active'
    LIMIT 1
  `, [workerId]);
  return r.rows[0] || null;
}

export async function getSquadMembers(squadId: string): Promise<Array<DostSquadMember & { upi_id: string; daily_wage_est: number }>> {
  const r = await query<DostSquadMember & { upi_id: string; daily_wage_est: number }>(`
    SELECT dsm.*, w.upi_id, w.daily_wage_est
    FROM dost_squad_members dsm
    JOIN workers w ON w.id = dsm.worker_id
    WHERE dsm.squad_id = $1 AND dsm.is_active = TRUE
  `, [squadId]);
  return r.rows;
}

export async function getAllActiveSquads(): Promise<DostSquad[]> {
  const r = await query<DostSquad>(`SELECT * FROM dost_squads WHERE status = 'active'`);
  return r.rows;
}

export async function incrementZeroClaimStreak(squadId: string): Promise<void> {
  await query(
    `UPDATE dost_squads SET zero_claim_streak = zero_claim_streak + 1, updated_at = NOW() WHERE id = $1`,
    [squadId]
  );
}

export async function resetZeroClaimStreak(squadId: string): Promise<void> {
  await query(
    `UPDATE dost_squads SET zero_claim_streak = 0, updated_at = NOW() WHERE id = $1`,
    [squadId]
  );
}

export async function getSquadClaimCountForWeek(squadId: string, weekStart: Date): Promise<number> {
  const r = await query<{ cnt: string }>(`
    SELECT COUNT(*) as cnt FROM payouts p
    JOIN dost_squad_members dsm ON dsm.worker_id = p.worker_id
    WHERE dsm.squad_id = $1
      AND p.type = 'claim'
      AND p.status = 'completed'
      AND p.created_at >= $2
      AND p.created_at < $2::date + interval '7 days'
  `, [squadId, weekStart]);
  return parseInt(r.rows[0]?.cnt || '0');
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export async function createPayout(
  workerId: string,
  type: PayoutType,
  amount: number,
  upiId: string,
  idempotencyKey: string,
  referenceId?: string
): Promise<Payout> {
  const r = await query<Payout>(`
    INSERT INTO payouts (worker_id, type, amount, upi_id, idempotency_key, reference_id)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [workerId, type, amount, upiId, idempotencyKey, referenceId || null]);
  return r.rows[0];
}

export async function getPayoutByIdempotencyKey(key: string): Promise<Payout | null> {
  const r = await query<Payout>(
    'SELECT * FROM payouts WHERE idempotency_key = $1',
    [key]
  );
  return r.rows[0] || null;
}

export async function updatePayoutStatus(
  payoutId: string,
  status: PayoutStatus,
  razorpayPayoutId?: string,
  razorpayFundAccountId?: string,
  failureReason?: string
): Promise<void> {
  await query(`
    UPDATE payouts SET
      status = $1,
      razorpay_payout_id = COALESCE($2, razorpay_payout_id),
      razorpay_fund_account_id = COALESCE($3, razorpay_fund_account_id),
      failure_reason = COALESCE($4, failure_reason),
      updated_at = NOW()
    WHERE id = $5
  `, [status, razorpayPayoutId || null, razorpayFundAccountId || null, failureReason || null, payoutId]);
}

export async function getPayoutByRazorpayId(razorpayPayoutId: string): Promise<Payout | null> {
  const r = await query<Payout>(
    'SELECT * FROM payouts WHERE razorpay_payout_id = $1',
    [razorpayPayoutId]
  );
  return r.rows[0] || null;
}

export async function getPayoutsByWorkerId(workerId: string, limit = 50): Promise<Payout[]> {
  const r = await query<Payout>(
    `SELECT * FROM payouts WHERE worker_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workerId, limit]
  );
  return r.rows;
}

export async function getPayoutsSummary(weekStart?: Date): Promise<{
  total_payouts: number;
  total_amount: number;
  by_type: Record<string, number>;
}> {
  const whereClause = weekStart
    ? `WHERE created_at >= $1 AND created_at < $1::date + interval '7 days'`
    : '';
  const params = weekStart ? [weekStart] : [];

  const r = await query<{ type: string; count: string; total: string }>(
    `SELECT type, COUNT(*) as count, COALESCE(SUM(amount),0) as total
     FROM payouts
     WHERE status = 'completed'
     ${weekStart ? "AND created_at >= $1 AND created_at < $1::date + interval '7 days'" : ''}
     GROUP BY type`,
    params
  );

  const byType: Record<string, number> = {};
  let totalPayouts = 0;
  let totalAmount = 0;

  for (const row of r.rows) {
    byType[row.type] = parseFloat(row.total);
    totalPayouts += parseInt(row.count);
    totalAmount += parseFloat(row.total);
  }

  return { total_payouts: totalPayouts, total_amount: totalAmount, by_type: byType };
}