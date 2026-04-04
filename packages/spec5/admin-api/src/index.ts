import cors from 'cors';
import express from 'express';
import { adminApiConfig } from './config';
import { closePool } from './db';
import { logger } from './logger';
import { refreshBusinessMetrics, metricsRegistry } from './metrics';
import { requireAdminBearer } from './middleware/auth';
import { requestContextMiddleware } from './middleware/request-context';
import { initializeAdminTables } from './repositories/admin';
import { adminRouter } from './routes/admin';
import { seedSpec05Claims } from './services/seed-spec05';

const run = async (): Promise<void> => {
  await initializeAdminTables();
  if (adminApiConfig.runSeed) {
    await seedSpec05Claims();
    logger.info({ event: 'spec5_seed_completed' }, 'SPEC-05 demo claims seeded');
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'spec5-admin-api' });
  });

  app.get('/metrics', async (_req, res, next) => {
    try {
      await refreshBusinessMetrics();
      res.setHeader('Content-Type', metricsRegistry.contentType);
      res.send(await metricsRegistry.metrics());
    } catch (error) {
      next(error);
    }
  });

  app.use('/admin', requireAdminBearer, adminRouter);

  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({
      request_id: res.locals.requestId,
      event: 'unhandled_error',
      path: req.path,
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'internal_server_error', message: error.message });
  });

  const server = app.listen(adminApiConfig.port, () => {
    logger.info({ event: 'service_started', port: adminApiConfig.port }, 'SPEC-05 admin API started');
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await closePool();
  };

  process.on('SIGINT', () => {
    shutdown().catch((error) => logger.error({ event: 'shutdown_error', err: error }));
  });
  process.on('SIGTERM', () => {
    shutdown().catch((error) => logger.error({ event: 'shutdown_error', err: error }));
  });
};

run().catch((error) => {
  logger.error({ event: 'startup_error', err: error }, 'Failed to start SPEC-05 admin API');
  process.exit(1);
});
