import { gridDisk } from 'h3-js';
import { logger } from '../utils/logger';
import { DostCashbackResult, CreateSquadRequest } from '../types';
import {
  createSquad, getSquadById, getSquadMembers, getAllActiveSquads,
  getSquadClaimCountForWeek, incrementZeroClaimStreak, resetZeroClaimStreak,
  getWorkerById
} from '../db/queries';
import { initiateUpiPayout } from './razorpay';
import { getCurrentWeekStart } from './premiumEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SQUAD_SIZE   = 5;
const MAX_SQUAD_SIZE   = 10;
const CASHBACK_PCT     = 0.10;  // 10% of weekly premium
const H3_RING_DISTANCE = 1;     // Members must be within 1 H3 ring of dark store

// ─── Squad Formation ──────────────────────────────────────────────────────────

export async function formSquad(req: CreateSquadRequest): Promise<{
  squad_id: string;
  name: string;
  member_count: number;
  validation_errors: string[];
}> {
  const errors: string[] = [];

  if (req.member_worker_ids.length < MIN_SQUAD_SIZE) {
    errors.push(`Squad must have at least ${MIN_SQUAD_SIZE} members`);
  }
  if (req.member_worker_ids.length > MAX_SQUAD_SIZE) {
    errors.push(`Squad cannot exceed ${MAX_SQUAD_SIZE} members`);
  }

  if (errors.length > 0) {
    return { squad_id: '', name: req.name, member_count: 0, validation_errors: errors };
  }

  // Validate member proximity to dark store
  const validRingCells = new Set(gridDisk(req.dark_store_h3, H3_RING_DISTANCE));

  for (const workerId of req.member_worker_ids) {
    const worker = await getWorkerById(workerId);
    if (!worker) {
      errors.push(`Worker ${workerId} not found`);
      continue;
    }
    if (!validRingCells.has(worker.h3_zone)) {
      errors.push(
        `Worker ${workerId} (zone: ${worker.h3_zone}) is not within 1 H3 ring of dark store ${req.dark_store_h3}`
      );
    }
  }

  if (errors.length > 0) {
    return { squad_id: '', name: req.name, member_count: 0, validation_errors: errors };
  }

  const squad = await createSquad(req.name, req.dark_store_h3, req.member_worker_ids);

  logger.info('Dost squad formed', {
    squad_id: squad.id,
    member_count: req.member_worker_ids.length,
    dark_store_h3: req.dark_store_h3
  });

  return {
    squad_id: squad.id,
    name: squad.name,
    member_count: req.member_worker_ids.length,
    validation_errors: []
  };
}

// ─── Cashback Processing ──────────────────────────────────────────────────────

export async function processDostCashbacks(): Promise<DostCashbackResult[]> {
  const weekStart = getCurrentWeekStart();
  // Cashback is for the PREVIOUS week
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const squads = await getAllActiveSquads();
  const results: DostCashbackResult[] = [];

  for (const squad of squads) {
    try {
      const result = await processSquadCashback(squad.id, prevWeekStart);
      results.push(result);
    } catch (err) {
      logger.error('Failed to process Dost cashback for squad', {
        squad_id: squad.id, err: (err as Error).message
      });
    }
  }

  return results;
}

async function processSquadCashback(squadId: string, weekStart: Date): Promise<DostCashbackResult> {
  const squad = await getSquadById(squadId);
  if (!squad) throw new Error(`Squad ${squadId} not found`);

  const members = await getSquadMembers(squadId);
  const claimCount = await getSquadClaimCountForWeek(squadId, weekStart);
  const eligible = claimCount === 0;

  if (!eligible) {
    await resetZeroClaimStreak(squadId);
    logger.info('Squad had claims — no cashback', { squad_id: squadId, claims: claimCount });
    return {
      squad_id: squadId,
      week_start: weekStart,
      eligible: false,
      member_count: members.length,
      cashback_amount_per_member: 0,
      payouts_initiated: []
    };
  }

  await incrementZeroClaimStreak(squadId);
  const payoutsInitiated: string[] = [];

  for (const member of members) {
    // 10% of their weekly premium (approximated from daily wage)
    const weeklyPremium = parseFloat((member.daily_wage_est * 7 * 0.02).toFixed(2));
    const cashbackAmount = parseFloat((weeklyPremium * CASHBACK_PCT).toFixed(2));
    const idempotencyKey = `dost-cashback-${squadId}-${member.worker_id}-${weekStart.toISOString().split('T')[0]}`;

    try {
      const payout = await initiateUpiPayout(
        member.worker_id,
        'cashback',
        cashbackAmount,
        member.upi_id,
        idempotencyKey,
        `Dost Shield cashback ${squad.name}`
      );
      payoutsInitiated.push(payout.id);
    } catch (err) {
      logger.error('Failed to initiate cashback for squad member', {
        squad_id: squadId, worker_id: member.worker_id, err: (err as Error).message
      });
    }
  }

  logger.info('Dost cashback processed', {
    squad_id: squadId,
    cashbacks_initiated: payoutsInitiated.length
  });

  const cashbackPerMember = members[0]
    ? parseFloat((members[0].daily_wage_est * 7 * 0.02 * CASHBACK_PCT).toFixed(2))
    : 0;

  return {
    squad_id: squadId,
    week_start: weekStart,
    eligible: true,
    member_count: members.length,
    cashback_amount_per_member: cashbackPerMember,
    payouts_initiated: payoutsInitiated
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isWithinRing(workerH3: string, darkStoreH3: string, rings = H3_RING_DISTANCE): boolean {
  const validCells = new Set(gridDisk(darkStoreH3, rings));
  return validCells.has(workerH3);
}