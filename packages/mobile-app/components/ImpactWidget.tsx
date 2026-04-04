import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

interface ImpactWidgetProps {
  totalProtected: number;
  totalPremiums: number;
}

export const ImpactWidget: React.FC<ImpactWidgetProps> = ({ totalProtected, totalPremiums }) => {
  const { t } = useTranslation();
  const netBenefit = totalProtected - totalPremiums;
  const ratio = totalPremiums > 0 ? (totalProtected / totalPremiums).toFixed(1) : '∞';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.impact_title')}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('home.total_protected')}</Text>
          <Text style={[styles.statValue, { color: Colors.success }]}>₹{totalProtected.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('home.total_premiums')}</Text>
          <Text style={[styles.statValue, { color: Colors.warningDark }]}>₹{totalPremiums.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={styles.benefitRow}>
        <View style={[styles.benefitBadge, netBenefit >= 0 ? styles.positive : styles.negative]}>
          <Text style={styles.benefitIcon}>{netBenefit >= 0 ? '📈' : '📉'}</Text>
          <View>
            <Text style={styles.benefitLabel}>{t('home.net_benefit')}</Text>
            <Text style={[styles.benefitValue, { color: netBenefit >= 0 ? Colors.success : Colors.error }]}>
              {netBenefit >= 0 ? '+' : ''}₹{netBenefit.toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={styles.ratioText}>{t('home.ratio_return', { ratio })}</Text>
        </View>
      </View>

      {/* Visual bar */}
      <View style={styles.barContainer}>
        <View style={styles.barBg}>
          <View style={[styles.barProtected, { width: '100%' }]} />
          <View
            style={[
              styles.barPremium,
              {
                width: totalProtected > 0 ? `${Math.min((totalPremiums / totalProtected) * 100, 100)}%` : '0%',
              },
            ]}
          />
        </View>
        <View style={styles.barLabels}>
          <Text style={[styles.barLabel, { color: Colors.success }]}>{t('home.total_protected')}</Text>
          <Text style={[styles.barLabel, { color: Colors.warningDark }]}>{t('home.total_premiums')}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, marginBottom: 2 },
  statValue: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  divider: { width: 1, height: 40, backgroundColor: Colors.border },
  benefitRow: { marginTop: Spacing.md },
  benefitBadge: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  positive: { backgroundColor: 'rgba(0, 184, 148, 0.1)', borderWidth: 1, borderColor: 'rgba(0, 184, 148, 0.3)' },
  negative: { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  benefitIcon: { fontSize: 24 },
  benefitLabel: { color: Colors.textMuted, fontSize: FontSizes.xs },
  benefitValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  ratioText: { color: Colors.textMuted, fontSize: FontSizes.sm, marginLeft: 'auto', fontWeight: FontWeights.medium },
  barContainer: { marginTop: Spacing.md },
  barBg: { height: 8, backgroundColor: Colors.surfaceLight, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  barProtected: { position: 'absolute', height: 8, backgroundColor: 'rgba(0, 184, 148, 0.4)', borderRadius: 4 },
  barPremium: { position: 'absolute', height: 8, backgroundColor: Colors.warningDark, borderRadius: 4 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLabel: { fontSize: FontSizes.xs },
});
