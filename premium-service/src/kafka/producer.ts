import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'premium-service',
  brokers:  (process.env.KAFKA_BROKERS  || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 }
});

let producer: Producer;
let connected = false;

export async function connectProducer(): Promise<void> {
  producer = kafka.producer({ allowAutoTopicCreation: true });
  await producer.connect();
  connected = true;
  logger.info('Kafka producer connected');
}

export async function disconnectProducer(): Promise<void> {
  if (connected && producer) {
    await producer.disconnect();
    connected = false;
  }
}

export async function produce(
  topic: string,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  if (!connected || !producer) {
    logger.warn('Kafka producer not connected, skipping message', { topic, key });
    return;
  }
  await producer.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: [{
      key,
      value: JSON.stringify(value),
      headers: {
        'content-type': 'application/json',
        'source': 'premium-service',
        'timestamp': Date.now().toString()
      }
    }]
  });
  logger.debug('Kafka message produced', { topic, key });
}