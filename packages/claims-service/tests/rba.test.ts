import { describe, expect, it } from 'vitest';
import { rbaDecision } from '../src/services/rba';

describe('rbaDecision', () => {
  it('auto-approves low fraud score', () => {
    const decision = rbaDecision(0.2, 2);
    expect(decision.action).toBe('AUTO_APPROVE');
  });

  it('returns soft-hold in mid range for standard tiers', () => {
    const decision = rbaDecision(0.55, 2);
    expect(decision.action).toBe('SOFT_HOLD');
    expect(decision.ttlHours).toBe(2);
  });

  it('returns step-up for high score in standard tiers', () => {
    const decision = rbaDecision(0.8, 2);
    expect(decision.action).toBe('STEP_UP');
    expect(decision.ttlHours).toBe(4);
  });

  it('raises threshold for trusted tiers', () => {
    const decision = rbaDecision(0.79, 5);
    expect(decision.action).toBe('SOFT_HOLD');
  });

  it('still step-ups trusted tiers at very high score', () => {
    const decision = rbaDecision(0.9, 5);
    expect(decision.action).toBe('STEP_UP');
  });
});
