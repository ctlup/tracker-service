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
import { router } from 'expo-router';

import { getApiKey, getProfile, clearAll } from '../services/storage';
import { postLocation } from '../services/api';

function computeBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lng2 - lng1);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}
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
  const apiKeyRef = useRef<string | null>(null);
  const prevLocRef = useRef<{ lat: number; lng: number } | null>(null);

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

        apiKeyRef.current = apiKey;
        setProfileState(prof);

        // Foreground permission — required.
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          setStatus('denied');
          setErrorMsg('Location permission denied.');
          return;
        }

        // Foreground-only watcher. Posts to backend while the screen is open.
        // NOTE: Background tracking is only available in a real EAS build
        // (not in Expo Go) — that will be the next step.
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          async (loc) => {
            if (!loc?.coords) return;
            console.log('[gps]', {
              heading: loc.coords.heading,
              prev: prevLocRef.current,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            });

            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;

            // Use GPS heading if available; otherwise compute bearing from prev fix.

            
            let direction: number | null = null;

            if (loc.coords.heading != null && loc.coords.heading > 0) {
              direction = loc.coords.heading;
            } else if (prevLocRef.current) {
              direction = computeBearing(
                prevLocRef.current.lat,
                prevLocRef.current.lng,
                lat,
                lng,
              );
              console.log('[direction]', direction);
            }

            prevLocRef.current = { lat, lng };

            const fix: LastFix = {
              lat,
              lng,
              speed: loc.coords.speed,
              direction,
              timestamp: new Date(loc.timestamp || Date.now()).toISOString(),
            };

            setLastFix(fix);
            setPingsSent((n) => n + 1);

            const key = apiKeyRef.current;
            if (key) {
              try {
                await postLocation({
                  apiKey: key,
                  lat: fix.lat,
                  lng: fix.lng,
                  speed: fix.speed ?? 0,
                  direction: fix.direction ?? null,
                  timestamp: fix.timestamp,
                });
              } catch (e) {
                console.warn(
                  '[fg-post] failed',
                  e instanceof Error ? e.message : String(e),
                );
              }
            }
          },
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
      ],
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
            <Text style={styles.statusOk}>● Live (screen-only demo)</Text>
          )}
          {status === 'denied' && <Text style={styles.statusBad}>Permission denied</Text>}
          {status === 'error' && <Text style={styles.statusBad}>Error</Text>}
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>

        {status === 'tracking' && (
          <Text style={styles.bgNote}>
            This Expo Go demo only tracks while the screen is open. The real APK
            (next step) will continue in the background.
          </Text>
        )}

        {lastFix && (
          <View style={styles.fixBox}>
            <Text style={styles.fixLabel}>Last fix</Text>
            <Text style={styles.fixCoord}>
              {lastFix.lat.toFixed(6)}, {lastFix.lng.toFixed(6)}
            </Text>
            <Text style={styles.fixMeta}>speed: {(lastFix.speed || 0).toFixed(2)} m/s</Text>
            <Text style={styles.fixMeta}>time: {lastFix.timestamp}</Text>
            <Text style={styles.fixMeta}>
              direction: {lastFix.direction != null ? `${lastFix.direction.toFixed(0)}°` : '—'}
            </Text>
          </View>
        )}

        {pingsSent > 0 && (
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>PINGS SENT</Text>
            <Text style={styles.statValue}>{pingsSent}</Text>
          </View>
        )}

        <Pressable style={styles.resetBtn} onPress={handleStopAndReset}>
          <Text style={styles.resetBtnText}>Stop and reset</Text>
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