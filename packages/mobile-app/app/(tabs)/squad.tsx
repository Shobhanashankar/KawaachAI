import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius, Shadows } from '../../constants/Colors';
import { MOCK_SQUAD, MOCK_WORKER } from '../../services/mockData';
import { getPremiumServiceSquad } from '../../services/api';
import { getWorkerProfile, type WorkerProfile } from '../../services/storage';

export default function SquadScreen() {
  const { t } = useTranslation();
  const [hasSquad, setHasSquad] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [worker, setWorker] = useState<WorkerProfile>(MOCK_WORKER);
  const [squad, setSquad] = useState(MOCK_SQUAD);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getWorkerProfile();
      if (!profile) return;

      setWorker(profile);

      if (profile.squad_id) {
        try {
          const response = await getPremiumServiceSquad(profile.squad_id);
          setSquad({
            squad_id: response.data.squad.id,
            zone_h3: response.data.squad.dark_store_h3,
            members: response.data.members.map((member) => ({
              worker_id: member.worker_id,
              name: member.worker_id === profile.worker_id ? profile.name : member.worker_id,
              avatar: member.worker_id === profile.worker_id ? '🧑' : '🛵',
            })),
            claim_free_weeks: response.data.squad.zero_claim_streak,
            cashback_eligible: response.data.squad.status === 'active',
            cashback_amount: Number((response.data.member_count * 1.3).toFixed(1)),
          });
        } catch {
          setSquad(MOCK_SQUAD);
        }
      }
    };
    void loadProfile();
  }, []);

  const squadMembers = useMemo(() => {
    let matched = false;
    const mapped = squad.members.map((member) => {
      if (member.worker_id === worker.worker_id) {
        matched = true;
        return { ...member, name: worker.name };
      }
      return member;
    });

    if (!matched) {
      return [{ worker_id: worker.worker_id, name: worker.name, avatar: '🧑' }, ...mapped];
    }

    return mapped;
  }, [squad.members, worker.name, worker.worker_id]);

  const handleJoinSquad = () => {
    if (inviteCode.length !== 6) {
      Alert.alert(t('common.error_title'), t('squad.invalid_invite_code'));
      return;
    }
    setHasSquad(true);
  };

  if (!hasSquad) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('squad.title')}</Text>
        <Text style={styles.subtitle}>{t('squad.subtitle')}</Text>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>{t('squad.no_squad')}</Text>

          <View style={styles.joinCard}>
            <Text style={styles.inputLabel}>{t('squad.squad_code_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('squad.squad_code_placeholder')}
              placeholderTextColor={Colors.textMuted}
              maxLength={6}
              autoCapitalize="characters"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinSquad}>
              <Text style={styles.joinButtonText}>{t('squad.join_squad')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.createButton} onPress={() => setHasSquad(true)}>
            <Text style={styles.createButtonText}>{t('squad.create_squad')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('squad.title')}</Text>
      <Text style={styles.subtitle}>{t('squad.subtitle')}</Text>

      {/* Cashback Banner */}
      {squad.cashback_eligible && (
        <View style={styles.cashbackBanner}>
          <Text style={styles.cashbackIcon}>🎉</Text>
          <View style={styles.cashbackContent}>
            <Text style={styles.cashbackTitle}>{t('squad.cashback_eligible')}</Text>
            <Text style={styles.cashbackAmount}>{t('squad.cashback_amount')}</Text>
          </View>
          <Text style={styles.cashbackValue}>₹{squad.cashback_amount.toFixed(1)}</Text>
        </View>
      )}

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakRow}>
          <Text style={styles.streakIcon}>🔥</Text>
          <View>
            <Text style={styles.streakLabel}>{t('squad.claim_free_streak')}</Text>
            <Text style={styles.streakValue}>
              {squad.claim_free_weeks} {t('squad.weeks')}
            </Text>
          </View>
        </View>
        <View style={styles.streakDots}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.streakDot,
                i < squad.claim_free_weeks ? styles.streakDotActive : undefined,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Members */}
      <Text style={styles.sectionTitle}>
        {t('squad.members')} ({squadMembers.length})
      </Text>
      <View style={styles.membersList}>
        {squadMembers.map((member) => (
          <View key={member.worker_id} style={styles.memberCard}>
            <Text style={styles.memberAvatar}>{member.avatar}</Text>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberId}>{member.worker_id}</Text>
            </View>
            {member.worker_id === worker.worker_id && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>{t('squad.you')}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Squad Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{t('squad.how_it_works_title')}</Text>
        <Text style={styles.infoText}>{t('squad.how_it_works_body')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl + Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  cashbackBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 184, 148, 0.12)',
    borderWidth: 1, borderColor: 'rgba(0, 184, 148, 0.3)', borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md,
  },
  cashbackIcon: { fontSize: 28 },
  cashbackContent: { flex: 1 },
  cashbackTitle: { color: Colors.success, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  cashbackAmount: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  cashbackValue: { color: Colors.success, fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  streakCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakIcon: { fontSize: 32 },
  streakLabel: { color: Colors.textMuted, fontSize: FontSizes.sm },
  streakValue: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  streakDots: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  streakDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surfaceLight },
  streakDotActive: { backgroundColor: Colors.accent },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.md },
  membersList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.md },
  memberAvatar: { fontSize: 28 },
  memberInfo: { flex: 1 },
  memberName: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  memberId: { color: Colors.textMuted, fontSize: FontSizes.xs },
  youBadge: { backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  youText: { color: Colors.textPrimary, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  infoCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  infoTitle: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold, marginBottom: Spacing.sm },
  infoText: { color: Colors.textSecondary, fontSize: FontSizes.sm, lineHeight: 22 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.xxl * 2 },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.md },
  emptyText: { color: Colors.textMuted, fontSize: FontSizes.lg, marginBottom: Spacing.xl },
  joinCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '100%' },
  inputLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSizes.lg, textAlign: 'center', letterSpacing: 4 },
  joinButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  joinButtonText: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  createButton: { marginTop: Spacing.lg, padding: Spacing.md },
  createButtonText: { color: Colors.accent, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
});
