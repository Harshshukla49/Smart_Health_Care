import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';

export function OtpEnterPhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    const trimmedPhone = String(phone || '').trim();
    if (!trimmedPhone) {
      Alert.alert('Phone required', 'Please enter your phone number.');
      return;
    }

    setLoading(true);
    try {
      navigation.navigate('OtpVerify', { phone: trimmedPhone, role });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your phone and choose account type.</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="+91XXXXXXXXXX"
          value={phone}
          onChangeText={setPhone}
        />
        <View style={styles.roleRow}>
          <Pressable
            style={[styles.roleChip, role === 'patient' && styles.roleChipActive]}
            onPress={() => setRole('patient')}
          >
            <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Patient</Text>
          </Pressable>
          <Pressable
            style={[styles.roleChip, role === 'doctor' && styles.roleChipActive]}
            onPress={() => setRole('doctor')}
          >
            <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>Doctor</Text>
          </Pressable>
        </View>
        <Pressable style={styles.button} disabled={loading} onPress={onContinue}>
          <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  roleChipActive: { borderColor: colors.primary, backgroundColor: '#e8f3ff' },
  roleText: { color: colors.textPrimary, fontWeight: '600' },
  roleTextActive: { color: colors.primaryDark },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
