import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export function DoctorLoginScreen({ navigation }) {
  const { signInDoctor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signInDoctor({ email, password });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Doctor login failed';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Doctor Login</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} disabled={loading} onPress={onSubmit}>
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('OtpEnterPhone')}>
          <Text style={styles.link}>Forgot password? Reset with OTP</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { textAlign: 'center', color: colors.primaryDark, fontWeight: '600', marginTop: 8 },
});
