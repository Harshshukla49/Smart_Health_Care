import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getPatientById, getPatients } from '../../services/patientService';
import { resetSosAlert, triggerSosAlert } from '../../services/sosService';
import { colors } from '../../theme/colors';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SosScreen() {
  const { session } = useAuth();
  const role = session?.role === 'doctor' ? 'doctor' : 'patient';

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temperature, setTemperature] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [sending, setSending] = useState(false);

  const activePatientId = useMemo(() => {
    if (role === 'patient') {
      return String(session?.patientId || '');
    }
    return selectedPatientId;
  }, [role, selectedPatientId, session?.patientId]);

  const hydratePatientVitals = useCallback(async (patientId) => {
    if (!patientId) {
      return;
    }

    const profile = await getPatientById(patientId);
    setHeartRate(String(profile?.heartRate ?? 0));
    setSpo2(String(profile?.spo2 ?? 0));
    setTemperature(String(profile?.temperature ?? 0));
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        if (role === 'doctor') {
          const rows = await getPatients();
          if (!active) {
            return;
          }
          setPatients(rows);
          const first = String(rows[0]?.id || rows[0]?.patientId || '');
          setSelectedPatientId(first);
          if (first) {
            await hydratePatientVitals(first);
          }
        } else {
          const pid = String(session?.patientId || '');
          if (pid) {
            await hydratePatientVitals(pid);
          }
        }

        setError('');
      } catch (requestError) {
        if (active) {
          setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load SOS context');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [hydratePatientVitals, role, session?.patientId]);

  useEffect(() => {
    if (role !== 'doctor' || !selectedPatientId) {
      return;
    }

    hydratePatientVitals(selectedPatientId).catch(() => {});
  }, [hydratePatientVitals, role, selectedPatientId]);

  const onTrigger = async () => {
    if (!activePatientId) {
      setError('Patient ID is required to trigger SOS');
      return;
    }

    setSending(true);
    try {
      const response = await triggerSosAlert({
        patientId: activePatientId,
        heartRate: toNumber(heartRate),
        spo2: toNumber(spo2),
        temperature: toNumber(temperature),
        locationLink,
      });

      setStatusMessage(response?.message || (response?.sent ? 'SOS alert sent.' : 'SOS already active for this event.'));
      setError('');
      Alert.alert('SOS', response?.sent ? 'Alert sent successfully.' : 'Alert not sent (already active).');
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Failed to trigger SOS';
      setError(message);
      Alert.alert('SOS Error', message);
    } finally {
      setSending(false);
    }
  };

  const onReset = async () => {
    if (!activePatientId) {
      setError('Patient ID is required to reset SOS');
      return;
    }

    setSending(true);
    try {
      await resetSosAlert({ patientId: activePatientId });
      setStatusMessage('SOS event reset successfully.');
      setError('');
      Alert.alert('SOS', 'SOS event reset done.');
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Failed to reset SOS';
      setError(message);
      Alert.alert('SOS Error', message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Preparing SOS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>SOS Alert</Text>
        <Text style={styles.subtitle}>Emergency escalation to doctor and emergency contacts</Text>

        {role === 'doctor' ? (
          <View style={styles.patientRow}>
            {patients.slice(0, 6).map((row) => {
              const id = String(row.id || row.patientId || '');
              const active = id === selectedPatientId;
              return (
                <Pressable
                  key={id || row.name}
                  style={[styles.patientChip, active ? styles.patientChipActive : null]}
                  onPress={() => setSelectedPatientId(id)}
                >
                  <Text style={[styles.patientChipText, active ? styles.patientChipTextActive : null]} numberOfLines={1}>
                    {row.name || id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Patient ID</Text>
          <Text style={styles.value}>{activePatientId || 'N/A'}</Text>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.label}>Heart Rate</Text>
          <TextInput keyboardType="numeric" value={heartRate} onChangeText={setHeartRate} style={styles.input} />

          <Text style={styles.label}>SpO2</Text>
          <TextInput keyboardType="numeric" value={spo2} onChangeText={setSpo2} style={styles.input} />

          <Text style={styles.label}>Temperature</Text>
          <TextInput keyboardType="numeric" value={temperature} onChangeText={setTemperature} style={styles.input} />

          <Text style={styles.label}>Location Link (optional)</Text>
          <TextInput value={locationLink} onChangeText={setLocationLink} style={styles.input} placeholder="https://maps..." />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}

        <Pressable style={styles.triggerButton} onPress={onTrigger} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? 'Processing...' : 'Trigger SOS'}</Text>
        </Pressable>

        <Pressable style={styles.resetButton} onPress={onReset} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? 'Processing...' : 'Reset SOS'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textSecondary },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 6 },
  patientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  patientChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    maxWidth: 170,
  },
  patientChipActive: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  patientChipText: { color: colors.textPrimary, fontSize: 12 },
  patientChipTextActive: { color: colors.primaryDark, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
  },
  label: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  inputCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  error: { color: colors.danger },
  status: { color: colors.primaryDark },
  triggerButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  resetButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
