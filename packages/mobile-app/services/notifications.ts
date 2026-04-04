/**
 * FCM Push Notification management.
 * Handles token registration, refresh, and notification handlers.
 * Demo mode — logs notifications to console.
 */

import { clearStoredFCMToken, setStoredFCMToken } from './storage';

export interface NotificationPayload {
  type: 'COVERAGE_ACTIVATED' | 'CLAIM_APPROVED' | 'SOFT_HOLD' | 'STEP_UP' |
        'PAYOUT_CREDITED' | 'PREMIUM_DEDUCTED' | 'PREMIUM_FAILED' |
        'DAILY_FORECAST' | 'DISRUPTION_ACTIVE';
  title: string;
  body: string;
  data?: Record<string, string>;
}

let fcmToken: string | null = null;

/**
 * Register for push notifications.
 * In demo mode, generates a mock FCM token.
 */
export const registerForPushNotifications = async (): Promise<string> => {
  // Demo: generate a mock token
  fcmToken = `fcm_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await setStoredFCMToken(fcmToken);
  console.log('[FCM] Token registered:', fcmToken);
  return fcmToken;
};

/**
 * Deregister current push token.
 */
export const deregisterPushNotifications = async (): Promise<void> => {
  if (fcmToken) {
    console.log('[FCM] Token deregistered:', fcmToken);
  }
  fcmToken = null;
  await clearStoredFCMToken();
};

/**
 * Get current FCM token
 */
export const getFCMToken = (): string | null => fcmToken;

/**
 * Handle incoming notification
 */
export const handleNotification = (payload: NotificationPayload): void => {
  console.log('[FCM] Notification received:', payload);

  switch (payload.type) {
    case 'STEP_UP':
      // Navigate to step-up modal
      console.log('[FCM] Navigate to step-up verification');
      break;
    case 'DISRUPTION_ACTIVE':
      // Trigger telemetry collection
      console.log('[FCM] Disruption active — triggering telemetry');
      break;
    case 'CLAIM_APPROVED':
    case 'PAYOUT_CREDITED':
      // Show success notification
      console.log('[FCM] Payout notification');
      break;
    default:
      console.log('[FCM] Generic notification');
  }
};

/**
 * Simulate a push notification for demo purposes
 */
export const simulateNotification = (type: NotificationPayload['type'], data?: Record<string, string>): void => {
  const notifications: Record<string, Pick<NotificationPayload, 'title' | 'body'>> = {
    COVERAGE_ACTIVATED: { title: 'Coverage Active! 🛡️', body: 'Your insurance coverage is now active.' },
    CLAIM_APPROVED: { title: 'Claim Approved! 💰', body: `₹${data?.amount || '450'} credited to your UPI.` },
    SOFT_HOLD: { title: 'Claim Received', body: 'Processing your claim. This may take a short time.' },
    STEP_UP: { title: 'Quick Check Needed', body: 'Enable WiFi for a location verification.' },
    PAYOUT_CREDITED: { title: 'Payout Credited! ✅', body: `₹${data?.amount || '450'} in your account.` },
    PREMIUM_DEDUCTED: { title: 'Premium Deducted', body: `₹${data?.amount || '69'} weekly premium deducted.` },
    PREMIUM_FAILED: { title: 'Premium Failed ⚠️', body: 'Weekly premium deduction failed. Check UPI.' },
    DAILY_FORECAST: { title: 'Today\'s Forecast 🌧️', body: 'High rain risk in your zone today.' },
    DISRUPTION_ACTIVE: { title: 'Disruption Detected! ⚡', body: 'Heavy rain detected in your zone.' },
  };

  const notif = notifications[type] || { title: 'Notification', body: 'New notification' };
  handleNotification({ type, ...notif, data });
};
