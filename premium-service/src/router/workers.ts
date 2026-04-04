import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getWorkerById, getActivePolicyByWorkerId, getSafeRiderScore,
  getActiveSquadForWorker, updateWorkerMandate, createPolicy,
  pool
} from '../db/queries';
import { calculatePremium } from '../services/premiumEngine';
import { initSafeRiderScore, getFraudThreshold, onFraudFlag } from '../services/saferider';
import { createUpiMandate } from '../services/razorpay';

const router = Router();

// ─── POST /workers — Onboard a new worker ────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const {
    platform_worker_id, platform, name, phone,
    upi_id, h3_zone, daily_wage_est
  } = req.body;

  if (!platform_worker_id || !platform || !name || !phone || !upi_id || !h3_zone) {
    return res.status(400).json({ error: 'Missing required fields: platform_worker_id, platform, name, phone, upi_id, h3_zone' });
  }

  if (!['zepto', 'blinkit'].includes(platform)) {
    return res.status(400).json({ error: 'Platform must be zepto or blinkit' });
  }

  if (daily_wage_est !== undefined && (daily_wage_est < 200 || daily_wage_est > 1500)) {
    return res.status(400).json({ error: 'daily_wage_est must be between 200 and 1500' });
  }

  try {
    const workerRes = await pool.query(
      `INSERT INTO workers (platform_worker_id, platform, name, phone, upi_id, h3_zone, daily_wage_est)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (phone) DO UPDATE SET upi_id=$5, h3_zone=$6, updated_at=NOW()
       RETURNING *`,
      [platform_worker_id, platform, name, phone, upi_id, h3_zone, daily_wage_est || 400]
    );
    const worker = workerRes.rows[0];

    await initSafeRiderScore(worker.id);

    const safeRiderScore = await getSafeRiderScore(worker.id);
    const dostSquad = await getActiveSquadForWorker(worker.id);
    const calc = await calculatePremium(worker, safeRiderScore, dostSquad);

    const policy = await createPolicy(worker.id, calc.final_premium);

    logger.info('Worker onboarded', { worker_id: worker.id, policy_id: policy.id });

    return res.status(201).json({
      worker_id:      worker.id,
      policy_id:      policy.id,
      weekly_premium: calc.final_premium,
      shap_breakdown: calc.shap_breakdown,
      message: 'Worker onboarded. Create a UPI mandate to activate coverage.'
    });
  } catch (err) {
    logger.error('Worker onboarding failed', { err: (err as Error).message });
    return res.status(500).json({ error: 'Onboarding failed', detail: (err as Error).message });
  }
});

// ─── GET /workers/:id — Get worker details ────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const worker = await getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const [policy, safeRiderScore, dostSquad] = await Promise.all([
    getActivePolicyByWorkerId(worker.id),
    getSafeRiderScore(worker.id),
    getActiveSquadForWorker(worker.id)
  ]);

  return res.json({ worker, policy, saferider_score: safeRiderScore, dost_squad: dostSquad });
});

// ─── GET /workers/:id/premium — Get current premium breakdown ────────────────

router.get('/:id/premium', async (req: Request, res: Response) => {
  const worker = await getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  try {
    const safeRiderScore = await getSafeRiderScore(worker.id);
    const dostSquad = await getActiveSquadForWorker(worker.id);
    const calc = await calculatePremium(worker, safeRiderScore, dostSquad);
    return res.json(calc);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /workers/:id/saferider — SafeRider tier (consumed by SPEC-02) ───────
// FIX: SPEC-02 fraud engine calls /saferider — this is the required endpoint path.

router.get('/:id/saferider', async (req: Request, res: Response) => {
  try {
    const threshold = await getFraudThreshold(req.params.id);
    return res.json(threshold);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /workers/:id/fraud-threshold — alias kept for backward compat ───────

router.get('/:id/fraud-threshold', async (req: Request, res: Response) => {
  try {
    const threshold = await getFraudThreshold(req.params.id);
    return res.json(threshold);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /workers/:id/mandate — Create UPI AutoPay mandate ──────────────────

router.post('/:id/mandate', async (req: Request, res: Response) => {
  const worker = await getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const { max_amount } = req.body;

  try {
    const mandateResult = await createUpiMandate(
      worker.id,
      worker.name,
      worker.phone,
      worker.upi_id,
      max_amount || 99
    );

    await updateWorkerMandate(
      worker.id,
      mandateResult.mandate_id,
      mandateResult.status,
      mandateResult.customer_id
    );

    return res.json({
      mandate_id:      mandateResult.mandate_id,
      fund_account_id: mandateResult.fund_account_id,
      status:          mandateResult.status,
      message:         'UPI mandate created. Coverage is now active.'
    });
  } catch (err) {
    logger.error('Mandate creation failed', { worker_id: worker.id, err: (err as Error).message });
    return res.status(500).json({ error: 'Mandate creation failed', detail: (err as Error).message });
  }
});

// ─── POST /workers/:id/fraud-flag — Flag worker for fraud (called by SPEC-02) ─

router.post('/:id/fraud-flag', async (req: Request, res: Response) => {
  try {
    const updated = await onFraudFlag(req.params.id);
    return res.json({
      message:                    'Fraud flag applied',
      new_tier:                   updated.tier,
      consecutive_weeks_reset_to: updated.consecutive_weeks,
      total_flags:                updated.fraud_flags
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;