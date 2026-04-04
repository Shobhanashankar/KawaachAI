const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const adminApiConfig = {
  port: toNumber(process.env.SPEC5_ADMIN_API_PORT, 3010),
  adminBearerToken: process.env.ADMIN_BEARER_TOKEN ?? 'change-me',
  claimsServiceBaseUrl: process.env.CLAIMS_BASE_URL ?? 'http://localhost:3002',
  triggerMonitorBaseUrl: process.env.TRIGGER_BASE_URL ?? 'http://localhost:3001',
  llmProvider: process.env.SPEC5_LLM_PROVIDER ?? 'groq',
  llmModel: process.env.SPEC5_LLM_MODEL ?? 'llama-3.1-8b-instant',
  llmApiKey: process.env.SPEC5_LLM_API_KEY ?? '',
  llmTimeoutMs: toNumber(process.env.SPEC5_LLM_TIMEOUT_MS, 10_000),
  runSeed: toBoolean(process.env.SPEC5_RUN_SEED, true),
};
