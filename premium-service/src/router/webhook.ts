import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { verifyWebhookSignature, handlePayoutWebhook } from '../services/razorpay';
import { RazorpayWebhookPayload } from '../types';

const router = Router();

// ─── POST /webhooks/razorpay — Handle Razorpay payout webhooks ───────────────

router.post('/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!signature) {
    logger.warn('Webhook received without signature');
    return res.status(400).json({ error: 'Missing signature' });
  }

  // Raw body is needed for HMAC verification — see index.ts for raw body middleware
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  if (!rawBody) {
    logger.warn('Webhook raw body not available');
    return res.status(400).json({ error: 'Raw body unavailable' });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body as RazorpayWebhookPayload;
  logger.info('Razorpay webhook received', { event: payload.event });

  // Acknowledge immediately — process async to avoid timeout
  res.status(200).json({ received: true });

  try {
    if (payload.event === 'payout.processed' || payload.event === 'payout.failed') {
      await handlePayoutWebhook(payload);
    } else {
      logger.debug('Unhandled webhook event', { event: payload.event });
    }
  } catch (err) {
    logger.error('Webhook processing error', { event: payload.event, err: (err as Error).message });
  }
});

// ─── POST /webhooks/mandate — Handle mandate status webhooks ─────────────────

router.post('/mandate', async (req: Request, res: Response) => {
  const payload = req.body;
  logger.info('Mandate webhook received', { event: payload.event });

  // Acknowledge first
  res.status(200).json({ received: true });

  try {
    const { event } = payload;
    if (event === 'subscription.activated' || event === 'subscription.authenticated') {
      const workerId = payload.payload?.subscription?.entity?.notes?.worker_id;
      const mandateId = payload.payload?.subscription?.entity?.id;
      if (workerId && mandateId) {
        const { updateWorkerMandate } = await import('../db/queries');
        await updateWorkerMandate(workerId, mandateId, 'active');
        logger.info('Mandate activated via webhook', { worker_id: workerId, mandate_id: mandateId });
      }
    } else if (event === 'subscription.cancelled') {
      const workerId = payload.payload?.subscription?.entity?.notes?.worker_id;
      const mandateId = payload.payload?.subscription?.entity?.id;
      if (workerId && mandateId) {
        const { updateWorkerMandate } = await import('../db/queries');
        await updateWorkerMandate(workerId, mandateId, 'cancelled');
        logger.warn('Mandate cancelled via webhook', { worker_id: workerId });
      }
    }
  } catch (err) {
    logger.error('Mandate webhook processing error', { err: (err as Error).message });
  }
});

export default router;