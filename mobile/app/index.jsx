// app/index.jsx
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

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
        // SecureStore failures are recoverable — fall through to the form.
        console.warn('SecureStore check failed:', e?.message);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleRegister = async ({ name, type }) => {
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
      setError(e?.message || 'Registration failed');
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
