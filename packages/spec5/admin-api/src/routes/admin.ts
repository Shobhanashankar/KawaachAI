import axios from 'axios';
import { Router } from 'express';
import { z } from 'zod';
import { adminApiConfig } from '../config';
import {
  getClaimById,
  getClaims,
  getDashboardKpis,
  getFraudLayerStats,
  getFraudRings,
  getHeatmapData,
  getLatestLlmReview,
  getLlmPromptContext,
  saveAdminDecision,
  saveLlmReview,
} from '../repositories/admin';
import { getServiceHealth } from '../services/health';
import { generateLlmReview } from '../services/llm-review';

const claimsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.string().optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_MORE_INFO']),
  reason: z.string().max(500).optional().default(''),
});

export const adminRouter = Router();

adminRouter.get('/kpis', async (_req, res, next) => {
  try {
    const kpis = await getDashboardKpis();
    res.json(kpis);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/claims', async (req, res, next) => {
  try {
    const parsed = claimsQuerySchema.parse(req.query);
    const statuses = parsed.status
      ?.split(',')
      .map((status) => status.trim())
      .filter(Boolean);

    const claims = await getClaims(parsed.limit, statuses);
    const enriched = claims.map((claim) => ({
      ...claim,
      payout_amount_inr: Number(
        (((claim.payout_pct ?? 0) / 100) * Number(claim.daily_wage_inr ?? 0)).toFixed(2),
      ),
    }));

    res.json({ claims: enriched });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/claims/:claimId', async (req, res, next) => {
  try {
    const claim = await getClaimById(req.params.claimId);
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const latestLlmReview = await getLatestLlmReview(req.params.claimId);
    res.json({
      ...claim,
      payout_amount_inr: Number((((claim.payout_pct ?? 0) / 100) * Number(claim.daily_wage_inr ?? 0)).toFixed(2)),
      latest_llm_review: latestLlmReview,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/heatmap', async (_req, res, next) => {
  try {
    const zones = await getHeatmapData();
    res.json({ zones });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/fraud/layer-stats', async (_req, res, next) => {
  try {
    const stats = await getFraudLayerStats();
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/fraud/rings', async (_req, res, next) => {
  try {
    const rings = await getFraudRings();
    res.json({ rings });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/service-health', async (_req, res, next) => {
  try {
    const services = await getServiceHealth();
    res.json({ services });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/exclusions', async (req, res, next) => {
  try {
    const response = await axios.get(`${adminApiConfig.triggerMonitorBaseUrl}/admin/exclusions`, {
      headers: {
        Authorization: req.header('authorization') ?? '',
      },
      timeout: 4000,
    });

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/exclusions', async (req, res, next) => {
  try {
    const response = await axios.patch(
      `${adminApiConfig.triggerMonitorBaseUrl}/admin/exclusions`,
      req.body,
      {
        headers: {
          Authorization: req.header('authorization') ?? '',
          'x-admin-user': req.header('x-admin-user') ?? 'spec5-admin',
        },
        timeout: 4000,
      },
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/claims/:claimId/llm-review', async (req, res, next) => {
  try {
    const context = await getLlmPromptContext(req.params.claimId);
    if (!context) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const generated = await generateLlmReview(context);

    await saveLlmReview({
      claimId: req.params.claimId,
      prompt: generated.prompt,
      provider: generated.provider,
      model: generated.model,
      responseJson: (generated.result as unknown as Record<string, unknown>) ?? null,
      recommendation: generated.result?.recommendation,
      confidence: generated.result?.confidence,
    });

    res.json(generated);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/claims/:claimId/decision', async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body ?? {});

    await saveAdminDecision({
      claimId: req.params.claimId,
      decision: body.decision,
      reason: body.reason,
      adminUser: req.header('x-admin-user') ?? 'spec5-admin',
    });

    const claim = await getClaimById(req.params.claimId);
    res.json({
      ok: true,
      claim,
    });
  } catch (error) {
    next(error);
  }
});
