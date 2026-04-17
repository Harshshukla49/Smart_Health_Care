import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginSelectionScreen } from '../screens/auth/LoginSelectionScreen';
import { DoctorLoginScreen } from '../screens/auth/DoctorLoginScreen';
import { PatientLoginScreen } from '../screens/auth/PatientLoginScreen';
import { DoctorSignupScreen } from '../screens/auth/DoctorSignupScreen';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { PatientListScreen } from '../screens/app/PatientListScreen';
import { PatientDetailsScreen } from '../screens/app/PatientDetailsScreen';
import { ChatScreen } from '../screens/app/ChatScreen';
import { SosScreen } from '../screens/app/SosScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const PatientsStack = createNativeStackNavigator();

function DoctorPatientsNavigator() {
  return (
    <PatientsStack.Navigator>
      <PatientsStack.Screen name="PatientList" component={PatientListScreen} options={{ title: 'Patients' }} />
      <PatientsStack.Screen name="PatientDetails" component={PatientDetailsScreen} options={{ title: 'Patient Details' }} />
    </PatientsStack.Navigator>
  );
}

function DoctorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Patients" component={DoctorPatientsNavigator} options={{ headerShown: false }} />
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
    <Stack.Navigator>
      <Stack.Screen name="LoginSelection" component={LoginSelectionScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="DoctorLogin" component={DoctorLoginScreen} options={{ title: 'Doctor Login' }} />
      <Stack.Screen name="PatientLogin" component={PatientLoginScreen} options={{ title: 'Patient Login' }} />
      <Stack.Screen name="DoctorSignup" component={DoctorSignupScreen} options={{ title: 'Doctor Signup' }} />
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
