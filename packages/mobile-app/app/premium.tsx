import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PremiumBreakdown } from '../components/PremiumBreakdown';
import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '../constants/Colors';
import { MOCK_PREMIUM_BREAKDOWN, MOCK_WORKER } from '../services/mockData';
import {
  getPremiumServiceBreakdown,
  getPremiumServiceWorker,
} from '../services/api';
import { getWorkerProfile, type WorkerProfile } from '../services/storage';

type PremiumBackendState = {
  base_premium: number;
  zone_multiplier: number;
  zone_adjusted: number;
  saferider_discount_pct: number;
  after_sr: number;
  dost_flat_discount: number;
  after_dost: number;
  final_premium: number;
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
};

export default function PremiumScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [worker, setWorker] = useState<WorkerProfile>(MOCK_WORKER);
  const [premium, setPremium] = useState<PremiumBackendState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getWorkerProfile();

      if (profile) {
        setWorker(profile);

        try {
          const details = await getPremiumServiceWorker(profile.worker_id);
          const breakdown = await getPremiumServiceBreakdown(profile.worker_id);
          const selected = details.data.policy?.weekly_premium ?? breakdown.data.final_premium;

          setWorker((current) => ({
            ...current,
            worker_id: details.data.worker.id,
            name: details.data.worker.name,
            platform: details.data.worker.platform,
            partner_id: current.partner_id,
            daily_wage: details.data.worker.daily_wage_est,
            zone_h3: details.data.worker.h3_zone,
            city: current.city,
            policy_id: details.data.policy?.id || current.policy_id,
            policy_status: details.data.policy?.status === 'active' ? 'ACTIVE' : current.policy_status,
            saferider_tier: details.data.saferider_score?.tier ?? current.saferider_tier,
            premium: selected,
            squad_id: details.data.dost_squad?.id ?? current.squad_id,
          }));

          setPremium(breakdown.data);
        } catch {
          setPremium(null);
        }
      }

      setLoading(false);
    };
    void loadProfile();
  }, []);

  const summaryPremium = premium?.final_premium ?? worker.premium;
  const saferiderDiscountAmount = premium ? premium.zone_adjusted - premium.after_sr : MOCK_PREMIUM_BREAKDOWN.saferider_discount;
  const dostShieldDiscountAmount = premium ? premium.dost_flat_discount : MOCK_PREMIUM_BREAKDOWN.dost_shield_discount;
  const breakdownFeatures = premium
    ? [
        { name: 'Daily wage', value: premium.shap_breakdown.features.daily_wage_est / 1000, impact: 'medium' as const },
        { name: 'Zone multiplier', value: premium.zone_multiplier - 1, impact: premium.zone_multiplier > 1.15 ? 'high' as const : 'medium' as const },
        { name: 'SafeRider tier', value: -((premium.shap_breakdown.features.saferider_tier - 1) * 0.06), impact: 'medium' as const },
        { name: 'Dost Shield', value: premium.shap_breakdown.features.in_dost_squad ? -0.1 : 0, impact: 'low' as const },
      ]
    : MOCK_PREMIUM_BREAKDOWN.features;

  const statusTextKey =
    worker.policy_status === 'ACTIVE'
      ? 'premium_page.status_active'
      : worker.policy_status === 'LAPSED'
        ? 'premium_page.status_lapsed'
        : 'premium_page.status_cancelled';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('premium_page.title')}</Text>
      <Text style={styles.subtitle}>{t('premium_page.subtitle')}</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('premium_page.current_weekly')}</Text>
          <Text style={styles.summaryValue}>₹{summaryPremium}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('premium_page.policy_status')}</Text>
          <Text style={[styles.summaryValue, worker.policy_status === 'ACTIVE' ? styles.active : styles.inactive]}>
            {t(statusTextKey)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('premium_page.zone')}</Text>
          <Text style={styles.summaryValue}>{worker.zone_h3.slice(0, 12)}...</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('premium_page.city')}</Text>
          <Text style={styles.summaryValue}>{worker.city}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <PremiumBreakdown
          base={premium?.base_premium ?? MOCK_PREMIUM_BREAKDOWN.base}
          zoneFactor={premium?.zone_multiplier ?? MOCK_PREMIUM_BREAKDOWN.zone_factor}
          zoneAdjusted={premium?.zone_adjusted ?? MOCK_PREMIUM_BREAKDOWN.zone_adjusted}
          saferiderDiscount={saferiderDiscountAmount}
          dostShieldDiscount={dostShieldDiscountAmount}
          final={summaryPremium}
          features={breakdownFeatures}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  backButton: { alignSelf: 'flex-start', marginBottom: Spacing.md },
  backText: { color: Colors.accent, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  title: { color: Colors.textPrimary, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold },
  subtitle: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  summaryValue: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  active: { color: Colors.success },
  inactive: { color: Colors.warningDark },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSizes.sm },
});
