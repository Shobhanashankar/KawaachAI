import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PremiumBreakdown } from '../components/PremiumBreakdown';
import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '../constants/Colors';
import { MOCK_PREMIUM_BREAKDOWN, MOCK_WORKER } from '../services/mockData';
import { getWorkerProfile, type WorkerProfile } from '../services/storage';

export default function PremiumScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [worker, setWorker] = useState<WorkerProfile>(MOCK_WORKER);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getWorkerProfile();
      if (profile) setWorker(profile);
    };
    loadProfile();
  }, []);

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
          <Text style={styles.summaryValue}>₹{worker.premium}</Text>
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

      <PremiumBreakdown
        base={MOCK_PREMIUM_BREAKDOWN.base}
        zoneFactor={MOCK_PREMIUM_BREAKDOWN.zone_factor}
        zoneAdjusted={MOCK_PREMIUM_BREAKDOWN.zone_adjusted}
        saferiderDiscount={MOCK_PREMIUM_BREAKDOWN.saferider_discount}
        dostShieldDiscount={MOCK_PREMIUM_BREAKDOWN.dost_shield_discount}
        final={worker.premium}
        features={MOCK_PREMIUM_BREAKDOWN.features}
      />
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
});
