import { Job, Queue, Worker } from 'bullmq';
import { config, FnolPayload } from '@kawaachai/shared';

export interface FnolJobData {
  claimId: string;
  payload: FnolPayload;
}

export class FnolQueue {
  private readonly queue: Queue<FnolJobData>;
  private worker: Worker<FnolJobData> | null = null;

  constructor() {
    this.queue = new Queue<FnolJobData>('fnol-submissions', {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      },
    });
  }

  async enqueue(data: FnolJobData): Promise<void> {
    await this.queue.add('submit-fnol', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 500,
      removeOnFail: 500,
    });
  }

  startWorker(handler: (job: Job<FnolJobData>) => Promise<void>): Worker<FnolJobData> {
    this.worker = new Worker<FnolJobData>('fnol-submissions', handler, {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      },
      concurrency: 10,
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
