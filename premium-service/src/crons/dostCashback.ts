import cron from 'node-cron';
import { logger } from '../utils/logger';
// FIX: import from 'dostshield' (lowercase s) to match the actual filename
import { processDostCashbacks } from '../services/dostshield';

// Every Monday at 07:00 IST (01:30 UTC) — after weekly deductions at 06:00 IST
const DOST_CASHBACK_CRON = process.env.DOST_CASHBACK_CRON || '30 1 * * 1';

export function startDostCashbackCron(): void {
  cron.schedule(DOST_CASHBACK_CRON, async () => {
    logger.info('Dost Shield cashback cron started');
    try {
      const results = await processDostCashbacks();
      const eligible = results.filter(r => r.eligible).length;
      logger.info('Dost cashback cron completed', {
        total_squads: results.length,
        eligible_squads: eligible,
        cashbacks_initiated: results.reduce((acc, r) => acc + r.payouts_initiated.length, 0)
      });
    } catch (err) {
      logger.error('Dost cashback cron failed', { err: (err as Error).message });
    }
  }, { timezone: 'UTC' });

  logger.info('Dost cashback cron registered', { schedule: DOST_CASHBACK_CRON });
}