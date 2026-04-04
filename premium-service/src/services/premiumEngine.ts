import axios from 'axios';
import { logger } from '../utils/logger';
import {
  Worker, SafeRiderScore, DostSquad,
  PremiumCalculationResult, MLPremiumResponse, ShapBreakdown, SafeRiderTier
} from '../types';
import { TIER_RULES } from './safeRider';

// ─── Constants ────────────────────────────────────────────────────────────────

const PREMIUM_FLOOR = 49;
const PREMIUM_CAP   = 99;
const BASE_RATE     = 0.02;      // 2% of weekly earnings
const DOST_PREMIUM_DISCOUNT_PCT = 0.05;  // 5% discount if in Dost squad

const ML_SERVICE_URL     = process.env.ML_SERVICE_URL    || 'http://ml-service:8000';
const ML_TIMEOUT_MS      = parseInt(process.env.ML_SERVICE_TIMEOUT_MS || '200');

// ─── Premium Engine ───────────────────────────────────────────────────────────

/**
 * Calculates weekly premium for a worker using the KawaachAI formula:
 *   base = daily_wage_est × 7 × 0.02
 *   zone_adjusted = base × zone_multiplier
 *   after_sr = zone_adjusted × (1 - saferider_discount_pct)
 *   after_dost = after_sr - dost_flat_discount
 *   final = min(99, max(49, round(after_dost)))
 */
export async function calculatePremium(
  worker: Worker,
  safeRiderScore: SafeRiderScore | null,
  dostSquad: DostSquad | null
): Promise<PremiumCalculationResult> {
  const tier: SafeRiderTier = safeRiderScore?.tier ?? 1;
  const tierRule = TIER_RULES.find(r => r.tier === tier) ?? TIER_RULES[0];

  // Step 1: Base premium
  const basePremium = parseFloat((worker.daily_wage_est * 7 * BASE_RATE).toFixed(2));

  // Step 2: Zone multiplier — try ML service, fall back to 1.0
  let zoneMultiplier = 1.0;
  let mlUsed = false;
  let mlShapValues: Record<string, number> = {};

  try {
    const mlResult = await fetchMLPremium(worker);
    zoneMultiplier = mlResult.zone_multiplier;
    mlShapValues   = mlResult.shap_values;
    mlUsed = true;
  } catch (err) {
    logger.warn('ML service unavailable, using default zone multiplier', {
      worker_id: worker.id, err: (err as Error).message
    });
    zoneMultiplier = getDefaultZoneMultiplier(worker.h3_zone);
    mlShapValues   = getMockShapValues(worker, zoneMultiplier, tier);
  }

  const zoneAdjusted = parseFloat((basePremium * zoneMultiplier).toFixed(2));

  // Step 3: SafeRider discount
  const saferiderDiscountPct = tierRule.discount_pct;
  const afterSr = parseFloat((zoneAdjusted * (1 - saferiderDiscountPct)).toFixed(2));

  // Step 4: Dost Shield flat discount
  let dostFlatDiscount = 0;
  if (dostSquad) {
    dostFlatDiscount = parseFloat((afterSr * DOST_PREMIUM_DISCOUNT_PCT).toFixed(2));
  }
  const afterDost = parseFloat((afterSr - dostFlatDiscount).toFixed(2));

  // Step 5: Apply floor/cap
  const finalPremium = Math.min(PREMIUM_CAP, Math.max(PREMIUM_FLOOR, Math.round(afterDost)));

  // Build SHAP breakdown
  const shapBreakdown: ShapBreakdown = buildShapBreakdown(
    worker, basePremium, zoneMultiplier, zoneAdjusted,
    saferiderDiscountPct, afterSr, dostFlatDiscount, finalPremium,
    tier, dostSquad !== null, mlShapValues
  );

  logger.info('Premium calculated', {
    worker_id: worker.id,
    base_premium: basePremium,
    zone_multiplier: zoneMultiplier,
    final_premium: finalPremium,
    ml_used: mlUsed
  });

  return {
    worker_id: worker.id,
    week_start: getNextMonday(),
    base_premium: basePremium,
    zone_multiplier: zoneMultiplier,
    zone_adjusted: zoneAdjusted,
    saferider_discount_pct: saferiderDiscountPct,
    after_sr: afterSr,
    dost_flat_discount: dostFlatDiscount,
    after_dost: afterDost,
    final_premium: finalPremium,
    shap_breakdown: shapBreakdown,
    ml_used: mlUsed
  };
}

// ─── ML Service Call ──────────────────────────────────────────────────────────

async function fetchMLPremium(worker: Worker): Promise<MLPremiumResponse> {
  const response = await axios.post<MLPremiumResponse>(
    `${ML_SERVICE_URL}/predict/premium`,
    {
      worker_id:         worker.id,
      h3_zone:           worker.h3_zone,
      daily_wage_est:    worker.daily_wage_est,
      platform:          worker.platform,
    },
    { timeout: ML_TIMEOUT_MS }
  );
  return response.data;
}

// ─── Fallback Logic ───────────────────────────────────────────────────────────

/**
 * Simple zone multiplier lookup using h3 zone prefix (first 4 chars = rough city code).
 * In production this is replaced by the ML model output.
 */
function getDefaultZoneMultiplier(h3Zone: string): number {
  // Known high-risk zone prefixes (illustrative — replace with real H3 data)
  const HIGH_RISK_ZONES   = ['8953', '8954', '8955']; // Bengaluru flood zones
  const MEDIUM_RISK_ZONES = ['8835', '8836', '8837']; // Mumbai zones
  const LOW_RISK_ZONES    = ['882c', '882d'];          // Delhi AQI-moderate zones

  const prefix = h3Zone.slice(0, 4).toLowerCase();
  if (HIGH_RISK_ZONES.includes(prefix))   return 1.3;
  if (MEDIUM_RISK_ZONES.includes(prefix)) return 1.1;
  if (LOW_RISK_ZONES.includes(prefix))    return 0.9;
  return 1.0;
}

function getMockShapValues(worker: Worker, zoneMultiplier: number, tier: SafeRiderTier): Record<string, number> {
  return {
    h3_zone_flood_freq: (zoneMultiplier - 1.0) * 0.6,
    h3_zone_aqi_index:  (zoneMultiplier - 1.0) * 0.25,
    h3_zone_wind_exp:   (zoneMultiplier - 1.0) * 0.15,
    saferider_tier:     -(tier - 1) * 0.02,
    daily_wage_est:     worker.daily_wage_est * 0.001,
    monsoon_season:     0.05,
  };
}

// ─── SHAP Breakdown Builder ───────────────────────────────────────────────────

function buildShapBreakdown(
  worker: Worker,
  basePremium: number,
  zoneMultiplier: number,
  zoneAdjusted: number,
  saferiderDiscountPct: number,
  afterSr: number,
  dostFlatDiscount: number,
  finalPremium: number,
  tier: SafeRiderTier,
  inDostSquad: boolean,
  mlShapValues: Record<string, number>
): ShapBreakdown {
  return {
    base_premium: basePremium,
    zone_contribution: parseFloat((zoneAdjusted - basePremium).toFixed(2)),
    saferider_contribution: parseFloat((afterSr - zoneAdjusted).toFixed(2)),
    dost_contribution: parseFloat((-dostFlatDiscount).toFixed(2)),
    final_premium: finalPremium,
    features: {
      daily_wage_est: worker.daily_wage_est,
      h3_zone: worker.h3_zone,
      zone_multiplier: zoneMultiplier,
      saferider_tier: tier,
      in_dost_squad: inDostSquad,
    }
  };
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function getNextMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getCurrentWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Unit-Testable Formula ────────────────────────────────────────────────────

export function applyPremiumFormula(
  dailyWageEst: number,
  zoneMultiplier: number,
  saferiderDiscountPct: number,
  dostFlatDiscount: number
): {
  base: number;
  zoneAdjusted: number;
  afterSr: number;
  afterDost: number;
  final: number;
} {
  const base = parseFloat((dailyWageEst * 7 * BASE_RATE).toFixed(2));
  const zoneAdjusted = parseFloat((base * zoneMultiplier).toFixed(2));
  const afterSr = parseFloat((zoneAdjusted * (1 - saferiderDiscountPct)).toFixed(2));
  const afterDost = parseFloat((afterSr - dostFlatDiscount).toFixed(2));
  const final = Math.min(PREMIUM_CAP, Math.max(PREMIUM_FLOOR, Math.round(afterDost)));
  return { base, zoneAdjusted, afterSr, afterDost, final };
}