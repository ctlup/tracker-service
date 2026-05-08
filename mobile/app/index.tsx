// app/index.tsx
//
// First-launch screen. On mount we check if an apiKey already exists in secure storage:
//   - if yes → jump straight to /tracking
//   - if no  → render <RegisterForm/> and on submit:
//        1. ensure we have a stable deviceId (creating one if needed)
//        2. POST /devices/register
//        3. persist apiKey + profile
//        4. navigate to /tracking

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

import RegisterForm from '../components/RegisterForm';
import {
  getOrCreateDeviceId,
  getApiKey,
  setApiKey,
  setProfile,
} from '../services/storage';
import { registerDevice } from '../services/api';
import type { DeviceType } from '../services/storage';

export default function Index() {
  const [checking, setChecking] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const existing = await getApiKey();
        if (existing) {
          // Already registered on a previous launch — skip the form entirely.
          router.replace('/tracking');
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('SecureStore check failed:', msg);
      } finally { 
        setChecking(false);
      }
    })();
  }, []);

  const handleRegister = async ({ name, type }: { name: string; type: DeviceType }) => {
    setSubmitting(true);
    setError(null);

    try {
      const deviceId = await getOrCreateDeviceId();
      const result = await registerDevice({ deviceId, name, type });

      if (!result?.apiKey) {
        throw new Error('Server did not return an API key');
      }

      await setApiKey(result.apiKey);
      await setProfile({ name, type, deviceId });

      router.replace('/tracking');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <RegisterForm
          onSubmit={handleRegister}
          submitting={submitting}
          error={error}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
});
