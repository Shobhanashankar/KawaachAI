import { Job, Queue, Worker } from 'bullmq';
import { config } from '@kawaachai/shared';

export type RiskReviewJobType = 'soft-hold-review' | 'step-up-timeout';

export interface RiskReviewJobData {
  claimId: string;
  kind: RiskReviewJobType;
}

export class RiskReviewQueue {
  private readonly queue: Queue<RiskReviewJobData>;
  private worker: Worker<RiskReviewJobData> | null = null;

  constructor() {
    this.queue = new Queue<RiskReviewJobData>('risk-review', {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      },
    });
  }

  async enqueueSoftHoldReview(claimId: string): Promise<void> {
    await this.queue.add(
      'soft-hold-review',
      { claimId, kind: 'soft-hold-review' },
      {
        delay: config.fraud.softHoldMs,
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }

  async enqueueStepUpTimeout(claimId: string): Promise<void> {
    await this.queue.add(
      'step-up-timeout',
      { claimId, kind: 'step-up-timeout' },
      {
        delay: config.fraud.stepUpTimeoutMs,
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }

  startWorker(handler: (job: Job<RiskReviewJobData>) => Promise<void>): Worker<RiskReviewJobData> {
    this.worker = new Worker<RiskReviewJobData>('risk-review', handler, {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      },
      concurrency: 8,
    });

    return this.worker;
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
  }
}
