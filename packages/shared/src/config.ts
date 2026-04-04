import dotenv from 'dotenv';
import { DEFAULT_THRESHOLDS, FRAUD_TIMERS } from './constants';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/kawaachai',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY ?? '',
  tomorrowIoApiKey: process.env.TOMORROW_IO_API_KEY ?? '',
  imdApiKey: process.env.IMD_API_KEY ?? '',
  cpcbApiKey: process.env.CPCB_API_KEY ?? '',
  guidewireClientId: process.env.GUIDEWIRE_CLIENT_ID ?? '',
  guidewireClientSecret: process.env.GUIDEWIRE_CLIENT_SECRET ?? '',
  guidewireBaseUrl: process.env.GUIDEWIRE_BASE_URL ?? '',
  adminBearerToken: process.env.ADMIN_BEARER_TOKEN ?? 'change-me',
  triggerMonitorPort: toNumber(process.env.TRIGGER_MONITOR_PORT, 3001),
  claimsServicePort: toNumber(process.env.CLAIMS_SERVICE_PORT, 3002),
  thresholds: {
    rainPartialMm: toNumber(process.env.RAIN_THRESHOLD_PARTIAL_MM, DEFAULT_THRESHOLDS.RAIN_PARTIAL_MM),
    rainFullMm: toNumber(process.env.RAIN_THRESHOLD_FULL_MM, DEFAULT_THRESHOLDS.RAIN_FULL_MM),
    aqiThreshold: toNumber(process.env.AQI_THRESHOLD, DEFAULT_THRESHOLDS.AQI_THRESHOLD),
    aqiDurationHours: toNumber(process.env.AQI_DURATION_HOURS, DEFAULT_THRESHOLDS.AQI_DURATION_HOURS),
    windThresholdKmph: toNumber(process.env.WIND_THRESHOLD_KMPH, DEFAULT_THRESHOLDS.WIND_THRESHOLD_KMPH),
    platformDowntimeHours: toNumber(process.env.PLATFORM_DOWNTIME_HOURS, DEFAULT_THRESHOLDS.PLATFORM_DOWNTIME_HOURS),
  },
  fraud: {
    softHoldMs: toNumber(process.env.SOFT_HOLD_MS, FRAUD_TIMERS.SOFT_HOLD_MS),
    stepUpTimeoutMs: toNumber(process.env.STEP_UP_TIMEOUT_MS, FRAUD_TIMERS.STEP_UP_TIMEOUT_MS),
  },
};
