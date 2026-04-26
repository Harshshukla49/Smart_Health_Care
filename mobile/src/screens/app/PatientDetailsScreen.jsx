import { requestNotificationPermissions, scheduleMedicineReminder } from '../../services/medicineReminder';
import { updatePatientMedicines } from '../../services/patientService';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { getPatientById } from '../../services/patientService';
import { API_BASE_URL } from '../../config/env';
import {
  getPatientPredictionAudit,
  getPatientVitals,
  normalizePrediction,
  predictRiskForVitals,
} from '../../services/vitalsService';
import { getPatientMedicines } from '../../services/patientService';
import MedicineCard from '../../components/MedicineCard';
import { colors } from '../../theme/colors';

const POLL_INTERVAL_MS = 3000;

function DataCard({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function AuditRow({ item }) {
  const formattedTime = item?.timestamp
    ? new Date(item.timestamp).toLocaleString()
    : 'Unknown time';

  return (
    <View style={styles.auditRow}>
      <Text style={styles.auditTitle}>{item?.status || item?.risk || 'Prediction'}</Text>
      <Text style={styles.auditMeta}>{formattedTime}</Text>
      <Text style={styles.auditMeta}>Source: {item?.source || 'system'}</Text>
      <Text style={styles.auditMessage}>{item?.message || 'No message'}</Text>
      <Text style={styles.auditVitals}>
        HR {item?.vitals?.heartRate ?? 0} | SpO2 {item?.vitals?.spo2 ?? 0} | Temp {item?.vitals?.temperature ?? 0}
      </Text>
    </View>
  );
}

export function PatientDetailsScreen({ route }) {
  const { session } = useAuth();
  const patientIdFromRoute = route?.params?.patientId;
  const patientId = useMemo(() => patientIdFromRoute || session?.patientId || '', [patientIdFromRoute, session?.patientId]);

  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    updatedAt: '',
  });
  const [prediction, setPrediction] = useState(normalizePrediction({}));
  const [medicines, setMedicines] = useState([]);
  const [notifsReady, setNotifsReady] = useState(false);
    // Request notification permissions on mount
    useEffect(() => {
      requestNotificationPermissions().then(granted => setNotifsReady(granted));
    }, []);
  const [auditRows, setAuditRows] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState('');
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [newMedicine, setNewMedicine] = useState({ name: '', dosage: '', time: '' });
  const [pendingMedicines, setPendingMedicines] = useState([]);
  const isDoctor = session?.role === 'doctor';
  const pollRef = useRef(null);
  const socketRef = useRef(null);

  const addMedicineToPending = useCallback(() => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim() || !newMedicine.time.trim()) {
      return;
    }
    setPendingMedicines(prev => [...prev, { ...newMedicine, id: Date.now().toString(), taken: false }]);
    setNewMedicine({ name: '', dosage: '', time: '' });
  }, [newMedicine]);

  const load = useCallback(async () => {
    if (!patientId) {
      setError('Patient ID not available');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profile, latestVitals, audit, meds] = await Promise.all([
        getPatientById(patientId),
        getPatientVitals(patientId),
        getPatientPredictionAudit(patientId),
        getPatientMedicines(patientId),
      ]);

      const nextPrediction = normalizePrediction(
        profile?.prediction && typeof profile.prediction === 'object'
          ? profile.prediction
          : { status: profile?.status || 'Normal', risk: profile?.prediction || profile?.status || 'Unknown' }
      );

      setPatient(profile);
      setMedicines(meds);
      // Schedule reminders for medicines if notifications are enabled
      if (notifsReady && Array.isArray(meds)) {
        meds.forEach(med => {
          scheduleMedicineReminder(med, profile?.name || 'Patient');
        });
      }
      setVitals((current) => ({
        ...current,
        heartRate: latestVitals.heartRate,
        spo2: latestVitals.spo2,
        temperature: latestVitals.temperature,
        updatedAt: latestVitals.updatedAt || current.updatedAt,
      }));
      setPrediction(nextPrediction);
      setAuditRows(audit.slice(-20).reverse());
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load patient details');
    } finally {
      setLoading(false);
    }
  }, [notifsReady, patientId]);

  const submitMedicines = useCallback(async () => {
    if (!pendingMedicines.length || !patientId) return;
    setLoading(true);
    try {
      await updatePatientMedicines(patientId, [...medicines, ...pendingMedicines]);
      await load();
      setPendingMedicines([]);
      setShowMedicineModal(false);
    } catch (err) {
      setError(err?.message || 'Failed to update medicines');
    } finally {
      setLoading(false);
    }
  }, [pendingMedicines, patientId, medicines, load]);

  const runVitalsPoll = useCallback(async () => {
    if (!patientId) {
      return;
    }

    try {
      const latestVitals = await getPatientVitals(patientId);
      setVitals((current) => ({
        ...current,
        heartRate: latestVitals.heartRate,
        spo2: latestVitals.spo2,
        temperature: latestVitals.temperature,
        updatedAt: latestVitals.updatedAt || current.updatedAt,
      }));
    } catch {
      // Poll fallback should not interrupt UI when transient errors occur.
    }
  }, [patientId]);

  const runPrediction = useCallback(async () => {
    setPredicting(true);
    try {
      const next = await predictRiskForVitals(vitals);
      setPrediction(next);
      const audit = await getPatientPredictionAudit(patientId);
      setAuditRows(audit.slice(-20).reverse());
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to run prediction');
    } finally {
      setPredicting(false);
    }
  }, [patientId, vitals]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!patientId) {
      return undefined;
    }

    const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('subscribe_patient', { patientId });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('patient_snapshot', (payload) => {
      const nextPatient = payload?.data;
      if (!nextPatient) {
        return;
      }

      setPatient((current) => ({
        ...(current || {}),
        ...(nextPatient || {}),
      }));

      const nextPrediction = normalizePrediction(nextPatient?.prediction || {});
      setPrediction(nextPrediction);
    });

    socket.on('vitals_update', (payload) => {
      const incoming = payload?.vitals || {};
      setVitals((current) => ({
        ...current,
        heartRate: Number.isFinite(Number(incoming.heartRate ?? incoming.heart_rate))
          ? Number(incoming.heartRate ?? incoming.heart_rate)
          : current.heartRate,
        spo2: Number.isFinite(Number(incoming.spo2)) ? Number(incoming.spo2) : current.spo2,
        temperature: Number.isFinite(Number(incoming.temperature ?? incoming.temp))
          ? Number(incoming.temperature ?? incoming.temp)
          : current.temperature,
        updatedAt: String(incoming.updatedAt || incoming.timestamp || current.updatedAt),
      }));
    });

    socket.on('insights_update', (payload) => {
      const nextPrediction = normalizePrediction(payload?.prediction || {});
      setPrediction(nextPrediction);
      getPatientPredictionAudit(patientId)
        .then((audit) => setAuditRows(audit.slice(-20).reverse()))
        .catch(() => {});
    });

    pollRef.current = setInterval(runVitalsPoll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [patientId, runVitalsPoll]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading patient details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{patient?.name || 'Patient'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.connectionText}>{socketConnected ? 'Live stream connected' : 'Live stream reconnecting, poll fallback active'}</Text>

        <DataCard label="Patient ID" value={patient?.patientId || patientId || 'N/A'} />
        <DataCard label="Status" value={prediction?.status || patient?.status || 'Normal'} />
        <DataCard label="Risk" value={prediction?.risk || 'Unknown'} />
        <DataCard label="Confidence" value={`${Number(prediction?.confidence || 0).toFixed(2)}`} />
        <DataCard label="Heart Rate" value={`${vitals?.heartRate ?? 0} bpm`} />
        <DataCard label="SpO2" value={`${vitals?.spo2 ?? 0}%`} />
        <DataCard label="Temperature" value={`${vitals?.temperature ?? 0} C`} />
        <DataCard label="Updated At" value={vitals?.updatedAt || patient?.updatedAt || 'N/A'} />

        <Text style={styles.sectionTitle}>Medicines</Text>
        {medicines.length ? (
          medicines.map((med, index) => (
            <MedicineCard
              key={med.id || index}
              medicine={med}
              patientId={patientId}
              onUpdate={(medId, taken) => {
                setMedicines(prev => prev.map(m => m.id === medId ? {...m, taken} : m));
              }}
            />
          ))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No medicines prescribed</Text>
          </View>
        )}

        {isDoctor && (
          <Pressable style={styles.addMedicineButton} onPress={() => setShowMedicineModal(true)}>
            <Text style={styles.addMedicineText}>+ Add Medicines</Text>
          </Pressable>
        )}

        <Modal visible={showMedicineModal} transparent animationType="slide" onRequestClose={() => setShowMedicineModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Medicines</Text>
              <TextInput
                style={styles.input}
                placeholder="Medicine name"
                placeholderTextColor={colors.textSecondary}
                value={newMedicine.name}
                onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, name: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Dosage (e.g. 1 tablet)"
                placeholderTextColor={colors.textSecondary}
                value={newMedicine.dosage}
                onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, dosage: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Time (e.g. 08:00 AM)"
                placeholderTextColor={colors.textSecondary}
                value={newMedicine.time}
                onChangeText={(value) => setNewMedicine((prev) => ({ ...prev, time: value }))}
              />
              <Pressable style={styles.secondaryButton} onPress={addMedicineToPending}>
                <Text style={styles.secondaryButtonText}>Add to list</Text>
              </Pressable>

              {pendingMedicines.length ? (
                <View style={styles.pendingList}>
                  {pendingMedicines.map((item) => (
                    <Text key={item.id} style={styles.pendingItem}>
                      {item.name} - {item.dosage} - {item.time}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelButton} onPress={() => setShowMedicineModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSaveButton, !pendingMedicines.length && styles.modalSaveButtonDisabled]}
                  onPress={submitMedicines}
                  disabled={!pendingMedicines.length}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Text style={styles.sectionTitle}>Vitals Trends (Last 10)</Text>
        {auditRows.length > 1 && (
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: auditRows.slice(0,10).map((_, i) => `T${i+1}`),
                datasets: [
                  {
                    data: auditRows.slice(0,10).map(r => r.vitals.heartRate || 0),
                  },
                  {
                    data: auditRows.slice(0,10).map(r => r.vitals.spo2 || 0),
                  }
                ]
              }}
              width={Dimensions.get('window').width - 32}
              height={220}
              yAxisLabel=""
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 150, 255, ${opacity})`,
              }}
            />
          </View>
        )}

        {/* Wrap prediction box and button in a parent View to ensure single parent */}
        <View>
          <View style={styles.predictionBox}>
            <Text style={styles.predictionTitle}>Prediction Message</Text>
            <Text style={styles.predictionText}>{prediction?.message || 'No prediction message available'}</Text>
          </View>

          <Pressable style={styles.secondaryButton} onPress={runPrediction} disabled={predicting}>
            <Text style={styles.secondaryButtonText}>{predicting ? 'Running Prediction...' : 'Run Prediction'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Prediction Audit Timeline</Text>
        {auditRows.length ? auditRows.map((item, index) => <AuditRow key={`${item.timestamp || 'row'}-${index}`} item={item} />) : (
          <View style={styles.auditEmpty}>
            <Text style={styles.auditEmptyText}>No audit records available yet.</Text>
          </View>
        )}

        <Pressable style={styles.reloadButton} onPress={load}>
          <Text style={styles.reloadText}>Refresh</Text>
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
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  error: { color: colors.danger, marginBottom: 6 },
  connectionText: { color: colors.textSecondary, marginBottom: 2 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
  cardValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  predictionBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
  },
  predictionTitle: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  predictionText: { color: colors.textPrimary, fontSize: 14 },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  sectionTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  auditRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 2,
  },
  auditTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  auditMeta: { color: colors.textSecondary, fontSize: 12 },
  auditMessage: { color: colors.textPrimary, fontSize: 13, marginTop: 2 },
  auditVitals: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  auditEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
  },
  auditEmptyText: { color: colors.textSecondary },
  emptySection: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  addMedicineButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  addMedicineText: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  pendingList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  pendingItem: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  reloadButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 12,
  },
  reloadText: { color: '#fff', fontWeight: '700' },
});
