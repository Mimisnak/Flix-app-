import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();

  const logoY = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const btnTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Slight pause then logo moves up
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoY, {
          toValue: -height * 0.17,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.75,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Buttons fade + slide in
        Animated.parallel([
          Animated.timing(btnOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(btnTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Decorative blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            transform: [{ translateY: logoY }, { scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo2.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Flix</Text>
        <Text style={styles.credit}>Created by mimis.dev</Text>
        <Text style={styles.tagline}>Σύστημα Διαχείρισης Παραδόσεων</Text>
      </Animated.View>

      {/* Buttons */}
      <Animated.View
        style={[
          styles.btnContainer,
          {
            opacity: btnOpacity,
            transform: [{ translateY: btnTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
          style={styles.btnWrapper}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>Σύνδεση</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Register')}
          style={[styles.btnWrapper, styles.btnOutlineWrapper]}
        >
          <View style={styles.btnOutline}>
            <Text style={styles.btnOutlineText}>Δημιουργία Λογαριασμού</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Η εφαρμογή διαχείρισης παραδόσεών σου
        </Text>
        <Text style={styles.betaNote}>
          Beta έκδοση — αν αντιμετωπίσεις πρόβλημα, αναφέρετό στο support.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.primaryHover,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(58, 158, 251, 0.06)',
  },
  logoWrap: {
    alignItems: 'center',
    position: 'absolute',
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 30,
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  appName: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 14,
  },
  credit: {
    fontSize: 10,
    color: '#666677',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 13,
    color: '#888899',
    marginTop: 6,
    letterSpacing: 0.4,
  },
  btnContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  btnWrapper: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 14,
  },
  btnPrimary: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnOutlineWrapper: {
    marginBottom: 32,
  },
  btnOutline: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnOutlineText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footerText: {
    color: '#555566',
    fontSize: 12,
    textAlign: 'center',
  },
  betaNote: {
    color: '#F59E0B',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
});
