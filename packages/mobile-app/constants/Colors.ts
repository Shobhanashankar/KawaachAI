/**
 * KawaachAI Design System — Colors, Spacing, Typography
 * Premium dark theme with vibrant accent colors.
 */

export const Colors = {
  // Core brand
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#4834D4',

  // Accent
  accent: '#00D2D3',
  accentLight: '#7EFFF5',
  accentDark: '#01A3A4',

  // Status colors
  success: '#00B894',
  successLight: '#55EFC4',
  warning: '#FDCB6E',
  warningDark: '#E17055',
  error: '#FF6B6B',
  errorLight: '#FF8A8A',

  // Backgrounds
  background: '#0A0E1A',
  backgroundLight: '#12162B',
  surface: '#1A1F36',
  surfaceLight: '#242B4A',
  surfaceElevated: '#2D3561',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B8C1D9',
  textMuted: '#6B7394',
  textInverse: '#0A0E1A',

  // Borders
  border: '#2D3561',
  borderLight: '#3D4578',

  // Gradients
  gradientStart: '#6C5CE7',
  gradientEnd: '#00D2D3',

  // SafeRider tier colors
  tierColors: ['#6B7394', '#00B894', '#00D2D3', '#6C5CE7', '#FDCB6E'] as const,

  // Claim status colors
  statusColors: {
    APPROVED: '#00B894',
    AUTO_APPROVED: '#00B894',
    SOFT_HOLD: '#FDCB6E',
    STEP_UP: '#E17055',
    MANUAL_REVIEW: '#6C5CE7',
    REJECTED: '#FF6B6B',
    PENDING_FRAUD_CHECK: '#B8C1D9',
    FNOL_SUBMITTED: '#00D2D3',
    PAYOUT_QUEUED: '#55EFC4',
  } as Record<string, string>,

  // Trigger type colors
  triggerColors: {
    RAIN: '#74B9FF',
    AQI: '#FDCB6E',
    WIND: '#A29BFE',
    CURFEW: '#FF6B6B',
    PLATFORM_DOWN: '#E17055',
  } as Record<string, string>,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  hero: 36,
};

export const FontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
};
