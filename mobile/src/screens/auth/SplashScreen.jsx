import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

export function SplashScreen({ navigation }) {
  const { session } = useAuth();
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const text1Anim = useRef(new Animated.Value(0)).current;
  const text2Anim = useRef(new Animated.Value(0)).current;
  const text3Anim = useRef(new Animated.Value(0)).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
    // Floating card
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    // Staggered text
    setTimeout(() => Animated.timing(text1Anim, { toValue: 1, duration: 500, useNativeDriver: true }).start(), 300);
    setTimeout(() => Animated.timing(text2Anim, { toValue: 1, duration: 500, useNativeDriver: true }).start(), 700);
    setTimeout(() => Animated.timing(text3Anim, { toValue: 1, duration: 500, useNativeDriver: true }).start(), 1100);
    // Spinner
    Animated.loop(
      Animated.timing(spinnerAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
    ).start();

    const timeout = setTimeout(() => {
      if (session?.token) navigation.replace('Dashboard');
      else navigation.replace('LoginSelection');
    }, 3500);
    return () => clearTimeout(timeout);
  }, [session, navigation, fadeAnim, scaleAnim, slideAnim, floatAnim, text1Anim, text2Anim, text3Anim, spinnerAnim]);

  // Blurred glowing shapes
  const Blobs = () => (
    <>
      <View style={[styles.blob, { top: 60, left: 30, backgroundColor: '#38bdf8' }]} />
      <View style={[styles.blob, { bottom: 80, right: 40, backgroundColor: '#a855f7' }]} />
      <View style={[styles.blob, { top: height * 0.6, left: width * 0.15, backgroundColor: '#14b8a6', width: 120, height: 120 }]} />
    </>
  );

  return (
    <View style={styles.gradientBg}>
      <Blobs />
      <Animated.View
        style={[
          styles.glassCard,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim },
              { translateY: floatAnim },
            ]
          }
        ]}
      >
        {/* Logo/Icon (replace source with your logo if available) */}
        <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Animated.Text style={[styles.heading, { opacity: text1Anim, transform: [{ translateY: text1Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>Smart Health Care</Animated.Text>
        <Animated.Text style={[styles.welcome, { opacity: text2Anim, transform: [{ translateY: text2Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>Welcome to a smarter way of healthcare <Text>👋</Text></Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: text3Anim, transform: [{ translateY: text3Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>Monitoring. Caring. Connecting.</Animated.Text>
        {/* Animated spinner */}
        <Animated.View style={[styles.spinner, {
          transform: [{ rotate: spinnerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          opacity: text3Anim,
        }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width,
    height,
    backgroundColor: '#232946',
    // Simulate animated gradient with overlay if needed
  },
  blob: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.22,
    zIndex: 0,
    filter: 'blur(40px)', // ignored on native, but kept for web parity
  },
  glassCard: {
    width: width * 0.85,
    maxWidth: 400,
    padding: 32,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    alignSelf: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 18,
    letterSpacing: -1,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  welcome: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e7ef',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#e0e7ef',
    marginBottom: 0,
    fontWeight: '400',
    opacity: 0.85,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 24,
    width: 36,
    height: 36,
    borderWidth: 4,
    borderColor: '#fff4',
    borderTopColor: '#38bdf8',
    borderRadius: 18,
    alignSelf: 'center',
  },
});
