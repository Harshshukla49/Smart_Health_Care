import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export function ProfileScreen() {
  const { session, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.key}>Role</Text>
          <Text style={styles.value}>{session?.role || '-'}</Text>

          <Text style={styles.key}>Name</Text>
          <Text style={styles.value}>{session?.name || '-'}</Text>

          <Text style={styles.key}>Email</Text>
          <Text style={styles.value}>{session?.email || '-'}</Text>

          <Text style={styles.key}>Phone</Text>
          <Text style={styles.value}>{session?.phone || '-'}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 3,
  },
  key: { color: colors.textSecondary, marginTop: 8 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  logoutButton: {
    marginTop: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700' },
});
