import axios from 'axios';
import { config } from '@kawaachai/shared';
import { SourceReading } from '../services/threshold-engine';

const api = axios.create({
  timeout: 4500,
});

export class TomorrowIoClient {
  async getWeather(lat: number, lng: number): Promise<SourceReading> {
    if (!config.tomorrowIoApiKey) {
      return { source: 'tomorrow_io', rainfall_mm: null, wind_kmph: null, aqi: null };
    }

    const response = await api.get('https://api.tomorrow.io/v4/weather/realtime', {
      params: {
        location: `${lat},${lng}`,
        apikey: config.tomorrowIoApiKey,
        units: 'metric',
      },
    });

    const values = response.data?.data?.values ?? {};
    const rainMmPerHour = Number(values.rainIntensity ?? values.precipitationIntensity ?? 0);
    const windKmph = Number(values.windSpeed ?? 0) * 3.6;

    return {
      source: 'tomorrow_io',
      rainfall_mm: Number.isFinite(rainMmPerHour) ? rainMmPerHour * 24 : null,
      wind_kmph: Number.isFinite(windKmph) ? windKmph : null,
      aqi: null,
    };
  }
}
