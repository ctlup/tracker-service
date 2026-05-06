// app/_layout.jsx — expo-router root layout.
//
// IMPORTANT: services/locationTask must be imported so that TaskManager.defineTask is called.
// This ensures the task definition is registered every time the app opens (user re-launches it
// or the OS restarts it). Otherwise the OS will fail with an "unregistered task" error
// when it tries to call the task.

import '../services/locationTask'; // Task definition loaded as a side effect
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
