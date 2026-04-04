import { RBA_THRESHOLDS, RBAOutcome } from '@kawaachai/shared';

export interface RBADecision {
  action: RBAOutcome;
  ttlHours?: number;
  message?: string;
}

export const SOFT_HOLD_MESSAGE =
  'Your claim has been received. Due to severe weather and network congestion in your zone, processing requires a short additional time.';

export const STEP_UP_MESSAGE =
  'One quick check to confirm your location. Enable WiFi for a moment.';

export const rbaDecision = (fraudScore: number, saferiderTier: number): RBADecision => {
  const highThreshold = saferiderTier >= 4 ? RBA_THRESHOLDS.TRUSTED_STEP_UP : RBA_THRESHOLDS.STEP_UP;

  if (fraudScore < RBA_THRESHOLDS.SOFT_HOLD) {
    return { action: 'AUTO_APPROVE' };
  }

  if (fraudScore >= highThreshold) {
    return { action: 'STEP_UP', ttlHours: 4, message: STEP_UP_MESSAGE };
  }

  return { action: 'SOFT_HOLD', ttlHours: 2, message: SOFT_HOLD_MESSAGE };
};
