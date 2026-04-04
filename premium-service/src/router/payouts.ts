import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getPayoutsByWorkerId, getPayoutsSummary,
  getPayoutByIdempotencyKey
} from '../db/queries';
import { initiateUpiPayout } from '../services/razorpay';
import { getWorkerById } from '../db/queries';

const router = Router();

// ─── GET /payouts — List payouts (used by SPEC-05 dashboard) ─────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await getPayoutsSummary();
    return res.json(summary);
  } catch (err) {
    logger.error('Failed to fetch payout summary', { err: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /payouts/summary — Aggregated stats (for SPEC-05 loss ratio view) ───

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { week_start } = req.query;
    const weekDate = week_start ? new Date(week_start as string) : undefined;
    const summary = await getPayoutsSummary(weekDate);
    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /payouts/worker/:workerId — Payout history for a worker ─────────────

router.get('/worker/:workerId', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const payouts = await getPayoutsByWorkerId(
      req.params.workerId,
      limit ? parseInt(limit as string) : 50
    );
    return res.json({ payouts, count: payouts.length });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /payouts/claim — Manually trigger a claim payout (admin/test use) ──
// In production this is triggered by Kafka claims.approved event.

router.post('/claim', async (req: Request, res: Response) => {
  const { worker_id, amount, claim_id, disruption_type } = req.body;

  if (!worker_id || !amount || !claim_id) {
    return res.status(400).json({ error: 'worker_id, amount, and claim_id are required' });
  }

  const worker = await getWorkerById(worker_id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const idempotencyKey = `claim-payout-${claim_id}`;

  // Check for existing payout with this idempotency key
  const existing = await getPayoutByIdempotencyKey(idempotencyKey);
  if (existing) {
    return res.json({ message: 'Payout already exists', payout: existing });
  }

  try {
    const payout = await initiateUpiPayout(
      worker_id,
      'claim',
      amount,
      worker.upi_id,
      idempotencyKey,
      `KawaachAI claim — ${disruption_type || 'disruption'}`,
      claim_id
    );

    logger.info('Manual claim payout initiated', {
      claim_id, payout_id: payout.id, amount
    });

    return res.status(201).json(payout);
  } catch (err) {
    logger.error('Manual claim payout failed', {
      claim_id, err: (err as Error).message
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;