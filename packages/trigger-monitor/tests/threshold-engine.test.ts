import { describe, expect, it } from 'vitest';
import { evaluateWeatherConsensus } from '../src/services/threshold-engine';

const thresholds = {
  rainPartialMm: 75,
  rainFullMm: 100,
  aqiThreshold: 300,
  windThresholdKmph: 60,
};

describe('evaluateWeatherConsensus', () => {
  it('returns null when rainfall is below partial threshold', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 60, wind_kmph: 20, aqi: null },
        { source: 'b', rainfall_mm: 70, wind_kmph: 25, aqi: null },
        { source: 'c', rainfall_mm: 74, wind_kmph: 30, aqi: null },
      ],
      thresholds,
    );

    expect(result).toBeNull();
  });

  it('triggers partial rain at threshold with two sources', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 75, wind_kmph: 20, aqi: null },
        { source: 'b', rainfall_mm: 80, wind_kmph: 25, aqi: null },
        { source: 'c', rainfall_mm: 70, wind_kmph: 30, aqi: null },
      ],
      thresholds,
    );

    expect(result?.trigger_type).toBe('RAIN');
    expect(result?.severity).toBe('PARTIAL');
    expect(result?.payout_pct).toBe(0.5);
  });

  it('triggers full rain above full threshold with two sources', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 101, wind_kmph: 20, aqi: null },
        { source: 'b', rainfall_mm: 125, wind_kmph: 25, aqi: null },
        { source: 'c', rainfall_mm: 85, wind_kmph: 30, aqi: null },
      ],
      thresholds,
    );

    expect(result?.trigger_type).toBe('RAIN');
    expect(result?.severity).toBe('FULL');
    expect(result?.payout_pct).toBe(1);
  });

  it('returns null when wind is below threshold', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 20, wind_kmph: 45, aqi: null },
        { source: 'b', rainfall_mm: 20, wind_kmph: 58, aqi: null },
        { source: 'c', rainfall_mm: 20, wind_kmph: 59, aqi: null },
      ],
      thresholds,
    );

    expect(result).toBeNull();
  });

  it('triggers wind full at threshold with two sources', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 20, wind_kmph: 60, aqi: null },
        { source: 'b', rainfall_mm: 20, wind_kmph: 65, aqi: null },
        { source: 'c', rainfall_mm: 20, wind_kmph: 50, aqi: null },
      ],
      thresholds,
    );

    expect(result?.trigger_type).toBe('WIND');
    expect(result?.severity).toBe('FULL');
    expect(result?.payout_pct).toBe(1);
  });

  it('selects max payout when both rain partial and wind are triggered', () => {
    const result = evaluateWeatherConsensus(
      [
        { source: 'a', rainfall_mm: 80, wind_kmph: 61, aqi: null },
        { source: 'b', rainfall_mm: 85, wind_kmph: 62, aqi: null },
        { source: 'c', rainfall_mm: 60, wind_kmph: 40, aqi: null },
      ],
      thresholds,
    );

    expect(result?.trigger_type).toBe('WIND');
    expect(result?.payout_pct).toBe(1);
  });
});
