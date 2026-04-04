import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger';
import { initSchema, pool } from './db/queries';
import { connectProducer, disconnectProducer } from './kafka/producer';
import { connectConsumer, disconnectConsumer } from './kafka/consumer';
import { startWeeklyDeductionCron } from './crons/weeklyDeduction';
import { startDostCashbackCron } from './crons/dostCashback';

// ─── Routes ───────────────────────────────────────────────────────────────────
// FIX: files live in router/ not routes/
import workersRouter  from './router/workers';
import squadsRouter   from './router/squad';
import payoutsRouter  from './router/payouts';
import webhooksRouter from './router/webhook';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || '3003');

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Raw body capture for Razorpay webhook signature verification
app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json' }), (req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { rawBody?: string }).rawBody = req.body?.toString();
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('HTTP request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'premium-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({ status: 'error', detail: 'Database unreachable' });
  }
});

app.get('/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/v1/workers',   workersRouter);
app.use('/api/v1/squads',    squadsRouter);
app.use('/api/v1/payouts',   payoutsRouter);
app.use('/api/v1/webhooks',  webhooksRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Validate required env vars before anything starts
  const required = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  try {
    // 1. Init DB schema
    await initSchema();
    logger.info('Database schema ready');

    // 2. Connect Kafka producer
    await connectProducer();

    // 3. Connect Kafka consumer with background retry
    const startConsumerWithRetry = async () => {
      const RETRY_INTERVAL_MS = 15000;
      const tryConnect = async () => {
        try {
          await connectConsumer();
        } catch (err) {
          logger.warn('Kafka consumer connection failed — retrying in 15s', {
            err: (err as Error).message
          });
          setTimeout(tryConnect, RETRY_INTERVAL_MS);
        }
      };
      await tryConnect();
    };
    startConsumerWithRetry();

    // 4. Start cron jobs
    startWeeklyDeductionCron();
    startDostCashbackCron();

    // 5. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`premium-service listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { err: (err as Error).message });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully`);
  try {
    await disconnectProducer();
    await disconnectConsumer();
    await pool.end();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Shutdown error', { err: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

start();

export default app;