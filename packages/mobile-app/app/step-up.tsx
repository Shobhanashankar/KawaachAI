import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius, Shadows } from '../constants/Colors';
import { collectTelemetry } from '../services/telemetry';

type StepUpState = 'prompt' | 'checking' | 'approved' | 'review';

export default function StepUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<StepUpState>('prompt');

  const handleEnableWifi = async () => {
    setState('checking');

    // Simulate WiFi re-scan + BSSID collection
    await new Promise(r => setTimeout(r, 2500));
    const telemetry = await collectTelemetry('WKR-BLR-001', 'EVT-004');
    console.log('[Step-Up] Telemetry collected:', telemetry);

    // Simulate backend re-score — 70% chance of approval
    const approved = Math.random() > 0.3;
    setState(approved ? 'approved' : 'review');
  };

  const handleDone = () => {
    router.back();
  };

  if (state === 'checking') {
    return (
      <View style={styles.container}>
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.checkingText}>{t('stepup.checking')}</Text>
          <Text style={styles.checkingSub}>{t('stepup.scanning_wifi')}</Text>
        </View>
      </View>
    );
  }

  if (state === 'approved') {
    return (
      <View style={styles.container}>
        <View style={[styles.centerCard, styles.successCard]}>
          <Text style={styles.resultIcon}>✅</Text>
          <Text style={styles.resultTitle}>{t('stepup.payout_confirmed')}</Text>
          <Text style={styles.resultMsg}>{t('stepup.payout_msg', { amount: '450' })}</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state === 'review') {
    return (
      <View style={styles.container}>
        <View style={[styles.centerCard, styles.reviewCard]}>
          <Text style={styles.resultIcon}>📋</Text>
          <Text style={styles.resultTitle}>{t('stepup.under_review')}</Text>
          <Text style={styles.resultMsg}>{t('stepup.review_msg')}</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Prompt state
  return (
    <View style={styles.container}>
      <View style={styles.promptCard}>
        <Text style={styles.promptIcon}>📡</Text>
        <Text style={styles.promptTitle}>{t('stepup.title')}</Text>
        <Text style={styles.promptMsg}>{t('stepup.message')}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>{t('stepup.info_text')}</Text>
        </View>

        <TouchableOpacity style={styles.wifiButton} onPress={handleEnableWifi}>
          <Text style={styles.wifiIcon}>📶</Text>
          <Text style={styles.wifiText}>{t('stepup.enable_wifi')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: Spacing.lg },
  promptCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', ...Shadows.lg },
  promptIcon: { fontSize: 64, marginBottom: Spacing.md },
  promptTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary, textAlign: 'center' },
  promptMsg: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  infoBox: { flexDirection: 'row', backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm },
  infoIcon: { fontSize: 16 },
  infoText: { color: Colors.textMuted, fontSize: FontSizes.sm, flex: 1, lineHeight: 18 },
  wifiButton: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xl, width: '100%', ...Shadows.glow },
  wifiIcon: { fontSize: 24 },
  wifiText: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  centerCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center' },
  checkingText: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold, marginTop: Spacing.lg },
  checkingSub: { color: Colors.textMuted, fontSize: FontSizes.md, marginTop: Spacing.sm },
  successCard: { borderWidth: 1, borderColor: 'rgba(0, 184, 148, 0.3)' },
  reviewCard: { borderWidth: 1, borderColor: 'rgba(108, 92, 231, 0.3)' },
  resultIcon: { fontSize: 64, marginBottom: Spacing.md },
  resultTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  resultMsg: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  doneButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.xl },
  doneText: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
});
