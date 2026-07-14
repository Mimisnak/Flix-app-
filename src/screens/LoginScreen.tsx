import React, { useState, useEffect } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { alert } from '../lib/alert';
import { getRememberedEmail, setRememberMe as persistRememberMe } from '../lib/rememberMe';

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState('');

  useEffect(() => {
    // Prefill remembered email
    getRememberedEmail().then((savedEmail) => {
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    });
  }, []);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      alert('Σφάλμα', 'Συμπλήρωσε email και κωδικό.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      // Deliberately generic — Supabase itself never says which one is
      // wrong, to stop someone from probing emails to see which have an
      // account. Same wording regardless of the underlying reason.
      alert('Σφάλμα Σύνδεσης', 'Λάθος email ή κωδικός.');
    } else {
      // Remember Me: checked = stay signed in across app restarts;
      // unchecked = require login again next time the app is opened.
      await persistRememberMe(rememberMe, email.trim());
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Small logo top */}
          <View style={styles.headerRow}>
            <Image
              source={require('../../assets/logo2.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Sign In</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholderTextColor="#555566"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { paddingRight: 50 }]}
                placeholder="••••••••••••"
                placeholderTextColor="#555566"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#888899" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.loginBtnWrapper}
          >
            <LinearGradient
              colors={loading ? ['#333', '#333'] : [Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtn}
            >
              <Text style={styles.loginBtnText}>
                {loading ? 'Παρακαλώ περιμένετε...' : 'Sign In'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign up */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.signupRow}
            activeOpacity={0.7}
          >
            <Text style={styles.signupText}>
              Don't have an account?{' '}
              <Text style={styles.signupLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 28,
  },
  headerRow: {
    marginBottom: 14,
  },
  headerLogo: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 28,
    letterSpacing: 0.3,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#888899',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A35',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#444455',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(0,201,167,0.05)',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  rememberText: {
    color: '#888899',
    fontSize: 13,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  loginBtnWrapper: {
    marginBottom: 28,
  },
  loginBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signupRow: {
    alignItems: 'center',
  },
  signupText: {
    color: '#888899',
    fontSize: 14,
  },
  signupLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

