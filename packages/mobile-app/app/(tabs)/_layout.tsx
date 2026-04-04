import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontSizes, FontWeights } from '../../constants/Colors';

const TabIcon = ({ icon, label, focused }: { icon: string; label: string; focused: boolean }) => (
  <View style={styles.tabItem}>
    <Text style={[styles.icon, focused && styles.iconActive]}>{icon}</Text>
    <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label={t('tabs.home')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="claims"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" label={t('tabs.claims')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="squad"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👥" label={t('tabs.squad')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" label={t('tabs.settings')} focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  icon: { fontSize: 22 },
  iconActive: { fontSize: 24 },
  label: { fontSize: FontSizes.xs, color: Colors.textMuted },
  labelActive: { color: Colors.accent, fontWeight: FontWeights.semibold },
});
