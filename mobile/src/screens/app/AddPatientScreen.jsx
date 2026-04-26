import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createPatient } from '../../services/patientService';
import { colors } from '../../theme/colors';

export function AddPatientScreen({ navigation }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onCreatePatient = async () => {
    if (!name.trim() || !age.trim() || !gender.trim() || !phone.trim() || !email.trim() || !symptoms.trim()) {
      Alert.alert('Missing fields', 'Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await createPatient({
        name: name.trim(),
        age: Number(age),
        gender: gender.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        symptoms: symptoms.trim(),
        notes: notes.trim(),
      });

      const generatedPatientId = response?.credentials?.patientId || response?.patient?.patientId || 'N/A';
      const generatedPassword = response?.credentials?.password || 'N/A';

      Alert.alert(
        'Patient Added',
        `Patient ID: ${generatedPatientId}\nPassword: ${generatedPassword}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to add patient';
      Alert.alert('Add patient failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Patient</Text>
        <Text style={styles.subtitle}>Create a new patient profile from doctor app.</Text>

        <View style={styles.group}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Patient full name" />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Age *</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="Age"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Gender *</Text>
          <TextInput style={styles.input} value={gender} onChangeText={setGender} placeholder="Male / Female / Other" />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Phone *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Symptoms *</Text>
          <TextInput
            style={[styles.input, styles.multiInput]}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Describe key symptoms"
            multiline
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes (optional)"
            multiline
          />
        </View>

        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={onCreatePatient} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Patient</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 8 },
  group: { gap: 6 },
  label: { color: colors.textPrimary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  multiInput: { minHeight: 90, textAlignVertical: 'top' },
  button: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
