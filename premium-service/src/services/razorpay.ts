import Razorpay from 'razorpay';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { Payout, PayoutType, RazorpayPayout, RazorpayWebhookPayload } from '../types';
import {
  createPayout, getPayoutByIdempotencyKey,
  updatePayoutStatus, getPayoutByRazorpayId
} from '../db/queries';
import { produce } from '../kafka/producer';

// ─── Razorpay Client ──────────────────────────────────────────────────────────
// FIX: Do not use placeholder fallbacks. Missing env vars must fail loudly,
// not silently authenticate with fake keys.

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  throw new Error(
    'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set. ' +
    'Get test keys from https://dashboard.razorpay.com/app/keys'
  );
}

export const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const RAZORPAY_ACCOUNT_NUMBER = process.env.RAZORPAY_ACCOUNT_NUMBER!;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

// ─── Razorpay HTTP helper ─────────────────────────────────────────────────────

function rpAuth() {
  return { username: RAZORPAY_KEY_ID!, password: RAZORPAY_KEY_SECRET! };
}

// ─── Mandate (AutoPay) ────────────────────────────────────────────────────────

/**
 * Creates a Razorpay contact + fund account for a worker.
 * Returns a sandbox mandate reference — Razorpay's actual UPI AutoPay mandate
 * requires a production account with NACH/UPI recurring enabled.
 * In test mode we create the contact+fund_account (which ARE available in sandbox)
 * and generate a local reference for tracking. This is honest about what sandbox supports.
 */
export async function createUpiMandate(
  workerId: string,
  workerName: string,
  workerPhone: string,
  upiId: string,
  maxAmount: number
): Promise<{ mandate_id: string; customer_id: string; fund_account_id: string; status: string }> {
  logger.info('Creating Razorpay contact + fund account (sandbox)', {
    worker_id: workerId, upi_id: upiId
  });

  // Step 1: Create Razorpay contact
  const contactRes = await axios.post(
    'https://api.razorpay.com/v1/contacts',
    {
      name:         workerName,
      contact:      workerPhone,
      type:         'employee',
      reference_id: workerId,
    },
    { auth: rpAuth() }
  );
  const contactId: string = contactRes.data.id;

  // Step 2: Create fund account (UPI VPA)
  const faRes = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts',
    {
      contact_id:   contactId,
      account_type: 'vpa',
      vpa:          { address: upiId }
    },
    { auth: rpAuth() }
  );
  const fundAccountId: string = faRes.data.id;

  // Step 3: Sandbox mandate reference
  // Razorpay NACH/UPI AutoPay mandate creation requires a live account.
  // In test mode, we store the contact+fund_account IDs and generate a local ref.
  // This is sufficient for the demo — payout flows work independently of mandate.
  const mandateRef = `sandbox_mand_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

  logger.info('Mandate reference created (sandbox)', {
    worker_id: workerId,
    mandate_ref: mandateRef,
    contact_id: contactId,
    fund_account_id: fundAccountId
  });

  return {
    mandate_id:      mandateRef,
    customer_id:     contactId,
    fund_account_id: fundAccountId,
    status:          'active'
  };
}

// ─── UPI Payout ───────────────────────────────────────────────────────────────

/**
 * Initiates an outbound UPI payout to a worker (claim payout or cashback).
 * This is the OUTBOUND direction: KawaachAI → Worker.
 * For premium collection (INBOUND), mandates are used separately.
 */
export async function initiateUpiPayout(
  workerId: string,
  type: PayoutType,
  amount: number,
  upiId: string,
  idempotencyKey: string,
  narration: string,
  referenceId?: string
): Promise<Payout> {
  // Idempotency check
  const existing = await getPayoutByIdempotencyKey(idempotencyKey);
  if (existing) {
    logger.info('Payout already exists (idempotent)', {
      idempotency_key: idempotencyKey,
      payout_id: existing.id,
      status: existing.status
    });
    return existing;
  }

  // Create payout record
  const payout = await createPayout(workerId, type, amount, upiId, idempotencyKey, referenceId);

  try {
    await updatePayoutStatus(payout.id, 'processing');

    // Step 1: Create contact
    const contactRes = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      { name: `Worker-${workerId.slice(0, 8)}`, type: 'employee', reference_id: workerId },
      { auth: rpAuth() }
    );
    const contactId: string = contactRes.data.id;

    // Step 2: Create fund account
    const faRes = await axios.post(
      'https://api.razorpay.com/v1/fund_accounts',
      { contact_id: contactId, account_type: 'vpa', vpa: { address: upiId } },
      { auth: rpAuth() }
    );
    const fundAccountId: string = faRes.data.id;

    // Step 3: Create payout
    const payoutRes = await axios.post<RazorpayPayout>(
      'https://api.razorpay.com/v1/payouts',
      {
        account_number:       RAZORPAY_ACCOUNT_NUMBER,
        fund_account_id:      fundAccountId,
        amount:               Math.round(amount * 100), // paise
        currency:             'INR',
        mode:                 'UPI',
        purpose:              type === 'claim' ? 'payout' : 'cashback',
        queue_if_low_balance: true,
        reference_id:         idempotencyKey,
        narration:            narration.slice(0, 30),
      },
      { auth: rpAuth() }
    );

    const rpPayout = payoutRes.data;

    await updatePayoutStatus(
      payout.id,
      rpPayout.status === 'processed' ? 'completed' : 'processing',
      rpPayout.id,
      fundAccountId
    );

    logger.info('UPI payout initiated', {
      payout_id: payout.id,
      razorpay_payout_id: rpPayout.id,
      amount,
      worker_id: workerId
    });

    return { ...payout, razorpay_payout_id: rpPayout.id, status: 'processing' };
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Payout initiation failed', { payout_id: payout.id, err: message });
    await updatePayoutStatus(payout.id, 'failed', undefined, undefined, message);
    throw err;
  }
}

// ─── Webhook Handling ─────────────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  return digest === signature;
}

export async function handlePayoutWebhook(payload: RazorpayWebhookPayload): Promise<void> {
  const event = payload.event;
  const rpPayout = payload.payload.payout?.entity;

  if (!rpPayout) {
    logger.warn('Webhook received with no payout entity', { event });
    return;
  }

  const payout = await getPayoutByRazorpayId(rpPayout.id);
  if (!payout) {
    logger.warn('Payout not found for Razorpay ID', { razorpay_id: rpPayout.id });
    return;
  }

  if (event === 'payout.processed') {
    await updatePayoutStatus(payout.id, 'completed', rpPayout.id);
    logger.info('Payout marked completed via webhook', { payout_id: payout.id });

    await produce('payouts.completed', payout.worker_id, {
      payout_id:          payout.id,
      worker_id:          payout.worker_id,
      amount:             payout.amount,
      type:               payout.type,
      razorpay_payout_id: rpPayout.id,
      completed_at:       new Date().toISOString()
    });

  } else if (event === 'payout.failed') {
    const reason = (rpPayout as unknown as Record<string, string>).failure_reason ?? 'Unknown';
    await updatePayoutStatus(payout.id, 'failed', rpPayout.id, undefined, reason);
    logger.warn('Payout failed via webhook', { payout_id: payout.id, reason });
  }
}