import { PAYOUTS, TriggerType } from '@kawaachai/shared';

export interface SourceReading {
  source: string;
  rainfall_mm: number | null;
  wind_kmph: number | null;
  aqi: number | null;
}

export interface Thresholds {
  rainPartialMm: number;
  rainFullMm: number;
  aqiThreshold: number;
  windThresholdKmph: number;
}

export interface TriggerConsensus {
  trigger_type: TriggerType;
  severity: 'PARTIAL' | 'FULL';
  payout_pct: number;
  source_apis: string[];
  raw_values: {
    rainfall_mm: number | null;
    wind_kmph: number | null;
    aqi: number | null;
  };
}

const average = (values: Array<number | null>): number | null => {
  const filtered = values.filter((v): v is number => typeof v === 'number');
  if (!filtered.length) return null;
  return filtered.reduce((sum, item) => sum + item, 0) / filtered.length;
};

const byThreshold = (
  readings: SourceReading[],
  field: 'rainfall_mm' | 'wind_kmph' | 'aqi',
  threshold: number,
): SourceReading[] => {
  return readings.filter((reading) => {
    const value = reading[field];
    return typeof value === 'number' && value >= threshold;
  });
};

const chooseHighestPayout = (items: TriggerConsensus[]): TriggerConsensus | null => {
  if (!items.length) return null;
  return [...items].sort((a, b) => b.payout_pct - a.payout_pct)[0] ?? null;
};

export const evaluateWeatherConsensus = (
  readings: SourceReading[],
  thresholds: Thresholds,
): TriggerConsensus | null => {
  const candidates: TriggerConsensus[] = [];

  const rainFull = byThreshold(readings, 'rainfall_mm', thresholds.rainFullMm);
  if (rainFull.length >= 2) {
    candidates.push({
      trigger_type: 'RAIN',
      severity: 'FULL',
      payout_pct: PAYOUTS.RAIN_FULL,
      source_apis: rainFull.map((item) => item.source),
      raw_values: {
        rainfall_mm: average(rainFull.map((item) => item.rainfall_mm)),
        wind_kmph: null,
        aqi: null,
      },
    });
  }

  const rainPartial = byThreshold(readings, 'rainfall_mm', thresholds.rainPartialMm);
  if (rainPartial.length >= 2) {
    candidates.push({
      trigger_type: 'RAIN',
      severity: 'PARTIAL',
      payout_pct: PAYOUTS.RAIN_PARTIAL,
      source_apis: rainPartial.map((item) => item.source),
      raw_values: {
        rainfall_mm: average(rainPartial.map((item) => item.rainfall_mm)),
        wind_kmph: null,
        aqi: null,
      },
    });
  }

  const windFull = byThreshold(readings, 'wind_kmph', thresholds.windThresholdKmph);
  if (windFull.length >= 2) {
    candidates.push({
      trigger_type: 'WIND',
      severity: 'FULL',
      payout_pct: PAYOUTS.WIND_FULL,
      source_apis: windFull.map((item) => item.source),
      raw_values: {
        rainfall_mm: null,
        wind_kmph: average(windFull.map((item) => item.wind_kmph)),
        aqi: null,
      },
    });
  }

  return chooseHighestPayout(candidates);
};

export const evaluateAqiConsensus = (
  readings: SourceReading[],
  thresholds: Thresholds,
): TriggerConsensus | null => {
  const aqiBreaches = byThreshold(readings, 'aqi', thresholds.aqiThreshold + 1);
  if (aqiBreaches.length < 2) return null;

  return {
    trigger_type: 'AQI',
    severity: 'FULL',
    payout_pct: PAYOUTS.AQI_FULL,
    source_apis: aqiBreaches.map((item) => item.source),
    raw_values: {
      rainfall_mm: null,
      wind_kmph: null,
      aqi: average(aqiBreaches.map((item) => item.aqi)),
    },
  };
};
