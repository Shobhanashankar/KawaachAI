import { ActivePolicy, DisruptionEvent } from '@kawaachai/shared';

export interface FraudResult {
  passed: boolean;
  score: number;
  reason?: string;
  duration_ms: number;
}

export class FraudEngine {
  async run(policy: ActivePolicy, _event: DisruptionEvent): Promise<FraudResult> {
    void _event;
    const start = Date.now();

    // Placeholder parallel checks. SPEC-02 will replace these with full 6-layer implementation.
    const [mockLocationCheck, geoCheck, dedupCheck, sourceConsensusCheck, behaviorScore, trustBonus] =
      await Promise.all([
        Promise.resolve(true),
        Promise.resolve(true),
        Promise.resolve(true),
        Promise.resolve(true),
        Promise.resolve(this.syntheticBehaviorScore(policy.policy_id)),
        Promise.resolve(this.syntheticTrustBonus(policy.worker_id)),
      ]);

    const score = Math.max(0, Math.min(1, behaviorScore - trustBonus));
    const passed =
      mockLocationCheck && geoCheck && dedupCheck && sourceConsensusCheck && score < 0.72;

    return {
      passed,
      score,
      reason: passed ? undefined : 'Fraud score exceeded threshold',
      duration_ms: Date.now() - start,
    };
  }

  private syntheticBehaviorScore(policyId: string): number {
    const numericTail = Number(policyId.split('-').at(-1) ?? 0);
    if (numericTail % 9 === 0) return 0.84;
    if (numericTail % 5 === 0) return 0.49;
    return 0.16;
  }

  private syntheticTrustBonus(workerId: string): number {
    const numericTail = Number(workerId.split('-').at(-1) ?? 0);
    return numericTail % 4 === 0 ? 0.06 : 0.02;
  }
}
