import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius, Shadows } from '../../constants/Colors';
import { SafeRiderBadge } from '../../components/SafeRiderBadge';
import { ZoneRiskBars } from '../../components/ZoneRiskBars';
import { ImpactWidget } from '../../components/ImpactWidget';
import { getWorkerProfile, type WorkerProfile } from '../../services/storage';
import { MOCK_WORKER, MOCK_ZONE_RISK, MOCK_DAILY_FORECAST } from '../../services/mockData';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerProfile>(MOCK_WORKER);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const profile = await getWorkerProfile();
    if (profile) setWorker(profile);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const forecast = MOCK_DAILY_FORECAST;
  const isActive = worker.policy_status === 'ACTIVE';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <SafeRiderBadge tier={worker.saferider_tier} size="sm" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting}>{t('home.greeting', { name: worker.name })}</Text>
          <Text style={styles.workerId}>{worker.worker_id}</Text>
        </View>
      </View>

      {/* Coverage Status Card */}
      <View style={[styles.coverageCard, isActive ? styles.coverageActive : styles.coverageLapsed]}>
        <View style={styles.coverageRow}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.error }]} />
          <Text style={styles.coverageStatus}>
            {isActive ? t('home.coverage_active') : t('home.coverage_lapsed')}
          </Text>
        </View>

        <View style={styles.coverageStats}>
          <View style={styles.coverageStat}>
            <Text style={styles.statLabel}>{t('home.protected_earnings')}</Text>
            <Text style={styles.statValue}>₹{worker.protected_earnings.toLocaleString('en-IN')}</Text>
            <Text style={styles.statSub}>{t('home.this_month')}</Text>
          </View>
          <View style={styles.coverageDivider} />
          <View style={styles.coverageStat}>
            <Text style={styles.statLabel}>{t('home.weekly_premium')}</Text>
            <Text style={styles.statValue}>₹{worker.premium}</Text>
            <Text style={styles.statSub}>{t('home.per_week')}</Text>
          </View>
        </View>
      </View>

      {/* Daily Forecast Banner */}
      <TouchableOpacity style={[
        styles.forecastBanner,
        forecast.risk_level === 'high' ? styles.forecastHigh :
        forecast.risk_level === 'moderate' ? styles.forecastModerate : styles.forecastLow,
      ]}>
        <Text style={styles.forecastIcon}>
          {forecast.risk_level === 'high' ? '🌧️' : forecast.risk_level === 'moderate' ? '⛅' : '☀️'}
        </Text>
        <View style={styles.forecastContent}>
          <Text style={styles.forecastTitle}>{t('home.daily_forecast')}</Text>
          <Text style={styles.forecastText}>{t(`home.${forecast.risk_level}_risk`)}</Text>
        </View>
        <Text style={styles.forecastPercent}>{forecast.rain_probability}%</Text>
      </TouchableOpacity>

      {/* Zone Risk Bars */}
      <ZoneRiskBars flood={MOCK_ZONE_RISK.flood} aqi={MOCK_ZONE_RISK.aqi} wind={MOCK_ZONE_RISK.wind} />

      {/* Impact Widget */}
      <View style={{ marginTop: Spacing.md }}>
        <ImpactWidget totalProtected={worker.protected_earnings} totalPremiums={worker.total_premiums_paid} />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>{t('home.quick_actions_title')}</Text>
        <View style={styles.actionRow}>
          {[
            { icon: '📋', label: t('home.quick_action_claims'), route: '/(tabs)/claims' as const },
            { icon: '👥', label: t('home.quick_action_squad'), route: '/(tabs)/squad' as const },
            { icon: '📊', label: t('home.quick_action_premium'), route: '/premium' as const },
            { icon: '❓', label: t('home.quick_action_help'), route: '/help' as const },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={styles.actionCard} onPress={() => router.push(action.route)}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  headerTextWrap: { flex: 1, minWidth: 0 },
  greeting: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  workerId: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  coverageCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.lg },
  coverageActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(0, 184, 148, 0.3)' },
  coverageLapsed: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  coverageStatus: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  coverageStats: { flexDirection: 'row', alignItems: 'center' },
  coverageStat: { flex: 1, alignItems: 'center' },
  coverageDivider: { width: 1, height: 50, backgroundColor: Colors.border },
  statLabel: { color: Colors.textMuted, fontSize: FontSizes.xs },
  statValue: { color: Colors.textPrimary, fontSize: FontSizes.xxl, fontWeight: FontWeights.heavy, marginVertical: 2 },
  statSub: { color: Colors.textMuted, fontSize: FontSizes.xs },
  forecastBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  forecastHigh: { backgroundColor: 'rgba(255, 107, 107, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  forecastModerate: { backgroundColor: 'rgba(253, 203, 110, 0.15)', borderWidth: 1, borderColor: 'rgba(253, 203, 110, 0.3)' },
  forecastLow: { backgroundColor: 'rgba(0, 184, 148, 0.15)', borderWidth: 1, borderColor: 'rgba(0, 184, 148, 0.3)' },
  forecastIcon: { fontSize: 28 },
  forecastContent: { flex: 1 },
  forecastTitle: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  forecastText: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  forecastPercent: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  quickActions: { marginTop: Spacing.lg },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadows.sm },
  actionIcon: { fontSize: 28, marginBottom: Spacing.xs },
  actionLabel: { color: Colors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.medium },
});
