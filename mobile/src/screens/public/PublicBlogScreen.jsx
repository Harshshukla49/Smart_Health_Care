import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function PublicBlogScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Blog</Text>
        <Text style={styles.subtitle}>Latest insights from Smart Health platform.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How remote monitoring improves ICU response</Text>
          <Text style={styles.cardText}>Real-time vitals and predictive alerts can help teams respond faster to high-risk changes.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Doctor workflow tips for multi-patient dashboards</Text>
          <Text style={styles.cardText}>Group patients by severity, set alert priorities, and use quick context actions for better triage.</Text>
        </View>

        <Pressable style={styles.button} onPress={() => navigation.navigate('PublicHome')}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 5,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardText: { color: colors.textSecondary, lineHeight: 20 },
  button: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
