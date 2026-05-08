import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';

import { getApiKey, getProfile, clearAll } from '../services/storage';
import { LOCATION_TASK_NAME } from '../services/locationTask';

type TrackingStatus = 'initialising' | 'tracking' | 'denied' | 'error';

interface LastFix {
  lat: number;
  lng: number;
  speed: number | null;
  direction: number | null;
  timestamp: string;
}

interface ProfileState {
  name: string;
  type: string;
  deviceId: string;
}

export default function Tracking() {
  const [status, setStatus] = useState<TrackingStatus>('initialising');
  const [profile, setProfileState] = useState<ProfileState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<LastFix | null>(null);
  const [pingsSent, setPingsSent] = useState<number>(0);
  const fgWatchRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [apiKey, prof] = await Promise.all([getApiKey(), getProfile()]);

        if (!apiKey) {
          router.replace('/');
          return;
        }
        if (cancelled) return;

        setProfileState(prof);

        // 1. Foreground permission — required.
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          setStatus('denied');
          setErrorMsg('Location permission denied.');
          return;
        }

        // 2. Background permission — required for app to work when closed.
        // On Android, "Always allow" is needed; on iOS, "Always".
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          setStatus('denied');
          setErrorMsg(
            'Background location permission is required. Please change ' +
              'location permission to "Always allow" in your phone settings.'
          );
          return;
        }

        // 3. Start background task. If already running, skip.
        const isRegistered = await TaskManager.isTaskRegisteredAsync(
          LOCATION_TASK_NAME
        );

        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
            // Required on Android — shows a persistent notification to the user
            // indicating that tracking is active. Without this, the OS may kill the task.
            foregroundService: {
              notificationTitle: 'Tracker active',
              notificationBody: 'Recording location data.',
              notificationColor: '#04724d',
            },
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            // If the OS kills the app, iOS will attempt to restart it.
            activityType: Location.ActivityType.Other,
          });
        }

        // 4. Foreground watcher to display the current location on the UI while the screen is open.
        // This watcher is ONLY for display purposes — the actual POST is handled by the background task.
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (!loc?.coords) return;
            setLastFix({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speed: loc.coords.speed,
              direction: loc.coords.heading,
              timestamp: new Date(loc.timestamp || Date.now()).toISOString(),
            });
            setPingsSent((n) => n + 1);
          }
        );
        fgWatchRef.current = sub;

        setStatus('tracking');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start tracking';
        setStatus('error');
        setErrorMsg(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (fgWatchRef.current?.remove) {
        fgWatchRef.current.remove();
        fgWatchRef.current = null;
      }
    };
  }, []);

  const handleStopAndReset = async () => {
    Alert.alert(
      'Stop and reset',
      'Tracking will stop and you will be taken back to the registration screen. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const isRegistered = await TaskManager.isTaskRegisteredAsync(
                LOCATION_TASK_NAME
              );
              if (isRegistered) {
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
              }
              if (fgWatchRef.current?.remove) {
                fgWatchRef.current.remove();
              }
              await clearAll();
              router.replace('/');
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tracking</Text>

        {profile && (
          <Text style={styles.subtitle}>
            {profile.name} · {profile.type}
          </Text>
        )}

        <View style={styles.statusBox}>
          {status === 'initialising' && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text style={styles.statusText}>Starting GPS…</Text>
            </View>
          )}
          {status === 'tracking' && (
            <Text style={styles.statusOk}>● Live (also running in background)</Text>
          )}
          {status === 'denied' && (
            <Text style={styles.statusBad}>Permission denied</Text>
          )}
          {status === 'error' && <Text style={styles.statusBad}>Error</Text>}
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>

        {status === 'tracking' && (
          <Text style={styles.bgNote}>
            You can close the screen and put your phone in your pocket. Tracking will continue.
          </Text>
        )}

        {lastFix && (
          <View style={styles.fixBox}>
            <Text style={styles.fixLabel}>Last fix (while screen is open)</Text>
            <Text style={styles.fixCoord}>
              {lastFix.lat.toFixed(6)}, {lastFix.lng.toFixed(6)}
            </Text>
            <Text style={styles.fixMeta}>
              speed: {(lastFix.speed || 0).toFixed(2)} m/s
            </Text>
            <Text style={styles.fixMeta}>time: {lastFix.timestamp}</Text>
          </View>
        )}

        {pingsSent > 0 && (
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SEEN WHILE ON SCREEN</Text>
            <Text style={styles.statValue}>{pingsSent}</Text>
            <Text style={styles.statHint}>
              (background pings don't show here but are sent to the backend)
            </Text>
          </View>
        )}

        <Pressable style={styles.resetBtn} onPress={handleStopAndReset}>
          <Text style={styles.resetBtnText}>Durdur ve sıfırla</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
  },
  statusText: { fontSize: 14, color: '#333' },
  statusOk: { fontSize: 16, fontWeight: '600', color: '#04724d' },
  statusBad: { fontSize: 16, fontWeight: '600', color: '#c0392b' },
  errorText: { color: '#c0392b', marginTop: 6 },
  bgNote: {
    fontSize: 13,
    color: '#04724d',
    backgroundColor: '#eef6f2',
    padding: 10,
    borderRadius: 6,
    fontStyle: 'italic',
  },
  fixBox: { padding: 12, borderRadius: 8, backgroundColor: '#eef6f2' },
  fixLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  fixCoord: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  fixMeta: { fontSize: 13, color: '#555' },
  statBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 4, color: '#04724d' },
  statHint: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  resetBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  resetBtnText: { color: '#555', fontWeight: '500' },
});
