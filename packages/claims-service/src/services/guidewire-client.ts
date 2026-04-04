import axios, { AxiosError } from 'axios';
import Redis from 'ioredis';
import { config, FnolPayload } from '@kawaachai/shared';

export interface GuidewireSubmissionResult {
  claimId: string;
  status: string;
}

export class GuidewireClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export class GuidewireClient {
  constructor(private readonly redis: Redis) {}

  private async getToken(): Promise<string> {
    const cacheKey = 'guidewire:oauth:token';
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    if (!config.guidewireBaseUrl || !config.guidewireClientId || !config.guidewireClientSecret) {
      return 'mock-guidewire-token';
    }

    const response = await axios.post(
      `${config.guidewireBaseUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.guidewireClientId,
        client_secret: config.guidewireClientSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 7000,
      },
    );

    const token = response.data?.access_token as string;
    const expiresIn = Number(response.data?.expires_in ?? 3600);
    const ttl = Math.max(expiresIn - 60, 60);
    await this.redis.set(cacheKey, token, 'EX', ttl);

    return token;
  }

  async submitFnol(payload: FnolPayload): Promise<GuidewireSubmissionResult> {
    if (!config.guidewireBaseUrl) {
      return {
        claimId: `mock-${payload.policy_id}-${Date.now()}`,
        status: 'OPEN',
      };
    }

    try {
      const token = await this.getToken();
      const response = await axios.post(`${config.guidewireBaseUrl}/claims/v1/fnol`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        claimId: response.data?.claim_id ?? response.data?.id ?? `gw-${Date.now()}`,
        status: response.data?.status ?? 'OPEN',
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 500;
        const message = error.response?.data?.message ?? error.message;
        throw new GuidewireClientError(message, status);
      }
      throw new GuidewireClientError('Unknown Guidewire error', 500);
    }
  }
}
