import { logger } from '../utils/logger';
import {
  SafeRiderScore, SafeRiderTier, TierRule,
  FraudThresholdResponse, SafeRiderTierChangedEvent
} from '../types';
import {
  getSafeRiderScore, upsertSafeRiderScore, flagWorkerFraud
} from '../db/queries';
import { produce } from '../kafka/producer';

// ─── Tier Config ──────────────────────────────────────────────────────────────

export const TIER_RULES: TierRule[] = [
  { tier: 1, min_consecutive_weeks: 0,  discount_pct: 0.00, fraud_threshold: 0.72, label: 'New' },
  { tier: 2, min_consecutive_weeks: 4,  discount_pct: 0.06, fraud_threshold: 0.72, label: 'Growing' },
  { tier: 3, min_consecutive_weeks: 12, discount_pct: 0.12, fraud_threshold: 0.72, label: 'Regular' },
  { tier: 4, min_consecutive_weeks: 24, discount_pct: 0.18, fraud_threshold: 0.85, label: 'Trusted' },
  { tier: 5, min_consecutive_weeks: 52, discount_pct: 0.24, fraud_threshold: 0.85, label: 'Champion' },
];

export function getTierRule(tier: SafeRiderTier): TierRule {
  return TIER_RULES.find(r => r.tier === tier) ?? TIER_RULES[0];
}

// ─── Tier Computation ─────────────────────────────────────────────────────────

/**
 * Derives the correct tier from consecutive_weeks count.
 */
export function computeTier(consecutiveWeeks: number): SafeRiderTier {
  let tier: SafeRiderTier = 1;
  for (const rule of TIER_RULES) {
    if (consecutiveWeeks >= rule.min_consecutive_weeks) {
      tier = rule.tier;
    }
  }
  return tier;
}

/**
 * Called after every successful weekly deduction.
 * Increments consecutive_weeks, recomputes tier, persists, and publishes Kafka event if tier changed.
 */
export async function onSuccessfulDeduction(workerId: string): Promise<SafeRiderScore> {
  const existing = await getSafeRiderScore(workerId);
  const consecutiveWeeks = (existing?.consecutive_weeks ?? 0) + 1;
  const totalWeeks = (existing?.total_weeks ?? 0) + 1;
  const fraudFlags = existing?.fraud_flags ?? 0;
  const oldTier = existing?.tier ?? 1;

  const newTier = computeTier(consecutiveWeeks);
  const updated = await upsertSafeRiderScore(workerId, newTier, consecutiveWeeks, totalWeeks, fraudFlags);

  if (newTier !== oldTier) {
    logger.info('SafeRider tier promoted', { worker_id: workerId, old_tier: oldTier, new_tier: newTier });
    await publishTierChange(workerId, oldTier, newTier, 'promotion');
  }

  return updated;
}

/**
 * Called when a fraud flag is raised for a worker.
 * Resets consecutive_weeks=0 and drops tier by 1 (floor: Tier 1).
 */
export async function onFraudFlag(workerId: string): Promise<SafeRiderScore> {
  const existing = await getSafeRiderScore(workerId);
  const oldTier = existing?.tier ?? 1;

  const updated = await flagWorkerFraud(workerId);
  const newTier = updated.tier as SafeRiderTier;

  logger.warn('SafeRider fraud flag applied', {
    worker_id: workerId, old_tier: oldTier, new_tier: newTier,
    total_flags: updated.fraud_flags
  });

  if (newTier !== oldTier) {
    await publishTierChange(workerId, oldTier, newTier, 'fraud_demotion');
  }

  return updated;
}

/**
 * Returns the fraud score threshold for a worker based on their tier.
 * Tier 4 and 5 workers get a higher threshold (less friction).
 */
export async function getFraudThreshold(workerId: string): Promise<FraudThresholdResponse> {
  const score = await getSafeRiderScore(workerId);
  const tier = (score?.tier ?? 1) as SafeRiderTier;
  const rule = getTierRule(tier);

  return {
    worker_id: workerId,
    tier,
    fraud_score_threshold: rule.fraud_threshold,
    fast_track: tier >= 4,
    description: `${rule.label} — fraud threshold: ${rule.fraud_threshold}. ${
      tier >= 4 ? 'Fast-tracked (skips soft hold).' : 'Standard review path.'
    }`
  };
}

/**
 * Initialises a SafeRider score for a new worker.
 */
export async function initSafeRiderScore(workerId: string): Promise<SafeRiderScore> {
  return upsertSafeRiderScore(workerId, 1, 0, 0, 0);
}

// ─── Kafka ────────────────────────────────────────────────────────────────────

async function publishTierChange(
  workerId: string,
  oldTier: SafeRiderTier,
  newTier: SafeRiderTier,
  reason: SafeRiderTierChangedEvent['reason']
): Promise<void> {
  const event: SafeRiderTierChangedEvent = {
    worker_id: workerId,
    old_tier: oldTier,
    new_tier: newTier,
    reason,
    changed_at: new Date().toISOString()
  };
  await produce('saferider.tier_changed', workerId, event as unknown as Record<string, unknown>);
}