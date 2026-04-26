import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../services/apiClient';
import { colors } from '../theme/colors';

export default function MedicineCard({ medicine, patientId, onUpdate }) {
  const [taken, setTaken] = useState(medicine.taken || false);
  const [loading, setLoading] = useState(false);

  const toggleTaken = async () => {
    if (loading) return;
    setLoading(true);
    const newTaken = !taken;
    setTaken(newTaken);
    
    // Optimistic update
    onUpdate?.(medicine.id, newTaken);

    try {
      const encodedPatientId = encodeURIComponent(String(patientId || '').trim());
      const encodedMedicineId = encodeURIComponent(String(medicine.id || '').trim());
      await apiClient.post(`/api/patient/${encodedPatientId}/medicines/${encodedMedicineId}/taken`, { taken: newTaken });
    } catch (error) {
      // Revert on error
      setTaken(!newTaken);
      onUpdate?.(medicine.id, !newTaken);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{medicine.name || 'Unnamed Medicine'}</Text>
        <Text style={styles.dosage}>{medicine.dosage || 'N/A'}</Text>
        <Text style={styles.time}>{medicine.time || 'N/A'}</Text>
      </View>
      <Pressable 
        style={[styles.toggleButton, taken && styles.takenButton]} 
        onPress={toggleTaken}
        disabled={loading}
      >
        <Text style={styles.toggleText}>{loading ? '...' : taken ? '✓ Taken' : 'Mark Taken'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  dosage: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  toggleButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 80,
    alignItems: 'center',
  },
  takenButton: {
    backgroundColor: colors.successLight || '#d4edda',
    borderColor: colors.success || '#28a745',
  },
  toggleText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
});
