// components/RegisterForm.jsx
//
// First-launch form: collect a name and a type (cyclist / car / scooter),
// then hand the values back to the parent via onSubmit.

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const TYPES = ['cyclist', 'car', 'scooter'];

export default function RegisterForm({ onSubmit, submitting, error }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('cyclist');
  const [touched, setTouched] = useState(false);

  const nameInvalid = touched && name.trim().length === 0;

  const handleSubmit = () => {
    setTouched(true);
    if (name.trim().length === 0) return;
    onSubmit({ name: name.trim(), type });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register this device</Text>
      <Text style={styles.subtitle}>
        Pick a name and a type. You only do this once.
      </Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Anna's bike"
        autoCapitalize="words"
        style={[styles.input, nameInvalid && styles.inputInvalid]}
        editable={!submitting}
      />
      {nameInvalid && <Text style={styles.errorText}>Name is required.</Text>}

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => !submitting && setType(t)}
            style={[
              styles.typeChip,
              type === t && styles.typeChipActive,
            ]}
          >
            <Text
              style={[
                styles.typeChipText,
                type === t && styles.typeChipTextActive,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={[styles.submit, submitting && styles.submitDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Register</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputInvalid: { borderColor: '#c0392b' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fafafa',
  },
  typeChipActive: { backgroundColor: '#04724d', borderColor: '#04724d' },
  typeChipText: { color: '#333', textTransform: 'capitalize' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  submit: {
    marginTop: 24,
    backgroundColor: '#04724d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#c0392b', marginTop: 6 },
});
