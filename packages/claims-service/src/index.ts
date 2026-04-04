import express from 'express';
import Redis from 'ioredis';
import {
  addManualReviewEntry,
  config,
  FnolPayload,
  getClaimByIdAndStatus,
  logger,
  updateClaimStatus,
} from '@kawaachai/shared';
import { DisruptionConsumer } from './kafka/disruption-consumer';
import { FnolQueue } from './queue/fnol-queue';
import { RiskReviewQueue } from './queue/risk-review-queue';
import { registerHttpRoutes } from './routes/http-routes';
import { ClaimsProcessor } from './services/claims-processor';
import { FraudEngine } from './services/fraud-engine';
import { GuidewireClient, GuidewireClientError } from './services/guidewire-client';

const buildFnolPayloadFromClaim = (
  claim: Awaited<ReturnType<typeof getClaimByIdAndStatus>>,
): FnolPayload | null => {
  if (!claim) return null;

  return {
    policy_id: claim.policy_id,
    worker_id: claim.worker_id,
    claim_type: 'PARAMETRIC_INCOME_LOSS',
    loss_date: claim.created_at,
    h3_zone: claim.h3_zone,
    trigger: claim.trigger_type,
    payout_pct: claim.payout_pct,
    fraud_score: claim.fraud_score ?? 0,
    status: 'DRAFT',
  };
};

const run = async (): Promise<void> => {
  const app = express();
  app.use(express.json());

  const redis = new Redis(config.redisUrl);
  const fnolQueue = new FnolQueue();
  const riskReviewQueue = new RiskReviewQueue();
  const fraudEngine = new FraudEngine(redis);
  const guidewireClient = new GuidewireClient(redis);

  const claimsProcessor = new ClaimsProcessor({
    redis,
    fnolQueue,
    riskReviewQueue,
    fraudEngine,
  });

  const fnolWorker = fnolQueue.startWorker(async (job) => {
    const { claimId, payload } = job.data;

    try {
      const result = await guidewireClient.submitFnol(payload);
      await updateClaimStatus(claimId, 'FNOL_SUBMITTED', {
        guidewireClaimId: result.claimId,
        guidewireStatus: result.status,
      });
    } catch (error) {
      if (error instanceof GuidewireClientError) {
        if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          await updateClaimStatus(claimId, 'MANUAL_REVIEW', {
            errorReason: `Guidewire 4xx: ${error.message}`,
          });
          await addManualReviewEntry(claimId, `Guidewire 4xx: ${error.message}`);
          return;
        }
      }
      throw error;
    }
  });

  fnolWorker.on('failed', async (job, error) => {
    if (!job) return;
    const claimId = job.data.claimId;
    await updateClaimStatus(claimId, 'MANUAL_REVIEW', {
      errorReason: `FNOL retries exhausted: ${error.message}`,
    });
    await addManualReviewEntry(claimId, `FNOL retries exhausted: ${error.message}`);
  });

  const riskReviewWorker = riskReviewQueue.startWorker(async (job) => {
    if (job.data.kind === 'soft-hold-review') {
      const claim = await getClaimByIdAndStatus(job.data.claimId, 'SOFT_HOLD');
      if (!claim) return;

      const score = claim.fraud_score ?? 0;
      if (score < 0.55) {
        await updateClaimStatus(claim.id, 'APPROVED', {
          guidewireStatus: 'DRAFT',
        });

        const payload = buildFnolPayloadFromClaim(claim);
        if (payload) {
          await fnolQueue.enqueue({
            claimId: claim.id,
            payload,
          });
        }
        return;
      }

      await updateClaimStatus(claim.id, 'STEP_UP', {
        errorReason: 'Soft hold review escalated to step-up verification',
      });
      await riskReviewQueue.enqueueStepUpTimeout(claim.id);
      await addManualReviewEntry(claim.id, 'Soft hold review escalated to step-up verification');
      return;
    }

    if (job.data.kind === 'step-up-timeout') {
      const claim = await getClaimByIdAndStatus(job.data.claimId, 'STEP_UP');
      if (!claim) return;

      await updateClaimStatus(claim.id, 'MANUAL_REVIEW', {
        errorReason: 'Step-up timeout exceeded 4h window',
      });
      await addManualReviewEntry(claim.id, 'Step-up timeout exceeded 4h window');
    }
  });

  riskReviewWorker.on('failed', (job, error) => {
    logger.error({ claimId: job?.data.claimId, err: error }, 'Risk review worker failed');
  });

  const consumer = new DisruptionConsumer({
    processEvent: async (event) => {
      await claimsProcessor.processDisruptionEvent(event);
    },
  });
  await consumer.start();

  registerHttpRoutes(app);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    logger.error({ err: error }, 'Unhandled claims-service error');
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(config.claimsServicePort, () => {
    logger.info({ port: config.claimsServicePort }, 'Claims service started');
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await consumer.stop();
    await fnolQueue.close();
    await riskReviewQueue.close();
    redis.disconnect();
  };

  process.on('SIGTERM', () => {
    shutdown().catch((error) => logger.error({ err: error }, 'Shutdown failed'));
  });

  process.on('SIGINT', () => {
    shutdown().catch((error) => logger.error({ err: error }, 'Shutdown failed'));
  });
};

run().catch((error) => {
  logger.error({ err: error }, 'Failed to start claims-service');
  process.exit(1);
});
