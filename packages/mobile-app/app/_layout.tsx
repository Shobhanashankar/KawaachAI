import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Asset } from 'expo-asset';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';

import '../i18n';
import { Colors } from '../constants/Colors';
import i18n from '../i18n';
import { getLanguage, getWorkerProfile } from '../services/storage';
import { registerForPushNotifications } from '../services/notifications';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await Asset.fromModule(require('../assets/images/Icon1.png')).downloadAsync();
        const savedLanguage = await getLanguage();
        if (savedLanguage) {
          await i18n.changeLanguage(savedLanguage);
        }
        const profile = await getWorkerProfile();
        setIsOnboarded(!!profile?.policy_id);
        await registerForPushNotifications();
      } catch (e) {
        console.warn('Init error:', e);
      }
      setIsReady(true);
    };
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <Image source={require('../assets/images/Icon1.png')} style={styles.loadingIcon} resizeMode="contain" />
        <Text style={styles.loadingTitle}>KawaachAI</Text>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
        initialRouteName={isOnboarded ? '(tabs)' : '(auth)'}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="step-up"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: i18n.t('stepup.title'),
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.textPrimary,
          }}
        />
      </Stack>

    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingIcon: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  loadingTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
});
