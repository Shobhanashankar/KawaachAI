import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius, Shadows } from '../../constants/Colors';
import { PremiumBreakdown } from '../../components/PremiumBreakdown';
import {
  getOnboardingStep, setOnboardingStep,
  getOnboardingData, setOnboardingData,
  getLanguage, setLanguage,
  setWorkerProfile,
  type OnboardingData,
} from '../../services/storage';
import { MOCK_PREMIUM_BREAKDOWN, MOCK_WORKER } from '../../services/mockData';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';

const TOTAL_STEPS = 6;

const toPseudoH3 = (lat: number, lng: number): string => {
  const latPart = Math.abs(Math.round(lat * 1000)).toString(16).padStart(6, '0');
  const lngPart = Math.abs(Math.round(lng * 1000)).toString(16).padStart(6, '0');
  return `89${latPart}${lngPart}fffff`;
};

const inferCity = (lat: number, lng: number): string => {
  if (lat > 12.7 && lat < 13.2 && lng > 77.3 && lng < 77.8) return 'Bengaluru';
  if (lat > 18.8 && lat < 19.4 && lng > 72.6 && lng < 73.1) return 'Mumbai';
  if (lat > 28.4 && lat < 28.9 && lng > 76.8 && lng < 77.5) return 'Delhi';
  return 'Unknown';
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const fadeAnim = useState(new Animated.Value(1))[0];

  // OTP state
  const [name, setName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Gig account state
  const [platform, setPlatform] = useState<'zepto' | 'blinkit'>('zepto');
  const [partnerId, setPartnerId] = useState('');
  const [dailyWage, setDailyWage] = useState('');

  // UPI state
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    const loadState = async () => {
      const savedStep = await getOnboardingStep();
      const savedData = await getOnboardingData();
      const savedLanguage = await getLanguage();

      if (savedStep >= 0) setStep(savedStep);
      if (savedLanguage) {
        setSelectedLanguage(savedLanguage);
      } else {
        setSelectedLanguage('en');
      }

      if (savedData) {
        setData(savedData);
        if (savedData.name) setName(savedData.name);
        if (savedData.aadhaar) setAadhaar(savedData.aadhaar);
        if (savedData.platform) setPlatform(savedData.platform);
        if (savedData.partner_id) setPartnerId(savedData.partner_id);
        if (savedData.daily_wage) setDailyWage(String(savedData.daily_wage));
      }
    };
    loadState();
  }, []);

  const animateTransition = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  };

  const saveProgress = async (nextStep: number, newData: Partial<OnboardingData>) => {
    const updated = { ...data, ...newData };
    setData(updated);
    await setOnboardingData(updated);
    await setOnboardingStep(nextStep);
    animateTransition(nextStep);
  };

  const handleLanguageSelect = async (langCode: string) => {
    setSelectedLanguage(langCode);
    await i18n.changeLanguage(langCode);
  };

  const handleLanguageContinue = async () => {
    await setLanguage(selectedLanguage);
    await saveProgress(1, {});
  };

  // Step 1: Aadhaar + OTP
  const handleSendOtp = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error_title'), t('onboarding.errors.invalid_name'));
      return;
    }
    if (aadhaar.replace(/\s/g, '').length !== 12) {
      Alert.alert(t('common.error_title'), t('onboarding.errors.invalid_aadhaar'));
      return;
    }
    setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    if (otp === '123456') {
      await saveProgress(2, {
        name: name.trim(),
        aadhaar: aadhaar.replace(/\s/g, ''),
        otp_verified: true,
      });
    } else {
      Alert.alert(t('common.error_title'), t('onboarding.errors.invalid_otp'));
    }
  };

  // Step 2: Gig Account
  const handleGigAccount = async () => {
    if (!partnerId.trim()) {
      Alert.alert(t('common.error_title'), t('onboarding.errors.partner_id_required'));
      return;
    }
    const wage = parseInt(dailyWage, 10);
    if (!wage || wage < 200 || wage > 1000) {
      Alert.alert(t('common.error_title'), t('onboarding.errors.invalid_daily_wage'));
      return;
    }
    await saveProgress(3, { platform, partner_id: partnerId, daily_wage: wage });
  };

  // Step 3: Zone Assignment
  const handleZoneAssign = async () => {
    setLoading(true);
    try {
      let lat = 12.9716;
      let lng = 77.5946;

      try {
        const Location = require('expo-location');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(t('common.error_title'), t('onboarding.errors.location_permission_denied'));
          setLoading(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch {
        // Keep fallback coordinates for environments where location APIs are unavailable.
      }

      await saveProgress(4, {
        zone_h3: toPseudoH3(lat, lng),
        city: inferCity(lat, lng),
        lat,
        lng,
        risk_multiplier: 1.3,
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Premium Display
  const handlePremiumAccept = async () => {
    await saveProgress(5, {
      premium: MOCK_PREMIUM_BREAKDOWN.final,
      premium_breakdown: {
        base: MOCK_PREMIUM_BREAKDOWN.base,
        zone_factor: MOCK_PREMIUM_BREAKDOWN.zone_factor,
        saferider_discount: MOCK_PREMIUM_BREAKDOWN.saferider_discount,
        final: MOCK_PREMIUM_BREAKDOWN.final,
      },
    });
  };

  // Step 5: UPI AutoPay
  const handleActivate = async () => {
    if (!upiId.includes('@')) {
      Alert.alert(t('common.error_title'), t('onboarding.errors.invalid_upi'));
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));

    await setWorkerProfile({
      ...MOCK_WORKER,
      name: data.name?.trim() || name.trim() || t('onboarding.worker_default_name'),
      platform: data.platform || 'zepto',
      partner_id: data.partner_id || partnerId,
      daily_wage: data.daily_wage || parseInt(dailyWage, 10) || 450,
    });

    await setOnboardingData({ ...data, upi_id: upiId, policy_id: 'POL-2026-001' });
    await setOnboardingStep(6);
    setLoading(false);
    router.replace('/(tabs)/home');
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>{t('onboarding.progress', { current: step + 1, total: TOTAL_STEPS })}</Text>
      <View style={styles.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i <= step ? styles.progressDotActive : undefined,
              i === step ? styles.progressDotCurrent : undefined,
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>🌐</Text>
            <Text style={styles.stepTitle}>{t('onboarding.language.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.language.subtitle')}</Text>

            <View style={styles.languageList}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = selectedLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageButton, active && styles.languageButtonActive]}
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <Text style={[styles.languageNativeName, active && styles.languageTextActive]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={[styles.languageName, active && styles.languageTextActive]}>
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleLanguageContinue}>
              <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>🪪</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step1.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.step1.subtitle')}</Text>

            <Text style={styles.inputLabel}>{t('onboarding.step1.name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.step1.name_placeholder')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>{t('onboarding.step1.aadhaar_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.step1.aadhaar_placeholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={14}
              value={aadhaar}
              onChangeText={setAadhaar}
            />

            {!otpSent ? (
              <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp}>
                <Text style={styles.primaryButtonText}>{t('onboarding.step1.send_otp')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.inputLabel}>{t('onboarding.step1.otp_label')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('onboarding.step1.otp_placeholder')}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
                <Text style={styles.otpHint}>{t('onboarding.step1.otp_hint')}</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp}>
                  <Text style={styles.primaryButtonText}>{t('onboarding.step1.verify')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>🛵</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step2.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.step2.subtitle')}</Text>

            <Text style={styles.inputLabel}>{t('onboarding.step2.platform_label')}</Text>
            <View style={styles.platformRow}>
              {(['zepto', 'blinkit'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.platformButton, platform === p && styles.platformActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.platformText, platform === p && styles.platformTextActive]}>
                    {p === 'zepto' ? '⚡ Zepto' : '💛 Blinkit'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{t('onboarding.step2.partner_id_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.step2.partner_id_placeholder')}
              placeholderTextColor={Colors.textMuted}
              value={partnerId}
              onChangeText={setPartnerId}
            />

            <Text style={styles.inputLabel}>{t('onboarding.step2.daily_wage_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.step2.daily_wage_placeholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              value={dailyWage}
              onChangeText={setDailyWage}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleGigAccount}>
              <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>📍</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step3.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.step3.subtitle')}</Text>

            {data.zone_h3 ? (
              <View style={styles.zoneCard}>
                <Text style={styles.zoneAssigned}>✅ {t('onboarding.step3.zone_assigned')}</Text>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneLabel}>{t('onboarding.step3.zone_label')}</Text>
                  <Text style={styles.zoneValue}>{data.zone_h3?.slice(0, 12)}...</Text>
                </View>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneLabel}>{t('onboarding.step3.city_label')}</Text>
                  <Text style={styles.zoneValue}>{data.city}</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => animateTransition(4)}>
                  <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, styles.locationButton]}
                onPress={handleZoneAssign}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? t('common.loading') : `📍 ${t('onboarding.step3.allow_location')}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>💰</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step4.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.step4.subtitle')}</Text>

            <PremiumBreakdown
              base={MOCK_PREMIUM_BREAKDOWN.base}
              zoneFactor={MOCK_PREMIUM_BREAKDOWN.zone_factor}
              zoneAdjusted={MOCK_PREMIUM_BREAKDOWN.zone_adjusted}
              saferiderDiscount={MOCK_PREMIUM_BREAKDOWN.saferider_discount}
              dostShieldDiscount={MOCK_PREMIUM_BREAKDOWN.dost_shield_discount}
              final={MOCK_PREMIUM_BREAKDOWN.final}
              features={MOCK_PREMIUM_BREAKDOWN.features}
            />

            <TouchableOpacity style={[styles.primaryButton, { marginTop: Spacing.lg }]} onPress={handlePremiumAccept}>
              <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepIcon}>🔐</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step5.title')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.step5.subtitle')}</Text>

            <Text style={styles.inputLabel}>{t('onboarding.step5.upi_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.step5.upi_placeholder')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              value={upiId}
              onChangeText={setUpiId}
            />

            <Text style={styles.autopayNote}>
              {t('onboarding.step5.autopay_note', { amount: data.premium || MOCK_PREMIUM_BREAKDOWN.final })}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, styles.activateButton]}
              onPress={handleActivate}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? t('onboarding.step5.setting_up') : `🚀 ${t('onboarding.step5.autopay_setup')}`}
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/images/Icon1.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logo}>KawaachAI</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {renderProgressBar()}

        <Animated.View style={{ opacity: fadeAnim }}>
          {renderStep()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { alignItems: 'center', paddingTop: Spacing.xxl, marginBottom: Spacing.lg },
  logoImage: { width: 72, height: 72, marginBottom: Spacing.sm },
  logo: { fontSize: FontSizes.hero, fontWeight: FontWeights.heavy, color: Colors.textPrimary },
  tagline: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  progressContainer: { marginBottom: Spacing.lg },
  progressText: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.sm },
  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.surfaceLight },
  progressDotActive: { backgroundColor: Colors.primary },
  progressDotCurrent: { width: 28, borderRadius: 5, backgroundColor: Colors.accent },
  stepContent: { marginTop: Spacing.md },
  stepIcon: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.md },
  stepTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary, textAlign: 'center' },
  stepSubtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  inputLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSizes.lg, borderWidth: 1, borderColor: Colors.border },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, ...Shadows.md },
  primaryButtonText: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  otpHint: { color: Colors.accent, fontSize: FontSizes.sm, marginTop: Spacing.sm, textAlign: 'center' },
  platformRow: { flexDirection: 'row', gap: Spacing.md },
  platformButton: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  platformActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceLight },
  platformText: { color: Colors.textSecondary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  platformTextActive: { color: Colors.accent },
  languageList: { gap: Spacing.sm },
  languageButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  languageNativeName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  languageName: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  languageTextActive: {
    color: Colors.accent,
  },
  zoneCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  zoneAssigned: { fontSize: FontSizes.lg, color: Colors.success, fontWeight: FontWeights.bold, textAlign: 'center', marginBottom: Spacing.md },
  zoneInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  zoneLabel: { color: Colors.textSecondary, fontSize: FontSizes.md },
  zoneValue: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  locationButton: { marginTop: Spacing.xxl },
  autopayNote: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', marginTop: Spacing.md },
  activateButton: { backgroundColor: Colors.success },
});
