import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  config,
  DisruptionEvent,
  getActiveZones,
  logger,
  PAYOUTS,
  TriggerType,
} from '@kawaachai/shared';
import { CpcbClient } from '../clients/cpcb';
import { ImdClient } from '../clients/imd';
import { OpenWeatherClient } from '../clients/openweather';
import { TomorrowIoClient } from '../clients/tomorrow';
import { TriggerKafkaProducer } from './kafka-producer';
import { AqiAccumulator } from './aqi-accumulator';
import { ExclusionService } from './exclusions';
import { evaluateAqiConsensus, evaluateWeatherConsensus, TriggerConsensus } from './threshold-engine';

interface PollerDeps {
  redis: Redis;
  producer: TriggerKafkaProducer;
  exclusionService: ExclusionService;
}

export class TriggerPoller {
  private readonly openWeatherClient = new OpenWeatherClient();
  private readonly tomorrowClient = new TomorrowIoClient();
  private readonly imdClient = new ImdClient();
  private readonly cpcbClient = new CpcbClient();
  private readonly aqiAccumulator: AqiAccumulator;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: PollerDeps) {
    this.aqiAccumulator = new AqiAccumulator(this.deps.redis);
    this.intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1000);
  }

  start(): void {
    this.runCycle().catch((error) => logger.error({ err: error }, 'Initial poll cycle failed'));
    this.timer = setInterval(() => {
      this.runCycle().catch((error) => logger.error({ err: error }, 'Scheduled poll cycle failed'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async runCycle(): Promise<void> {
    const zones = await getActiveZones();
    for (const zone of zones) {
      await this.processZone(zone.h3_index, zone.lat, zone.lng);
    }
  }

  private async processZone(zoneH3: string, lat: number, lng: number): Promise<void> {
    const exclusion = await this.deps.exclusionService.check();
    if (exclusion.active) {
      logger.warn({ zoneH3, reason: exclusion.reason }, 'Skipping zone because exclusion is active');
      return;
    }

    const weatherReadings = await Promise.all([
      this.openWeatherClient.getWeather(lat, lng).catch(() => ({ source: 'openweather', rainfall_mm: null, wind_kmph: null, aqi: null })),
      this.tomorrowClient.getWeather(lat, lng).catch(() => ({ source: 'tomorrow_io', rainfall_mm: null, wind_kmph: null, aqi: null })),
      this.imdClient.getWeather(lat, lng).catch(() => ({ source: 'imd', rainfall_mm: null, wind_kmph: null, aqi: null })),
    ]);

    const weatherConsensus = evaluateWeatherConsensus(weatherReadings, {
      rainPartialMm: config.thresholds.rainPartialMm,
      rainFullMm: config.thresholds.rainFullMm,
      aqiThreshold: config.thresholds.aqiThreshold,
      windThresholdKmph: config.thresholds.windThresholdKmph,
    });

    if (weatherConsensus) {
      await this.publishConsensus(zoneH3, weatherConsensus);
    }

    const aqiReadings = await Promise.all([
      this.cpcbClient.getAqi(lat, lng).catch(() => ({ source: 'cpcb', rainfall_mm: null, wind_kmph: null, aqi: null })),
      this.openWeatherClient.getAirQuality(lat, lng).catch(() => ({ source: 'openweather', rainfall_mm: null, wind_kmph: null, aqi: null })),
      this.imdClient.getWeather(lat, lng).catch(() => ({ source: 'imd', rainfall_mm: null, wind_kmph: null, aqi: null })),
    ]);

    const aqiConsensus = evaluateAqiConsensus(aqiReadings, {
      rainPartialMm: config.thresholds.rainPartialMm,
      rainFullMm: config.thresholds.rainFullMm,
      aqiThreshold: config.thresholds.aqiThreshold,
      windThresholdKmph: config.thresholds.windThresholdKmph,
    });

    const samplesNeeded = Math.max(1, Math.ceil((config.thresholds.aqiDurationHours * 60) / 5));
    const sustained = await this.aqiAccumulator.recordBreach(
      zoneH3,
      Boolean(aqiConsensus),
      Date.now(),
      samplesNeeded,
    );

    if (aqiConsensus && sustained) {
      await this.publishConsensus(zoneH3, aqiConsensus);
    }
  }

  private async publishConsensus(zoneH3: string, consensus: TriggerConsensus): Promise<void> {
    const dedupKey = `event:dedup:${zoneH3}:${consensus.trigger_type}:${consensus.severity}:${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    const inserted = await this.deps.redis.set(dedupKey, '1', 'EX', 60 * 60, 'NX');
    if (inserted !== 'OK') {
      return;
    }

    const event: DisruptionEvent = {
      event_id: uuidv4(),
      zone_h3: zoneH3,
      trigger_type: consensus.trigger_type,
      severity: consensus.severity,
      payout_pct: consensus.payout_pct,
      timestamp: new Date().toISOString(),
      source_apis: consensus.source_apis,
      raw_values: consensus.raw_values,
      exclusion_active: false,
    };

    await this.deps.producer.publish(event);
    logger.info({ event }, 'Published disruption event');
  }

  async publishWebhookEvent(
    zoneH3: string,
    triggerType: Extract<TriggerType, 'CURFEW' | 'PLATFORM_DOWN'>,
  ): Promise<DisruptionEvent> {
    const payoutPct = triggerType === 'CURFEW' ? PAYOUTS.CURFEW : PAYOUTS.PLATFORM_DOWN;
    const event: DisruptionEvent = {
      event_id: uuidv4(),
      zone_h3: zoneH3,
      trigger_type: triggerType,
      severity: 'FULL',
      payout_pct: payoutPct,
      timestamp: new Date().toISOString(),
      source_apis: ['webhook'],
      raw_values: {
        rainfall_mm: null,
        wind_kmph: null,
        aqi: null,
      },
      exclusion_active: false,
    };

    await this.deps.producer.publish(event);
    logger.info({ event }, 'Published webhook disruption event');
    return event;
  }
}
