import axios from 'axios';
import { config } from '@kawaachai/shared';
import { SourceReading } from '../services/threshold-engine';

const api = axios.create({ timeout: 4500 });

export class ImdClient {
  private baseUrl = process.env.IMD_BASE_URL ?? '';

  async getWeather(lat: number, lng: number): Promise<SourceReading> {
    if (!config.imdApiKey || !this.baseUrl) {
      return { source: 'imd', rainfall_mm: null, wind_kmph: null, aqi: null };
    }

    const response = await api.get(`${this.baseUrl}/weather`, {
      params: {
        lat,
        lng,
      },
      headers: {
        Authorization: `Bearer ${config.imdApiKey}`,
      },
    });

    return {
      source: 'imd',
      rainfall_mm: Number(response.data?.rainfall_mm ?? null),
      wind_kmph: Number(response.data?.wind_kmph ?? null),
      aqi: Number(response.data?.aqi ?? null),
    };
  }
}
