import axios from 'axios';
import { config } from '@kawaachai/shared';
import { SourceReading } from '../services/threshold-engine';

const api = axios.create({ timeout: 4500 });

export class CpcbClient {
  private baseUrl = process.env.CPCB_BASE_URL ?? '';

  async getAqi(lat: number, lng: number): Promise<SourceReading> {
    if (!config.cpcbApiKey || !this.baseUrl) {
      return { source: 'cpcb', rainfall_mm: null, wind_kmph: null, aqi: null };
    }

    const response = await api.get(`${this.baseUrl}/aqi`, {
      params: {
        lat,
        lng,
        api_key: config.cpcbApiKey,
      },
    });

    return {
      source: 'cpcb',
      rainfall_mm: null,
      wind_kmph: null,
      aqi: Number(response.data?.aqi ?? null),
    };
  }
}
