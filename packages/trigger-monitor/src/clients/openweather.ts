import axios from 'axios';
import { config } from '@kawaachai/shared';
import { SourceReading } from '../services/threshold-engine';

const api = axios.create({
  timeout: 4500,
});

const mapAqiIndexToIndianScale = (owAqi: number): number => {
  if (owAqi <= 1) return 50;
  if (owAqi === 2) return 100;
  if (owAqi === 3) return 150;
  if (owAqi === 4) return 220;
  return 350;
};

export class OpenWeatherClient {
  async getWeather(lat: number, lng: number): Promise<SourceReading> {
    if (!config.openWeatherApiKey) {
      return { source: 'openweather', rainfall_mm: null, wind_kmph: null, aqi: null };
    }

    const response = await api.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat,
        lon: lng,
        appid: config.openWeatherApiKey,
        units: 'metric',
      },
    });

    const rain1h = Number(response.data?.rain?.['1h'] ?? 0);
    const rain24hApprox = rain1h * 24;
    const windSpeedMs = Number(response.data?.wind?.speed ?? 0);

    return {
      source: 'openweather',
      rainfall_mm: Number.isFinite(rain24hApprox) ? rain24hApprox : null,
      wind_kmph: Number.isFinite(windSpeedMs) ? windSpeedMs * 3.6 : null,
      aqi: null,
    };
  }

  async getAirQuality(lat: number, lng: number): Promise<SourceReading> {
    if (!config.openWeatherApiKey) {
      return { source: 'openweather', rainfall_mm: null, wind_kmph: null, aqi: null };
    }

    const response = await api.get('https://api.openweathermap.org/data/2.5/air_pollution', {
      params: {
        lat,
        lon: lng,
        appid: config.openWeatherApiKey,
      },
    });

    const aqi = Number(response.data?.list?.[0]?.main?.aqi ?? 0);
    return {
      source: 'openweather',
      rainfall_mm: null,
      wind_kmph: null,
      aqi: Number.isFinite(aqi) ? mapAqiIndexToIndianScale(aqi) : null,
    };
  }
}
