import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { logger } from '../utils/logger';
import { ClaimApprovedEvent } from '../types';
import { initiateUpiPayout } from '../services/razorpay';
import { getWorkerById } from '../db/queries';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'premium-service',
  brokers:  (process.env.KAFKA_BROKERS  || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 }
});

let consumer: Consumer;

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId:        process.env.KAFKA_GROUP_ID || 'premium-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
  });

  await consumer.connect();
  await consumer.subscribe({ topics: ['claims.approved'], fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { topic, partition, message } = payload;
      const key   = message.key?.toString();
      const value = message.value?.toString();

      logger.debug('Kafka message received', { topic, partition, key });

      if (!value) {
        logger.warn('Empty Kafka message received', { topic, key });
        return;
      }

      try {
        if (topic === 'claims.approved') {
          await handleClaimApproved(JSON.parse(value) as ClaimApprovedEvent);
        }
      } catch (err) {
        logger.error('Error processing Kafka message', {
          topic, key, err: (err as Error).message
        });
        // Do not throw — this would cause consumer to crash; DLQ is a Phase 2 addition
      }
    }
  });

  logger.info('Kafka consumer connected and subscribed to claims.approved');
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleClaimApproved(event: ClaimApprovedEvent): Promise<void> {
  logger.info('Processing claims.approved event', { claim_id: event.claim_id, worker_id: event.worker_id });

  const worker = await getWorkerById(event.worker_id);
  if (!worker) {
    logger.error('Worker not found for claim payout', { worker_id: event.worker_id });
    return;
  }

  const idempotencyKey = `claim-payout-${event.claim_id}`;

  try {
    const payout = await initiateUpiPayout(
      event.worker_id,
      'claim',
      event.payout_amount,
      event.upi_id || worker.upi_id,
      idempotencyKey,
      `KawaachAI claim payout — ${event.disruption_type}`,
      event.claim_id
    );

    logger.info('Claim payout initiated', {
      claim_id: event.claim_id,
      payout_id: payout.id,
      amount: event.payout_amount
    });
  } catch (err) {
    logger.error('Failed to initiate claim payout', {
      claim_id: event.claim_id,
      err: (err as Error).message
    });
  }
}