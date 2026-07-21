import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { alert } from '../lib/alert';
import { Colors } from '../constants/colors';

interface Props {
  // Called once the user has confirmed the "password updated" message —
  // AppNavigator uses this to sign out and land back on the Login screen.
  onDone: () => void;
}

export default function UpdatePasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) {
      alert('Σφάλμα', 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Σφάλμα', 'Οι κωδικοί δεν ταιριάζουν.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      alert('Σφάλμα', error.message);
      return;
    }

    alert(
      '✅ Επιτυχία!',
      'Ο κωδικός σου άλλαξε. Συνδέσου ξανά με τον νέο σου κωδικό.',
      [{ text: 'OK', onPress: onDone }]
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        <Text style={styles.title}>Νέος Κωδικός</Text>
        <Text style={styles.subtitle}>
          Διάλεξε έναν νέο κωδικό για τον λογαριασμό σου.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Νέος Κωδικός</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { paddingRight: 50 }]}
              placeholder="Τουλάχιστον 6 χαρακτήρες"
              placeholderTextColor="#555566"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Επιβεβαίωση Κωδικού</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { paddingRight: 50 }]}
              placeholder="Επανάλαβε τον κωδικό"
              placeholderTextColor="#555566"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm(!showConfirm)}
              activeOpacity={0.7}
            >
              <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#888899" />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.errorText}>Οι κωδικοί δεν ταιριάζουν</Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.btnWrapper}
        >
          <LinearGradient
            colors={loading ? ['#333', '#333'] : [Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>
              {loading ? 'Παρακαλώ περιμένετε...' : 'Ενημέρωση Κωδικού'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#888899',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#888899',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
  errorText: {
    color: '#FF5555',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  btnWrapper: {
    marginTop: 12,
  },
  btn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
