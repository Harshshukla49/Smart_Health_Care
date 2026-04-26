import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AppProviders } from './src/app/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { WebAppMirrorScreen } from './src/screens/public/WebAppMirrorScreen';

const USE_WEB_MIRROR = String(process.env.EXPO_PUBLIC_USE_WEB_MIRROR || '').toLowerCase() === 'true';

export default function App() {
  if (USE_WEB_MIRROR) {
    return (
      <>
        <StatusBar style="dark" />
        <WebAppMirrorScreen />
      </>
    );
  }

  return (
    <AppProviders>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AppProviders>
  );
}
