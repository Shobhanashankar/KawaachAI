import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3002';
const PREMIUM_SERVICE_BASE_URL = process.env.EXPO_PUBLIC_PREMIUM_SERVICE_BASE_URL || 'http://localhost:3003';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const premiumApi = axios.create({
  baseURL: PREMIUM_SERVICE_BASE_URL,
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

export interface PremiumServiceWorkerOnboardResponse {
  worker_id: string;
  policy_id: string;
  weekly_premium: number;
  shap_breakdown: {
    base_premium: number;
    zone_contribution: number;
    saferider_contribution: number;
    dost_contribution: number;
    final_premium: number;
    features: {
      daily_wage_est: number;
      h3_zone: string;
      zone_multiplier: number;
      saferider_tier: number;
      in_dost_squad: boolean;
    };
  };
  message: string;
}

export interface PremiumServiceWorkerDetailsResponse {
  worker: {
    id: string;
    platform_worker_id: string;
    platform: 'zepto' | 'blinkit';
    name: string;
    phone: string;
    upi_id: string;
    h3_zone: string;
    daily_wage_est: number;
    mandate_status: 'pending' | 'active' | 'paused' | 'cancelled' | null;
  };
  policy: {
    id: string;
    status: 'active' | 'lapsed' | 'cancelled';
    weekly_premium: number;
    guidewire_policy_id: string | null;
  } | null;
  saferider_score: {
    tier: 1 | 2 | 3 | 4 | 5;
    consecutive_weeks: number;
    total_weeks: number;
    fraud_flags: number;
  } | null;
  dost_squad: {
    id: string;
    name: string;
    dark_store_h3: string;
    status: 'active' | 'disbanded';
    zero_claim_streak: number;
  } | null;
}

export interface PremiumServicePremiumResponse {
  worker_id: string;
  week_start: string;
  base_premium: number;
  zone_multiplier: number;
  zone_adjusted: number;
  saferider_discount_pct: number;
  after_sr: number;
  dost_flat_discount: number;
  after_dost: number;
  final_premium: number;
  shap_breakdown: PremiumServiceWorkerOnboardResponse['shap_breakdown'];
  ml_used: boolean;
}

export interface PremiumServiceMandateResponse {
  mandate_id: string;
  fund_account_id: string;
  status: string;
  message: string;
}

export const createPremiumServiceWorker = (data: {
  platform_worker_id: string;
  platform: 'zepto' | 'blinkit';
  name: string;
  phone: string;
  upi_id: string;
  h3_zone: string;
  daily_wage_est: number;
}) => premiumApi.post<PremiumServiceWorkerOnboardResponse>('/api/v1/workers', data);

export const getPremiumServiceWorker = (workerId: string) =>
  premiumApi.get<PremiumServiceWorkerDetailsResponse>(`/api/v1/workers/${workerId}`);

export const getPremiumServiceBreakdown = (workerId: string) =>
  premiumApi.get<PremiumServicePremiumResponse>(`/api/v1/workers/${workerId}/premium`);

export const createPremiumServiceMandate = (workerId: string, maxAmount: number) =>
  premiumApi.post<PremiumServiceMandateResponse>(`/api/v1/workers/${workerId}/mandate`, { max_amount: maxAmount });

export const getPremiumServiceSquad = (squadId: string) =>
  premiumApi.get<{
    squad: {
      id: string;
      name: string;
      dark_store_h3: string;
      status: 'active' | 'disbanded';
      zero_claim_streak: number;
    };
    members: Array<{
      id: string;
      squad_id: string;
      worker_id: string;
      joined_at: string;
      is_active: boolean;
      upi_id: string;
      daily_wage_est: number;
    }>;
    member_count: number;
  }>(`/api/v1/squads/${squadId}`);

// Squad API fallback remains on the claims service surface for now.
export const getSquad = (workerId: string) =>
  api.get(`/squads`, { params: { worker_id: workerId } });

export const joinSquad = (workerId: string, code: string) =>
  api.post(`/squads/join`, { worker_id: workerId, code });

export const createSquad = (workerId: string, zone: string) =>
  api.post(`/squads`, { worker_id: workerId, zone });

export default api;
