export const TOPICS = {
  DISRUPTION_EVENTS: 'disruption-events',
  DISRUPTION_EVENTS_DLQ: 'disruption-events-dlq',
} as const;

export const DEFAULT_THRESHOLDS = {
  RAIN_PARTIAL_MM: 75,
  RAIN_FULL_MM: 100,
  AQI_THRESHOLD: 300,
  AQI_DURATION_HOURS: 3,
  WIND_THRESHOLD_KMPH: 60,
  PLATFORM_DOWNTIME_HOURS: 2,
} as const;

export const PAYOUTS = {
  RAIN_PARTIAL: 0.5,
  RAIN_FULL: 1.0,
  AQI_FULL: 1.0,
  WIND_FULL: 1.0,
  CURFEW: 0.75,
  PLATFORM_DOWN: 0.4,
} as const;

export const RBA_THRESHOLDS = {
  SOFT_HOLD: 0.4,
  STEP_UP: 0.72,
  TRUSTED_STEP_UP: 0.85,
} as const;

export const FRAUD_TIMERS = {
  SOFT_HOLD_MS: 2 * 60 * 60 * 1000,
  STEP_UP_TIMEOUT_MS: 4 * 60 * 60 * 1000,
} as const;
