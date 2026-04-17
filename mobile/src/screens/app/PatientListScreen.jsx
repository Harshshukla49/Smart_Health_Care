import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { getPatients } from '../../services/patientService';
import { colors } from '../../theme/colors';

function PatientRow({ item, onPress }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSub}>ID: {item.patientId || item.id || 'N/A'}</Text>
      </View>
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{item.status || 'Normal'}</Text>
      </View>
    </Pressable>
  );
}

export function PatientListScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getPatients();
      setRows(data);
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load patients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading patients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Patients</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={rows}
          keyExtractor={(item, index) => `${item.id || item.patientId || 'row'}-${index}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>No patients found.</Text>}
          renderItem={({ item }) => (
            <PatientRow
              item={item}
              onPress={() => navigation.navigate('PatientDetails', { patientId: item.patientId || item.id })}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textSecondary },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  error: { color: colors.danger, marginBottom: 10 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 16, color: colors.textPrimary, fontWeight: '700' },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
});
