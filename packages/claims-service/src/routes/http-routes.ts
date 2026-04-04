import { Express } from 'express';
import {
  getActiveFraudRings,
  getClaimById,
  getClaimsByWorker,
  getFraudLayerStats,
} from '@kawaachai/shared';
import { requireAdminBearer } from '../utils/auth';

export const registerHttpRoutes = (app: Express): void => {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'claims-service' });
  });

  app.get('/claims/:claimId', async (req, res, next) => {
    try {
      const claim = await getClaimById(req.params.claimId);
      if (!claim) {
        res.status(404).json({ error: 'Claim not found' });
        return;
      }
      res.json(claim);
    } catch (error) {
      next(error);
    }
  });

  app.get('/claims', async (req, res, next) => {
    try {
      const workerId = String(req.query.workerId ?? '').trim();
      if (!workerId) {
        res.status(400).json({ error: 'workerId is required' });
        return;
      }
      const claims = await getClaimsByWorker(workerId);
      res.json({ claims });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin/fraud/rings', requireAdminBearer, async (_req, res, next) => {
    try {
      const rings = await getActiveFraudRings();
      res.json({ rings });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin/fraud/layer-stats', requireAdminBearer, async (_req, res, next) => {
    try {
      const stats = await getFraudLayerStats();
      res.json({ stats });
    } catch (error) {
      next(error);
    }
  });
};
