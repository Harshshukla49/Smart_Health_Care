import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function LoginSelectionScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Smart Health</Text>
        <Text style={styles.subtitle}>Choose how you want to continue</Text>

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('DoctorLogin')}>
          <Text style={styles.primaryButtonText}>Continue as Doctor</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('PatientLogin')}>
          <Text style={styles.secondaryButtonText}>Continue as Patient</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('DoctorSignup')}>
          <Text style={styles.link}>Create Doctor Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 30, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 8 },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  link: { marginTop: 10, color: colors.primaryDark, fontWeight: '600', textAlign: 'center' },
});
