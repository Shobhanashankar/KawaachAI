import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

interface SafeRiderBadgeProps {
  tier: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SafeRiderBadge: React.FC<SafeRiderBadgeProps> = ({ tier, size = 'md' }) => {
  const { t } = useTranslation();
  const tierColor = Colors.tierColors[tier - 1] || Colors.textMuted;
  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  if (isSmall) {
    return (
      <View style={styles.badgeTopRight}>
        <Image
          source={require('../assets/images/Icon1.png')}
          style={styles.topRightIcon}
          resizeMode="contain"
        />
        <Text style={[styles.topRightTier, { color: tierColor }]}>
          {t('home.saferider_tier')} {tier}
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.badge,
      { borderColor: tierColor },
      isLarge && styles.badgeLarge,
    ]}>
      <Image
        source={require('../assets/images/Icon1.png')}
        style={[styles.iconImage, isLarge && styles.iconImageLarge]}
        resizeMode="contain"
      />
      <View style={styles.textWrap}>
        <Text style={[styles.tierText, { color: tierColor }, isSmall && styles.tierTextSmall]}>
          {t('home.saferider_tier')} {tier}
        </Text>
        <Text numberOfLines={1} style={[styles.labelText, isSmall && styles.labelSmall]}>
          {t(`home.tier_labels.${tier}`)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  badgeLarge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  badgeTopRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minWidth: 92,
  },
  topRightIcon: {
    width: 56,
    height: 56,
    marginBottom: 4,
  },
  topRightTier: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  iconImage: { width: 24, height: 24 },
  iconImageLarge: { width: 36, height: 36 },
  textWrap: { minWidth: 0, flexShrink: 1 },
  tierText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  tierTextSmall: { fontSize: 10 },
  labelText: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  labelSmall: { fontSize: 9 },
});
