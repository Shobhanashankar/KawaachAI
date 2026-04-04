import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

interface Claim {
  id: string;
  trigger_type: string;
  status: string;
  payout_amount: number;
  created_at: string;
  rba_outcome?: string;
}

interface ClaimTimelineProps {
  claims: Claim[];
}

const STATUS_ICONS: Record<string, string> = {
  APPROVED: '✅', AUTO_APPROVED: '✅',
  SOFT_HOLD: '⏳', STEP_UP: '🔍',
  MANUAL_REVIEW: '📋', REJECTED: '❌',
  PENDING_FRAUD_CHECK: '🔄', FNOL_SUBMITTED: '📤',
  PAYOUT_QUEUED: '💸',
};

const TRIGGER_ICONS: Record<string, string> = {
  RAIN: '🌧️', AQI: '💨', WIND: '🌪️',
  CURFEW: '🚫', PLATFORM_DOWN: '📱',
};

export const ClaimTimeline: React.FC<ClaimTimelineProps> = ({ claims }) => {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {claims.map((claim, index) => {
        const statusColor = Colors.statusColors[claim.status] || Colors.textMuted;
        const isLast = index === claims.length - 1;

        return (
          <View key={claim.id} style={styles.item}>
            {/* Timeline line */}
            <View style={styles.timelineCol}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              {!isLast && <View style={[styles.line, { backgroundColor: Colors.border }]} />}
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.triggerIcon}>{TRIGGER_ICONS[claim.trigger_type]}</Text>
                <Text style={styles.triggerLabel}>
                  {t(`claims.trigger_type.${claim.trigger_type}`)}
                </Text>
                <Text style={styles.date}>{formatDate(claim.created_at)}</Text>
              </View>

              <View style={[styles.card, { borderLeftColor: statusColor }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.statusIcon}>{STATUS_ICONS[claim.status]}</Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {t(`claims.status.${claim.status}`)}
                  </Text>
                  <Text style={styles.time}>{formatTime(claim.created_at)}</Text>
                </View>

                <Text style={styles.payout}>₹{claim.payout_amount}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { flexDirection: 'row', paddingBottom: Spacing.md },
  timelineCol: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { width: 2, flex: 1, marginTop: 4 },
  content: { flex: 1, marginLeft: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  triggerIcon: { fontSize: 16 },
  triggerLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium, flex: 1, textTransform: 'capitalize' },
  date: { color: Colors.textMuted, fontSize: FontSizes.xs },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderLeftWidth: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusIcon: { fontSize: 14 },
  statusText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, flex: 1 },
  time: { color: Colors.textMuted, fontSize: FontSizes.xs },
  payout: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold, marginTop: Spacing.sm },
});
