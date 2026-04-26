import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { verifyFirebasePhoneToken } from '../../services/authService';
import { colors } from '../../theme/colors';

export function OtpVerifyScreen({ navigation, route }) {
  const phone = route?.params?.phone || '';
  const role = route?.params?.role || 'patient';
  const [idToken, setIdToken] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (!String(idToken || '').trim()) {
      Alert.alert('Token required', 'Please paste the Firebase phone token.');
      return;
    }

    setLoading(true);
    try {
      const verified = await verifyFirebasePhoneToken({ idToken, role });
      navigation.navigate('OtpResetPassword', {
        idToken,
        role,
        phone: verified?.phone || phone,
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'OTP verification failed.';
      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Phone: {phone || 'Not provided'}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Paste Firebase ID token"
          value={idToken}
          onChangeText={setIdToken}
        />
        <Pressable style={styles.button} disabled={loading} onPress={onVerify}>
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
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
    minHeight: 110,
    textAlignVertical: 'top',
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
