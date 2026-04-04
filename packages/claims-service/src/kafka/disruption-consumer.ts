import { Kafka, Producer, logLevel } from 'kafkajs';
import { config, DisruptionEvent, logger, TOPICS } from '@kawaachai/shared';

interface DisruptionConsumerDeps {
  processEvent: (event: DisruptionEvent) => Promise<void>;
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export class DisruptionConsumer {
  private readonly kafka = new Kafka({
    clientId: 'claims-service',
    brokers: config.kafkaBrokers,
    logLevel: logLevel.NOTHING,
  });

  private readonly consumer = this.kafka.consumer({
    groupId: 'claims-service-cg',
  });

  private readonly dlqProducer: Producer = this.kafka.producer();

  constructor(private readonly deps: DisruptionConsumerDeps) {}

  async start(): Promise<void> {
    await this.dlqProducer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPICS.DISRUPTION_EVENTS, fromBeginning: true });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        const payload = message.value?.toString();
        const offset = Number(message.offset);

        if (!payload) {
          await this.consumer.commitOffsets([
            { topic, partition, offset: String(offset + 1) },
          ]);
          return;
        }

        let parsed: DisruptionEvent;
        try {
          parsed = JSON.parse(payload) as DisruptionEvent;
        } catch (error) {
          logger.warn({ err: error }, 'Failed to parse disruption event payload, routing to DLQ');
          await this.publishDlq(payload, 'Invalid JSON payload');
          await this.consumer.commitOffsets([
            { topic, partition, offset: String(offset + 1) },
          ]);
          return;
        }

        let success = false;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await this.deps.processEvent(parsed);
            success = true;
            break;
          } catch (error) {
            logger.warn({ err: error, attempt }, 'Disruption event processing attempt failed');
            if (attempt < 3) {
              await sleep(2 ** attempt * 150);
            }
          }
        }

        if (!success) {
          await this.publishDlq(payload, 'Event failed after 3 retries');
        }

        await this.consumer.commitOffsets([{ topic, partition, offset: String(offset + 1) }]);
      },
    });

    logger.info('Claims disruption consumer started');
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    await this.dlqProducer.disconnect();
  }

  private async publishDlq(payload: string, reason: string): Promise<void> {
    await this.dlqProducer.send({
      topic: TOPICS.DISRUPTION_EVENTS_DLQ,
      messages: [
        {
          value: JSON.stringify({ payload, reason, timestamp: new Date().toISOString() }),
        },
      ],
    });
  }
}
