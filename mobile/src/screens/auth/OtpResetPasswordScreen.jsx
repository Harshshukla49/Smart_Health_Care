import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { resetPasswordWithFirebasePhone } from '../../services/authService';
import { colors } from '../../theme/colors';

export function OtpResetPasswordScreen({ navigation, route }) {
  const idToken = route?.params?.idToken || '';
  const role = route?.params?.role || 'patient';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill both password fields.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithFirebasePhone({
        idToken,
        role,
        newPassword,
        confirmPassword,
      });
      Alert.alert('Success', 'Password reset successful.', [
        { text: 'Go to Login', onPress: () => navigation.navigate('LoginSelection') },
      ]);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Password reset failed.';
      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>Role: {role}</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable style={styles.button} disabled={loading} onPress={onSubmit}>
          <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Reset Password'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
