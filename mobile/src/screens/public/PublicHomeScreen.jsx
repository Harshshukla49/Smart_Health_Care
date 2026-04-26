import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

function NavChip({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.navChip}>
      <Text style={styles.navChipText}>{label}</Text>
    </Pressable>
  );
}

export function PublicHomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.brand}>Smart Health Care</Text>
          <Text style={styles.title}>Remote Patient Monitoring Platform</Text>
          <Text style={styles.subtitle}>
            Doctors can monitor vitals, review patient status, and receive alerts. Patients get an easy portal for health tracking.
          </Text>

          <View style={styles.navRow}>
            <NavChip label="Home" onPress={() => navigation.navigate('PublicHome')} />
            <NavChip label="Blog" onPress={() => navigation.navigate('PublicBlog')} />
            <NavChip label="Contact" onPress={() => navigation.navigate('PublicContact')} />
          </View>

          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('LoginSelection')}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('DoctorSignup')}>
            <Text style={styles.secondaryButtonText}>Create Doctor Account</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Features</Text>
          <Text style={styles.sectionText}>• Live patient vitals dashboard</Text>
          <Text style={styles.sectionText}>• Role-based Doctor and Patient access</Text>
          <Text style={styles.sectionText}>• Emergency SOS and chat support</Text>
          <Text style={styles.sectionText}>• Real-time alerts and prediction insights</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 14 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  brand: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  title: { color: colors.textPrimary, fontWeight: '700', fontSize: 26, lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  navChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#eef6ff',
  },
  navChipText: { color: colors.textPrimary, fontWeight: '600', fontSize: 12 },
  primaryButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6,
  },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 18, marginBottom: 3 },
  sectionText: { color: colors.textSecondary, lineHeight: 20 },
});
