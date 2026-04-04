import axios from 'axios';
import { adminApiConfig } from '../config';

interface UpstreamHealth {
  service: string;
  status: 'up' | 'down';
  details?: unknown;
}

const checkService = async (service: string, url: string): Promise<UpstreamHealth> => {
  try {
    const response = await axios.get(url, { timeout: 3000 });
    return {
      service,
      status: 'up',
      details: response.data,
    };
  } catch (error) {
    return {
      service,
      status: 'down',
      details: {
        message: error instanceof Error ? error.message : 'unknown error',
      },
    };
  }
};

export const getServiceHealth = async (): Promise<UpstreamHealth[]> => {
  return Promise.all([
    checkService('trigger-monitor', `${adminApiConfig.triggerMonitorBaseUrl}/health`),
    checkService('claims-service', `${adminApiConfig.claimsServiceBaseUrl}/health`),
    Promise.resolve({ service: 'spec5-admin-api', status: 'up' as const, details: { status: 'ok' } }),
  ]);
};
