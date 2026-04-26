import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_APP_URL } from '../../config/env';
import { colors } from '../../theme/colors';

export function WebAppMirrorScreen() {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Website load failed</Text>
          <Text style={styles.message}>Could not open the web app URL.</Text>
          <Text style={styles.url}>{WEB_APP_URL}</Text>
          <Text style={styles.hint}>Set EXPO_PUBLIC_WEB_APP_URL to your deployed frontend or LAN frontend URL.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading website UI...</Text>
        </View>
      ) : null}

      <WebView
        source={{ uri: WEB_APP_URL }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: colors.background },
  loaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
    backgroundColor: colors.background,
  },
  loaderText: { color: colors.textSecondary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  message: { color: colors.textSecondary },
  url: { color: colors.primaryDark, textAlign: 'center', fontWeight: '700' },
  hint: { color: colors.textSecondary, textAlign: 'center' },
});
