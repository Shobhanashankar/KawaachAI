import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '../constants/Colors';

const FAQ_KEYS = [
  { q: 'help.faq_1_q', a: 'help.faq_1_a' },
  { q: 'help.faq_2_q', a: 'help.faq_2_a' },
  { q: 'help.faq_3_q', a: 'help.faq_3_a' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const openSupportLink = async (url: string, fallbackMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('common.error_title'), fallbackMessage);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error_title'), fallbackMessage);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('help.title')}</Text>
      <Text style={styles.subtitle}>{t('help.subtitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('help.faq_title')}</Text>
        {FAQ_KEYS.map((item) => (
          <View key={item.q} style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{t(item.q)}</Text>
            <Text style={styles.faqAnswer}>{t(item.a)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('help.contact_title')}</Text>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => openSupportLink('tel:+919999999999', t('help.chat_unavailable'))}
        >
          <Text style={styles.contactIcon}>📞</Text>
          <Text style={styles.contactText}>{t('help.call_support')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => openSupportLink('mailto:support@kawaach.ai', t('help.chat_unavailable'))}
        >
          <Text style={styles.contactIcon}>✉️</Text>
          <Text style={styles.contactText}>{t('help.email_support')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => Alert.alert(t('help.chat_support'), t('help.chat_started'))}
        >
          <Text style={styles.contactIcon}>💬</Text>
          <Text style={styles.contactText}>{t('help.chat_support')}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>{t('help.response_note')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  headerRow: { marginBottom: Spacing.md },
  backButton: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  backText: { color: Colors.accent, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  title: { color: Colors.textPrimary, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold },
  subtitle: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  section: { marginTop: Spacing.md },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.sm },
  faqCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  faqQuestion: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, marginBottom: Spacing.xs },
  faqAnswer: { color: Colors.textSecondary, fontSize: FontSizes.sm, lineHeight: 20 },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  contactIcon: { fontSize: 18 },
  contactText: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.medium },
  note: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: Spacing.xs },
});
