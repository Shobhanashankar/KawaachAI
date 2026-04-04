import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

interface PremiumBreakdownProps {
  base: number;
  zoneFactor: number;
  zoneAdjusted: number;
  saferiderDiscount: number;
  dostShieldDiscount?: number;
  final: number;
  features?: Array<{ name: string; value: number; impact: 'high' | 'medium' | 'low' }>;
}

export const PremiumBreakdown: React.FC<PremiumBreakdownProps> = ({
  base, zoneFactor, zoneAdjusted, saferiderDiscount, dostShieldDiscount, final, features,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('premium.breakdown_title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('premium.base_premium')}</Text>
        <Text style={styles.value}>₹{base}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('premium.zone_risk', { factor: zoneFactor })}</Text>
        <Text style={[styles.value, { color: zoneFactor > 1 ? Colors.warning : Colors.success }]}>
          ₹{zoneAdjusted}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('premium.saferider_discount')}</Text>
        <Text style={[styles.value, styles.discount]}>
          {saferiderDiscount >= 0 ? '-' : ''}₹{Math.abs(saferiderDiscount)}
        </Text>
      </View>

      {dostShieldDiscount && dostShieldDiscount !== 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>{t('premium.dost_shield')}</Text>
          <Text style={[styles.value, styles.discount]}>
            -₹{Math.abs(dostShieldDiscount)}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.finalLabel}>{t('premium.weekly_premium')}</Text>
        <Text style={styles.finalValue}>{t('premium.weekly_premium_value', { amount: final })}</Text>
      </View>

      {features && features.length > 0 && (
        <View style={styles.shapContainer}>
          <Text style={styles.shapTitle}>{t('premium.shap_title')}</Text>
          {features.map((f, i) => (
            <View key={i} style={styles.shapRow}>
              <Text style={styles.shapLabel}>{f.name}</Text>
              <View style={styles.shapBarBg}>
                <View
                  style={[
                    styles.shapBar,
                    {
                      width: `${Math.min(Math.abs(f.value) * 200, 100)}%`,
                      backgroundColor:
                        f.value > 0
                          ? (f.impact === 'high' ? Colors.error : f.impact === 'medium' ? Colors.warning : Colors.textMuted)
                          : Colors.success,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.shapValue, { color: f.value > 0 ? Colors.warningDark : Colors.success }]}>
                {f.value > 0 ? '+' : ''}{(f.value * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: FontSizes.md },
  value: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  discount: { color: Colors.success },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  finalLabel: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  finalValue: { color: Colors.accent, fontSize: FontSizes.xl, fontWeight: FontWeights.heavy },
  shapContainer: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  shapTitle: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, letterSpacing: 1, marginBottom: Spacing.sm },
  shapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  shapLabel: { color: Colors.textSecondary, fontSize: FontSizes.xs, width: 120 },
  shapBarBg: { flex: 1, height: 6, backgroundColor: Colors.surfaceLight, borderRadius: 3, marginHorizontal: Spacing.sm },
  shapBar: { height: 6, borderRadius: 3 },
  shapValue: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, width: 40, textAlign: 'right' },
});
