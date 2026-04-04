import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Worker API
export const getWorkerZone = (lat: number, lng: number) =>
  api.get(`/workers/zone`, { params: { lat, lng } });

export const getWorkerZoneRisk = (workerId: string) =>
  api.get(`/workers/${workerId}/zone-risk`);

// Policy API
export const getPremiumQuote = (workerId: string, zone: string) =>
  api.get(`/policies/quote`, { params: { worker_id: workerId, zone } });

export const createPolicy = (data: {
  worker_id: string;
  zone: string;
  daily_wage: number;
  platform: string;
  upi_id: string;
}) => api.post(`/policies`, data);

// Claims API
export const getClaims = (workerId: string) =>
  api.get(`/claims`, { params: { workerId } });

export const getClaimById = (claimId: string) =>
  api.get(`/claims/${claimId}`);

export const submitStepUpVerify = (claimId: string, data: { bssids: string[] }) =>
  api.post(`/claims/${claimId}/step-up-verify`, data);

// Squad API
export const getSquad = (workerId: string) =>
  api.get(`/squads`, { params: { worker_id: workerId } });

export const joinSquad = (workerId: string, code: string) =>
  api.post(`/squads/join`, { worker_id: workerId, code });

export const createSquad = (workerId: string, zone: string) =>
  api.post(`/squads`, { worker_id: workerId, zone });

export default api;
