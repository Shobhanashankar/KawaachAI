import express from 'express';
import Redis from 'ioredis';
import {
  addManualReviewEntry,
  config,
  logger,
  updateClaimStatus,
} from '@kawaachai/shared';
import { DisruptionConsumer } from './kafka/disruption-consumer';
import { FnolQueue } from './queue/fnol-queue';
import { registerHttpRoutes } from './routes/http-routes';
import { ClaimsProcessor } from './services/claims-processor';
import { FraudEngine } from './services/fraud-engine';
import { GuidewireClient, GuidewireClientError } from './services/guidewire-client';

const run = async (): Promise<void> => {
  const app = express();
  app.use(express.json());

  const redis = new Redis(config.redisUrl);
  const fnolQueue = new FnolQueue();
  const fraudEngine = new FraudEngine();
  const guidewireClient = new GuidewireClient(redis);

  const claimsProcessor = new ClaimsProcessor({
    redis,
    fnolQueue,
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
