import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

interface ZoneRiskBarsProps {
  flood: number;
  aqi: number;
  wind: number;
}

export const ZoneRiskBars: React.FC<ZoneRiskBarsProps> = ({ flood, aqi, wind }) => {
  const { t } = useTranslation();

  const risks = [
    { label: t('home.flood_risk'), value: flood, color: '#74B9FF', icon: '🌊' },
    { label: t('home.aqi_risk'), value: aqi, color: '#FDCB6E', icon: '💨' },
    { label: t('home.wind_risk'), value: wind, color: '#A29BFE', icon: '🌪️' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.zone_risk_title')}</Text>
      {risks.map((risk) => (
        <View key={risk.label} style={styles.riskRow}>
          <Text style={styles.icon}>{risk.icon}</Text>
          <Text style={styles.label}>{risk.label}</Text>
          <View style={styles.barContainer}>
            <View style={[styles.barBg]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${risk.value}%`,
                    backgroundColor: risk.color,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.percent, { color: risk.value > 60 ? Colors.error : risk.value > 40 ? Colors.warning : Colors.success }]}>
            {risk.value}%
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  riskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  icon: { fontSize: 18, width: 24 },
  label: { color: Colors.textSecondary, fontSize: FontSizes.md, width: 50 },
  barContainer: { flex: 1 },
  barBg: { height: 10, backgroundColor: Colors.surfaceLight, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
  percent: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, width: 40, textAlign: 'right' },
});
