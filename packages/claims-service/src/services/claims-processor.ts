import {
  addManualReviewEntry,
  ActivePolicy,
  createClaim,
  DisruptionEvent,
  FnolPayload,
  getActivePoliciesByZone,
  logger,
  updateClaimStatus,
} from '@kawaachai/shared';
import Redis from 'ioredis';
import { FnolQueue } from '../queue/fnol-queue';
import { RiskReviewQueue } from '../queue/risk-review-queue';
import { FraudEngine } from './fraud-engine';

interface ClaimsProcessorDeps {
  redis: Redis;
  fnolQueue: FnolQueue;
  riskReviewQueue: RiskReviewQueue;
  fraudEngine: FraudEngine;
}

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
): Promise<void> => {
  const inFlight = new Set<Promise<void>>();

  for (const item of items) {
    const task = handler(item).finally(() => {
      inFlight.delete(task);
    });

    inFlight.add(task);
    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
    }
  }

  await Promise.all(inFlight);
};

export class ClaimsProcessor {
  constructor(private readonly deps: ClaimsProcessorDeps) {}

  async processDisruptionEvent(event: DisruptionEvent): Promise<number> {
    const policies = await getActivePoliciesByZone(event.zone_h3);
    await runWithConcurrency(policies, 100, (policy) => this.processPolicy(event, policy));
    return policies.length;
  }

  private async processPolicy(event: DisruptionEvent, policy: ActivePolicy): Promise<void> {
    const dedupKey = `claim:dedup:${policy.policy_id}:${event.event_id}`;
    const isUnique = await this.deps.redis.set(dedupKey, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
    if (isUnique !== 'OK') {
      return;
    }

    const claim = await createClaim({
      event,
      policy_id: policy.policy_id,
      worker_id: policy.worker_id,
    });

    if (!claim) {
      return;
    }

    const fraudResult = await this.deps.fraudEngine.run(policy, event, claim.id);

    if (fraudResult.rbaOutcome === 'REJECT') {
      await updateClaimStatus(claim.id, 'REJECTED', {
        fraudScore: fraudResult.score,
        fraudLatencyMs: fraudResult.duration_ms,
        rbaOutcome: fraudResult.rbaOutcome,
        fraudDetail: fraudResult.fraudDetail,
        errorReason: fraudResult.reason ?? 'Hard fraud rejection',
      });
      return;
    }

    if (fraudResult.rbaOutcome === 'SOFT_HOLD') {
      await updateClaimStatus(claim.id, 'SOFT_HOLD', {
        fraudScore: fraudResult.score,
        fraudLatencyMs: fraudResult.duration_ms,
        rbaOutcome: fraudResult.rbaOutcome,
        fraudDetail: fraudResult.fraudDetail,
      });
      await this.deps.riskReviewQueue.enqueueSoftHoldReview(claim.id);
      return;
    }

    if (fraudResult.rbaOutcome === 'STEP_UP') {
      await updateClaimStatus(claim.id, 'STEP_UP', {
        fraudScore: fraudResult.score,
        fraudLatencyMs: fraudResult.duration_ms,
        rbaOutcome: fraudResult.rbaOutcome,
        fraudDetail: fraudResult.fraudDetail,
        errorReason: fraudResult.reason ?? 'Step-up verification required',
      });
      await this.deps.riskReviewQueue.enqueueStepUpTimeout(claim.id);
      await addManualReviewEntry(claim.id, fraudResult.reason ?? 'Step-up verification required');
      return;
    }

    if (!fraudResult.passed) {
      await updateClaimStatus(claim.id, 'FRAUD_FLAGGED', {
        fraudScore: fraudResult.score,
        fraudLatencyMs: fraudResult.duration_ms,
        rbaOutcome: fraudResult.rbaOutcome,
        fraudDetail: fraudResult.fraudDetail,
        errorReason: fraudResult.reason ?? 'Fraud checks failed',
      });
      await updateClaimStatus(claim.id, 'MANUAL_REVIEW', {
        fraudScore: fraudResult.score,
        fraudLatencyMs: fraudResult.duration_ms,
        rbaOutcome: fraudResult.rbaOutcome,
        fraudDetail: fraudResult.fraudDetail,
        errorReason: fraudResult.reason ?? 'Fraud checks failed',
      });
      await addManualReviewEntry(claim.id, fraudResult.reason ?? 'Fraud checks failed');
      return;
    }

    await updateClaimStatus(claim.id, 'APPROVED', {
      fraudScore: fraudResult.score,
      fraudLatencyMs: fraudResult.duration_ms,
      rbaOutcome: fraudResult.rbaOutcome,
      fraudDetail: fraudResult.fraudDetail,
      guidewireStatus: 'DRAFT',
    });

    const payload: FnolPayload = {
      policy_id: policy.policy_id,
      worker_id: policy.worker_id,
      claim_type: 'PARAMETRIC_INCOME_LOSS',
      loss_date: event.timestamp,
      h3_zone: event.zone_h3,
      trigger: event.trigger_type,
      payout_pct: event.payout_pct,
      fraud_score: fraudResult.score,
      status: 'DRAFT',
    };

    await this.deps.fnolQueue.enqueue({
      claimId: claim.id,
      payload,
    });

    logger.info({ claimId: claim.id, policyId: policy.policy_id }, 'Claim approved and queued for FNOL');
  }
}
