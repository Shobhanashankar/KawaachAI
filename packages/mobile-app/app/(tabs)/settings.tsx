import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../../constants/Colors';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { setLanguage, clearAll, getWorkerProfile, type WorkerProfile } from '../../services/storage';
import { MOCK_WORKER } from '../../services/mockData';
import { deregisterPushNotifications, registerForPushNotifications } from '../../services/notifications';
import i18n from '../../i18n';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [worker, setWorker] = useState<WorkerProfile>(MOCK_WORKER);
  const currentLang = i18n.language;

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getWorkerProfile();
      if (profile) setWorker(profile);
    };
    loadProfile();
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    await i18n.changeLanguage(langCode);
    await setLanguage(langCode);
    setShowLanguagePicker(false);
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logout_confirm_title'), t('settings.logout_confirm_message'), [
      { text: t('settings.logout_cancel'), style: 'cancel' },
      {
        text: t('settings.logout_confirm'),
        style: 'destructive',
        onPress: async () => {
          await deregisterPushNotifications();
          await clearAll();
          router.replace('/(auth)/onboarding');
        },
      },
    ]);
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (enabled) {
      await registerForPushNotifications();
      return;
    }
    await deregisterPushNotifications();
  };

  const handleSettingsRowPress = (key: string) => {
    if (key === 'profile') {
      router.push('/profile');
      return;
    }

    if (key === 'policy_details' || key === 'premium_history') {
      router.push('/premium');
      return;
    }

    if (key === 'help') {
      router.push('/help');
      return;
    }

    if (key === 'about') {
      Alert.alert(t('settings.about'), t('help.about_body'));
      return;
    }
  };

  const currentLangName = SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.nativeName || 'English';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowLanguagePicker(!showLanguagePicker)}>
          <Text style={styles.settingIcon}>🌐</Text>
          <Text style={styles.settingLabel}>{t('settings.language')}</Text>
          <Text style={styles.settingValue}>{currentLangName}</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {showLanguagePicker && (
          <View style={styles.languagePicker}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langOption, lang.code === currentLang && styles.langActive]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text style={[styles.langName, lang.code === currentLang && styles.langNameActive]}>
                  {lang.nativeName}
                </Text>
                <Text style={styles.langSub}>{lang.name}</Text>
                {lang.code === currentLang && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingIcon}>🔔</Text>
          <Text style={styles.settingLabel}>{t('settings.notifications')}</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: Colors.surfaceLight, true: Colors.primaryLight }}
            thumbColor={notificationsEnabled ? Colors.primary : Colors.textMuted}
          />
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>

        <View style={styles.profileCard}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.profileName}>{worker.name}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.profileMeta}>{worker.worker_id} • {worker.platform.toUpperCase()}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.profileMeta}>{worker.city}</Text>
        </View>

        {[
          { key: 'profile', icon: '👤', label: t('settings.profile') },
          { key: 'policy_details', icon: '📄', label: t('settings.policy_details') },
          { key: 'help', icon: '❓', label: t('settings.help') },
          { key: 'about', icon: 'ℹ️', label: t('settings.about') },
        ].map((item) => (
          <TouchableOpacity key={item.key} style={styles.settingRow} onPress={() => handleSettingsRowPress(item.key)}>
            <Text style={styles.settingIcon}>{item.icon}</Text>
            <Text style={styles.settingLabel}>{item.label}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>{t('settings.version', { version: '1.0.0' })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, letterSpacing: 1, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  settingIcon: { fontSize: 20, width: 28 },
  settingLabel: { flex: 1, color: Colors.textPrimary, fontSize: FontSizes.md },
  settingValue: { color: Colors.accent, fontSize: FontSizes.sm },
  arrow: { color: Colors.textMuted, fontSize: 20 },
  languagePicker: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.xs },
  langOption: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  langActive: { backgroundColor: Colors.surfaceLight },
  langName: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.medium, flex: 1 },
  langNameActive: { color: Colors.accent },
  langSub: { color: Colors.textMuted, fontSize: FontSizes.sm, marginRight: Spacing.md },
  checkmark: { color: Colors.accent, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  profileCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  profileName: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  profileMeta: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  logoutButton: { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  logoutText: { color: Colors.error, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  version: { color: Colors.textMuted, fontSize: FontSizes.xs, textAlign: 'center', marginTop: Spacing.xl },
});
