import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function PublicContactScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Contact</Text>
        <Text style={styles.subtitle}>Reach the Smart Health team for support.</Text>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Support Email</Text>
          <Text style={styles.value}>support@smarthealthcare.com</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Emergency Helpline</Text>
          <Text style={styles.value}>+91 99999 12345</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Office Hours</Text>
          <Text style={styles.value}>Mon-Sat, 9:00 AM - 7:00 PM</Text>
        </View>

        <Pressable style={styles.button} onPress={() => navigation.navigate('PublicHome')}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  label: { color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase', fontWeight: '600' },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  button: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
