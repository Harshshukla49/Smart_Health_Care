import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getPatientById, getPatients } from '../../services/patientService';
import { colors } from '../../theme/colors';

function SummaryCard({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export function DashboardScreen({ navigation }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorCount, setDoctorCount] = useState(0);
  const [patientStatus, setPatientStatus] = useState('Normal');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (session?.role === 'doctor') {
        const rows = await getPatients();
        setDoctorCount(rows.length);
      }

      if (session?.role === 'patient' && session?.patientId) {
        const profile = await getPatientById(session.patientId);
        setPatientStatus(profile?.status || 'Normal');
      }

      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [session?.patientId, session?.role]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Role based Slice A flow active.</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Refreshing summary...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SummaryCard label="Role" value={session?.role || 'unknown'} />
        <SummaryCard label="Name" value={session?.name || 'N/A'} />
        <SummaryCard label="Identity" value={session?.email || session?.patientId || 'N/A'} />

        {session?.role === 'doctor' ? <SummaryCard label="My Patients" value={String(doctorCount)} /> : null}
        {session?.role === 'patient' ? <SummaryCard label="Current Status" value={patientStatus} /> : null}

        {session?.role === 'doctor' ? (
          <Pressable style={styles.button} onPress={() => navigation.navigate('Patients')}>
            <Text style={styles.buttonText}>Open Patient List</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => navigation.navigate('MyHealth')}>
            <Text style={styles.buttonText}>Open My Health</Text>
          </Pressable>
        )}

        <Pressable style={styles.secondaryButton} onPress={load}>
          <Text style={styles.secondaryButtonText}>Refresh</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 6 },
  loaderWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.textSecondary },
  error: { color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  cardLabel: { color: colors.textSecondary, marginBottom: 4 },
  cardValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
});
