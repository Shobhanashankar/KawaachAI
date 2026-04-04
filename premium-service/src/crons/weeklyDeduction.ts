import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { WeeklyDeductionSummary } from '../types';
import {
  getActiveWorkersWithPolicy, getActivePolicyByWorkerId,
  upsertPremiumLedger, getPendingLedgerForWeek,
  markLedgerDeducted, markLedgerFailed,
  getSafeRiderScore, getActiveSquadForWorker, getWorkerById
} from '../db/queries';
import { calculatePremium, getCurrentWeekStart } from '../services/premiumEngine';
import { onSuccessfulDeduction } from '../services/saferider';

// ─── Cron Schedule: Every Monday at 06:00 IST (00:30 UTC) ───────────────────

const WEEKLY_DEDUCTION_CRON = process.env.WEEKLY_DEDUCTION_CRON || '30 0 * * 1'; // UTC

export function startWeeklyDeductionCron(): void {
  cron.schedule(WEEKLY_DEDUCTION_CRON, async () => {
    logger.info('Weekly premium deduction cron started');
    try {
      const summary = await runWeeklyDeductions();
      logger.info('Weekly premium deduction cron completed', summary);
    } catch (err) {
      logger.error('Weekly deduction cron failed', { err: (err as Error).message });
    }
  }, { timezone: 'UTC' });

  logger.info('Weekly deduction cron registered', { schedule: WEEKLY_DEDUCTION_CRON });
}

// ─── Main Deduction Logic ─────────────────────────────────────────────────────

export async function runWeeklyDeductions(): Promise<WeeklyDeductionSummary> {
  const weekStart = getCurrentWeekStart();
  const summary: WeeklyDeductionSummary = {
    week_start: weekStart,
    total_workers: 0,
    successful_deductions: 0,
    failed_deductions: 0,
    total_amount_deducted: 0,
    errors: []
  };

  // Step 1: Calculate premiums for all active workers and upsert into ledger
  const workers = await getActiveWorkersWithPolicy();
  summary.total_workers = workers.length;

  logger.info(`Calculating premiums for ${workers.length} workers`, { week_start: weekStart });

  for (const worker of workers) {
    try {
      const policy = await getActivePolicyByWorkerId(worker.id);
      if (!policy) continue;

      const safeRiderScore = await getSafeRiderScore(worker.id);
      const dostSquad = await getActiveSquadForWorker(worker.id);

      const calc = await calculatePremium(worker, safeRiderScore, dostSquad);

      await upsertPremiumLedger(
        worker.id,
        policy.id,
        weekStart,
        calc.base_premium,
        calc.zone_multiplier,
        calc.saferider_discount_pct,
        calc.dost_flat_discount,
        calc.final_premium,
        calc.shap_breakdown
      );
    } catch (err) {
      logger.error('Failed to calculate premium for worker', {
        worker_id: worker.id, err: (err as Error).message
      });
      summary.errors.push({ worker_id: worker.id, error: (err as Error).message });
    }
  }

  // Step 2: Process pending deductions
  // FIX: In UPI AutoPay, the INBOUND charge is triggered by Razorpay mandate — not
  // by an outbound payout call. In sandbox mode we simulate the mandate debit by
  // generating a reference ID and marking the ledger directly.
  // Do NOT call initiateUpiPayout here — that sends money TO the worker (wrong direction).
  const pendingLedger = await getPendingLedgerForWeek(weekStart);
  logger.info(`Processing ${pendingLedger.length} pending deductions`);

  for (const ledger of pendingLedger) {
    const worker = await getWorkerById(ledger.worker_id);
    if (!worker || worker.mandate_status !== 'active') {
      logger.warn('Skipping deduction — worker has no active mandate', {
        worker_id: ledger.worker_id
      });
      await markLedgerFailed(ledger.id);
      summary.failed_deductions++;
      continue;
    }

    try {
      // Sandbox: simulate mandate debit with a generated reference ID.
      // In production: Razorpay fires the mandate charge automatically on schedule.
      // Here we generate a sandbox reference and mark the ledger as deducted.
      const sandboxPaymentRef = `sandbox_debit_${uuidv4().replace(/-/g, '').slice(0, 18)}`;

      await markLedgerDeducted(ledger.id, sandboxPaymentRef);
      await onSuccessfulDeduction(worker.id);

      summary.successful_deductions++;
      summary.total_amount_deducted += ledger.final_premium;

      logger.info('Premium deduction recorded', {
        worker_id: worker.id,
        amount: ledger.final_premium,
        reference: sandboxPaymentRef,
        week_start: weekStart
      });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('Deduction failed for worker', { worker_id: worker.id, err: msg });
      await markLedgerFailed(ledger.id);
      summary.failed_deductions++;
      summary.errors.push({ worker_id: worker.id, error: msg });
    }
  }

  return summary;
}