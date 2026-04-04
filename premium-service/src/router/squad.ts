import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { formSquad, processDostCashbacks } from '../services/dostshield';
import { getSquadById, getSquadMembers, getAllActiveSquads } from '../db/queries';
import { CreateSquadRequest } from '../types';

const router = Router();

// ─── POST /squads — Form a new Dost Squad ─────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const { name, dark_store_h3, member_worker_ids } = req.body as CreateSquadRequest;

  if (!name || !dark_store_h3 || !Array.isArray(member_worker_ids)) {
    return res.status(400).json({ error: 'name, dark_store_h3, and member_worker_ids[] are required' });
  }

  try {
    const result = await formSquad({ name, dark_store_h3, member_worker_ids });

    if (result.validation_errors.length > 0) {
      return res.status(422).json({
        error: 'Squad validation failed',
        validation_errors: result.validation_errors
      });
    }

    return res.status(201).json(result);
  } catch (err) {
    logger.error('Squad formation failed', { err: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /squads — List all active squads ────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  const squads = await getAllActiveSquads();
  return res.json({ squads, count: squads.length });
});

// ─── GET /squads/:id — Get squad details with members ────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const squad = await getSquadById(req.params.id);
  if (!squad) return res.status(404).json({ error: 'Squad not found' });

  const members = await getSquadMembers(req.params.id);
  return res.json({ squad, members, member_count: members.length });
});

// ─── POST /squads/cashback/run — Manually trigger cashback (admin) ─────────

router.post('/cashback/run', async (_req: Request, res: Response) => {
  try {
    const results = await processDostCashbacks();
    return res.json({
      message: 'Dost cashback processing complete',
      results
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;