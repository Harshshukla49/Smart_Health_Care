import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { PublicHomeScreen } from '../screens/public/PublicHomeScreen';
import { PublicBlogScreen } from '../screens/public/PublicBlogScreen';
import { PublicContactScreen } from '../screens/public/PublicContactScreen';
import { LoginSelectionScreen } from '../screens/auth/LoginSelectionScreen';
import { DoctorLoginScreen } from '../screens/auth/DoctorLoginScreen';
import { PatientLoginScreen } from '../screens/auth/PatientLoginScreen';
import { DoctorSignupScreen } from '../screens/auth/DoctorSignupScreen';
import { OtpEnterPhoneScreen } from '../screens/auth/OtpEnterPhoneScreen';
import { OtpVerifyScreen } from '../screens/auth/OtpVerifyScreen';
import { OtpResetPasswordScreen } from '../screens/auth/OtpResetPasswordScreen';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { PatientListScreen } from '../screens/app/PatientListScreen';
import { PatientDetailsScreen } from '../screens/app/PatientDetailsScreen';
import { AddPatientScreen } from '../screens/app/AddPatientScreen';
import { ChatScreen } from '../screens/app/ChatScreen';
import { SosScreen } from '../screens/app/SosScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const PatientsStack = createNativeStackNavigator();

function DoctorPatientsNavigator() {
  return (
    <PatientsStack.Navigator>
      <PatientsStack.Screen name="PatientList" component={PatientListScreen} options={{ title: 'Patients' }} />
      <PatientsStack.Screen name="AddPatient" component={AddPatientScreen} options={{ title: 'Add Patient' }} />
      <PatientsStack.Screen name="PatientDetails" component={PatientDetailsScreen} options={{ title: 'Patient Details' }} />
    </PatientsStack.Navigator>
  );
}

function DoctorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Patients" component={DoctorPatientsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="AddPatient" component={AddPatientScreen} options={{ title: 'Add Patient' }} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="SOS" component={SosScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function PatientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="MyHealth" component={PatientDetailsScreen} options={{ title: 'My Health' }} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="SOS" component={SosScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="PublicHome">
      <Stack.Screen name="PublicHome" component={PublicHomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="PublicBlog" component={PublicBlogScreen} options={{ title: 'Blog' }} />
      <Stack.Screen name="PublicContact" component={PublicContactScreen} options={{ title: 'Contact' }} />
      <Stack.Screen name="LoginSelection" component={LoginSelectionScreen} options={{ title: 'Login' }} />
      <Stack.Screen name="DoctorLogin" component={DoctorLoginScreen} options={{ title: 'Doctor Login' }} />
      <Stack.Screen name="PatientLogin" component={PatientLoginScreen} options={{ title: 'Patient Login' }} />
      <Stack.Screen name="DoctorSignup" component={DoctorSignupScreen} options={{ title: 'Doctor Signup' }} />
      <Stack.Screen name="OtpEnterPhone" component={OtpEnterPhoneScreen} options={{ title: 'Reset Password' }} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ title: 'Verify OTP' }} />
      <Stack.Screen name="OtpResetPassword" component={OtpResetPasswordScreen} options={{ title: 'Set Password' }} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session?.token) {
    return <AuthStack />;
  }

  return session.role === 'doctor' ? <DoctorTabs /> : <PatientTabs />;
}
