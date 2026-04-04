import express from 'express';
import Redis from 'ioredis';
import { config, logger } from '@kawaachai/shared';
import { ExclusionService } from './services/exclusions';
import { TriggerKafkaProducer } from './services/kafka-producer';
import { TriggerPoller } from './services/poller';
import { registerHttpRoutes } from './routes/http-routes';

const run = async (): Promise<void> => {
  const app = express();
  app.use(express.json());

  const redis = new Redis(config.redisUrl);
  const producer = new TriggerKafkaProducer();
  await producer.connect();

  const exclusionService = new ExclusionService(redis);
  const poller = new TriggerPoller({
    redis,
    producer,
    exclusionService,
  });

  registerHttpRoutes(app, { exclusionService, poller });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    logger.error({ err: error }, 'Unhandled trigger-monitor error');
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(config.triggerMonitorPort, () => {
    logger.info({ port: config.triggerMonitorPort }, 'Trigger monitor started');
  });

  poller.start();

  const shutdown = async (): Promise<void> => {
    poller.stop();
    server.close();
    await producer.disconnect();
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
  logger.error({ err: error }, 'Failed to start trigger-monitor');
  process.exit(1);
});
