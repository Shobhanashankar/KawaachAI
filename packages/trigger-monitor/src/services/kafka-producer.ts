import { Kafka, Producer, logLevel } from 'kafkajs';
import { config, DisruptionEvent, TOPICS } from '@kawaachai/shared';

export class TriggerKafkaProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'trigger-monitor',
      brokers: config.kafkaBrokers,
      logLevel: logLevel.NOTHING,
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      retry: { retries: 5 },
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(event: DisruptionEvent): Promise<void> {
    await this.producer.send({
      topic: TOPICS.DISRUPTION_EVENTS,
      messages: [
        {
          key: event.zone_h3,
          value: JSON.stringify(event),
        },
      ],
      acks: -1,
    });
  }
}
