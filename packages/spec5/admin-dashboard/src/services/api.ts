import axios from 'axios';
import {
  ClaimRow,
  DashboardKpis,
  ExclusionState,
  FraudRing,
  HeatmapZone,
  LayerStat,
  LlmReviewPayload,
  ServiceHealthRow,
} from '../types';

const baseURL = import.meta.env.VITE_ADMIN_API_BASE_URL ?? 'http://localhost:3010';
const bearerToken = import.meta.env.VITE_ADMIN_BEARER_TOKEN ?? 'change-me';
const adminUser = import.meta.env.VITE_ADMIN_USER ?? 'admin-ui';

const api = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    Authorization: `Bearer ${bearerToken}`,
    'x-admin-user': adminUser,
  },
});

export const getKpis = async (): Promise<DashboardKpis> => {
  const { data } = await api.get<DashboardKpis>('/admin/kpis');
  return data;
};

export const getClaims = async (params?: { limit?: number; status?: string[] }): Promise<ClaimRow[]> => {
  const { data } = await api.get<{ claims: ClaimRow[] }>('/admin/claims', {
    params: {
      limit: params?.limit ?? 50,
      status: params?.status?.join(','),
    },
  });

  return data.claims;
};

export const getClaimDetail = async (claimId: string): Promise<ClaimRow & { latest_llm_review?: unknown }> => {
  const { data } = await api.get<ClaimRow & { latest_llm_review?: unknown }>(`/admin/claims/${claimId}`);
  return data;
};

export const getHeatmap = async (): Promise<HeatmapZone[]> => {
  const { data } = await api.get<{ zones: HeatmapZone[] }>('/admin/heatmap');
  return data.zones;
};

export const getLayerStats = async (): Promise<LayerStat[]> => {
  const { data } = await api.get<{ stats: LayerStat[] }>('/admin/fraud/layer-stats');
  return data.stats;
};

export const getFraudRings = async (): Promise<FraudRing[]> => {
  const { data } = await api.get<{ rings: FraudRing[] }>('/admin/fraud/rings');
  return data.rings;
};

export const getServiceHealth = async (): Promise<ServiceHealthRow[]> => {
  const { data } = await api.get<{ services: ServiceHealthRow[] }>('/admin/service-health');
  return data.services;
};

export const getExclusions = async (): Promise<ExclusionState> => {
  const { data } = await api.get<ExclusionState>('/admin/exclusions');
  return data;
};

export const updateExclusions = async (payload: Partial<ExclusionState> & { reason?: string }): Promise<ExclusionState> => {
  const { data } = await api.patch<ExclusionState>('/admin/exclusions', payload);
  return data;
};

export const runLlmReview = async (claimId: string): Promise<LlmReviewPayload> => {
  const { data } = await api.post<LlmReviewPayload>(`/admin/claims/${claimId}/llm-review`);
  return data;
};

export const saveDecision = async (
  claimId: string,
  payload: { decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO'; reason: string },
): Promise<void> => {
  await api.patch(`/admin/claims/${claimId}/decision`, payload);
};

export const getMetricsRaw = async (): Promise<string> => {
  const { data } = await api.get('/metrics', {
    responseType: 'text',
  });
  return data as string;
};
