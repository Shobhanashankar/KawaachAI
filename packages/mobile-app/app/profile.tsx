import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '../constants/Colors';
import { MOCK_WORKER } from '../services/mockData';
import { getWorkerProfile, type WorkerProfile } from '../services/storage';

export default function ProfileScreen() {
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

  const rows = [
    { label: t('profile_page.name'), value: worker.name },
    { label: t('profile_page.worker_id'), value: worker.worker_id },
    { label: t('profile_page.platform'), value: worker.platform.toUpperCase() },
    { label: t('profile_page.partner_id'), value: worker.partner_id },
    { label: t('profile_page.daily_wage'), value: `₹${worker.daily_wage}` },
    { label: t('profile_page.city'), value: worker.city },
    { label: t('profile_page.zone'), value: worker.zone_h3 },
    { label: t('profile_page.policy_id'), value: worker.policy_id },
    { label: t('profile_page.policy_status'), value: worker.policy_status },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('profile_page.title')}</Text>
      <Text style={styles.subtitle}>{t('profile_page.subtitle')}</Text>

      <View style={styles.card}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>
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
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  row: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, marginBottom: 4 },
  rowValue: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
});
