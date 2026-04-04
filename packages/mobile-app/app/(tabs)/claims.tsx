import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights } from '../../constants/Colors';
import { ClaimTimeline } from '../../components/ClaimTimeline';
import { MOCK_CLAIMS } from '../../services/mockData';

export default function ClaimsScreen() {
  const { t } = useTranslation();
  const claims = MOCK_CLAIMS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('claims.title')}</Text>
        <Text style={styles.count}>{claims.length} {t('claims.title').toLowerCase()}</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
          <Text style={styles.summaryValue}>
            {claims.filter(c => c.status === 'APPROVED').length}
          </Text>
          <Text style={styles.summaryLabel}>{t('claims.summary_approved')}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.warning }]}>
          <Text style={styles.summaryValue}>
            {claims.filter(c => ['SOFT_HOLD', 'PENDING_FRAUD_CHECK'].includes(c.status)).length}
          </Text>
          <Text style={styles.summaryLabel}>{t('claims.summary_processing')}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.warningDark }]}>
          <Text style={styles.summaryValue}>
            {claims.filter(c => c.status === 'STEP_UP').length}
          </Text>
          <Text style={styles.summaryLabel}>{t('claims.summary_verify')}</Text>
        </View>
      </View>

      {/* Total Payout */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('claims.total_payout')}</Text>
        <Text style={styles.totalValue}>
          ₹{claims.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + c.payout_amount, 0).toLocaleString('en-IN')}
        </Text>
      </View>

      {/* Timeline */}
      {claims.length > 0 ? (
        <View style={styles.timeline}>
          <ClaimTimeline claims={claims} />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>{t('claims.no_claims')}</Text>
          <Text style={styles.emptyDesc}>{t('claims.no_claims_desc')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  count: { fontSize: FontSizes.sm, color: Colors.textMuted },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderLeftWidth: 3, alignItems: 'center' },
  summaryValue: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  summaryLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.lg },
  totalLabel: { color: Colors.textSecondary, fontSize: FontSizes.md },
  totalValue: { color: Colors.success, fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  timeline: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSizes.md, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});
