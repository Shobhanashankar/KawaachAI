/**
 * AsyncStorage-based state persistence for onboarding, worker profile, and auth.
 * Falls back to in-memory storage for web.
 */

let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Web fallback: in-memory
  const memoryStore: Record<string, string> = {};
  AsyncStorage = {
    getItem: async (key: string) => memoryStore[key] ?? null,
    setItem: async (key: string, value: string) => { memoryStore[key] = value; },
    removeItem: async (key: string) => { delete memoryStore[key]; },
    clear: async () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
  };
}

const KEYS = {
  ONBOARDING_STEP: 'kawaach_onboarding_step',
  ONBOARDING_DATA: 'kawaach_onboarding_data',
  WORKER_PROFILE: 'kawaach_worker_profile',
  AUTH_TOKEN: 'kawaach_auth_token',
  LANGUAGE: 'kawaach_language',
  FCM_TOKEN: 'kawaach_fcm_token',
} as const;

export interface OnboardingData {
  name?: string;
  phone?: string;
  aadhaar?: string;
  otp_verified?: boolean;
  platform?: 'zepto' | 'blinkit';
  partner_id?: string;
  worker_id?: string;
  daily_wage?: number;
  zone_h3?: string;
  city?: string;
  lat?: number;
  lng?: number;
  risk_multiplier?: number;
  premium?: number;
  premium_breakdown?: {
    base: number;
    zone_factor: number;
    saferider_discount: number;
    final: number;
  };
  upi_id?: string;
  policy_id?: string;
}

export interface WorkerProfile {
  worker_id: string;
  name: string;
  phone?: string;
  platform: 'zepto' | 'blinkit';
  partner_id: string;
  daily_wage: number;
  zone_h3: string;
  city: string;
  policy_id: string;
  policy_status: 'ACTIVE' | 'LAPSED' | 'CANCELLED';
  saferider_tier: number;
  premium: number;
  protected_earnings: number;
  total_premiums_paid: number;
  squad_id?: string;
}

// Onboarding State
export const getOnboardingStep = async (): Promise<number> => {
  const step = await AsyncStorage.getItem(KEYS.ONBOARDING_STEP);
  return step ? parseInt(step, 10) : 0;
};

export const setOnboardingStep = async (step: number): Promise<void> => {
  await AsyncStorage.setItem(KEYS.ONBOARDING_STEP, String(step));
};

export const getOnboardingData = async (): Promise<OnboardingData> => {
  const data = await AsyncStorage.getItem(KEYS.ONBOARDING_DATA);
  return data ? JSON.parse(data) : {};
};

export const setOnboardingData = async (data: OnboardingData): Promise<void> => {
  await AsyncStorage.setItem(KEYS.ONBOARDING_DATA, JSON.stringify(data));
};

export const clearOnboarding = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEYS.ONBOARDING_STEP);
  await AsyncStorage.removeItem(KEYS.ONBOARDING_DATA);
};

// Worker Profile
export const getWorkerProfile = async (): Promise<WorkerProfile | null> => {
  const data = await AsyncStorage.getItem(KEYS.WORKER_PROFILE);
  return data ? JSON.parse(data) : null;
};

export const setWorkerProfile = async (profile: WorkerProfile): Promise<void> => {
  await AsyncStorage.setItem(KEYS.WORKER_PROFILE, JSON.stringify(profile));
};

// Language
export const getLanguage = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LANGUAGE);
};

export const setLanguage = async (lang: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
};

// Push token
export const getStoredFCMToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.FCM_TOKEN);
};

export const setStoredFCMToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.FCM_TOKEN, token);
};

export const clearStoredFCMToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEYS.FCM_TOKEN);
};

// Auth
export const getAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
};

export const setAuthToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
};

export const clearAll = async (): Promise<void> => {
  await AsyncStorage.clear();
};
