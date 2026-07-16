import React, { useState } from 'react';
import {
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
import { validateName } from '../lib/validateName';
import { registrationGuard } from '../lib/registrationGuard';

type Role = 'shop' | 'driver';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();

  const [role, setRole] = useState<Role>('shop');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('Σφάλμα', 'Συμπλήρωσε όλα τα υποχρεωτικά πεδία.');
      return;
    }
    const nameError = validateName(name, role);
    if (nameError) {
      alert('Σφάλμα', nameError);
      return;
    }
    if (password.length < 6) {
      alert('Σφάλμα', 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Σφάλμα', 'Οι κωδικοί δεν ταιριάζουν.');
      return;
    }
    if (!acceptTerms) {
      alert('Σφάλμα', 'Πρέπει να αποδεχτείς τους Όρους Χρήσης για να συνεχίσεις.');
      return;
    }

    setLoading(true);
    // signUp() creates a session immediately, which independently fires a
    // SIGNED_IN event in AppNavigator — that would otherwise race ahead of
    // the create_user_profile() RPC below and show a scary "account not
    // found" alert a split second before this screen's own success alert.
    registrationGuard.inProgress = true;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        alert('Σφάλμα', 'Αυτό το email χρησιμοποιείται ήδη από άλλο λογαριασμό.');
      } else {
        alert('Σφάλμα', error.message);
      }
      registrationGuard.inProgress = false;
      setLoading(false);
      return;
    }

    // Supabase returns a "successful" signUp with an empty identities array
    // instead of an explicit error when the email already belongs to a
    // confirmed account — deliberate, to stop someone from probing emails
    // to see which already have an account. Needs its own check.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      alert('Σφάλμα', 'Αυτό το email χρησιμοποιείται ήδη από άλλο λογαριασμό.');
      registrationGuard.inProgress = false;
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      alert('Σφάλμα', 'Δεν δημιουργήθηκε χρήστης. Δοκίμασε ξανά.');
      registrationGuard.inProgress = false;
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.rpc('create_user_profile', {
      p_user_id: userId,
      p_role: role,
      p_name: name.trim(),
    });

    if (profileError) {
      alert('Σφάλμα', profileError.message);
      registrationGuard.inProgress = false;
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    registrationGuard.inProgress = false;
    setLoading(false);

    alert(
      '✅ Επιτυχία!',
      'Ο λογαριασμός σου δημιουργήθηκε. Αν χρειάζεται επιβεβαίωση, θα λάβεις email — μετά αναμένει έγκριση από τον διαχειριστή.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
    );
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
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Δημιούργησε τον λογαριασμό σου για να ξεκινήσεις</Text>

        {/* Role selection */}
        <Text style={styles.sectionLabel}>Τύπος Λογαριασμού</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'shop' && styles.roleBtnActive]}
            onPress={() => setRole('shop')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, role === 'shop' && styles.roleTextActive]}>
              Κατάστημα
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'driver' && styles.roleBtnActive]}
            onPress={() => setRole('driver')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, role === 'driver' && styles.roleTextActive]}>
              Διανομέας
            </Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {role === 'shop' ? 'Όνομα Καταστήματος' : 'Ονοματεπώνυμο'}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholderTextColor="#555566"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Email */}
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

        {/* Phone (optional) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Τηλέφωνο <Text style={styles.optional}>(προαιρετικό)</Text></Text>
          <View style={styles.inputWrap}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+30</Text>
            </View>
            <TextInput
              style={[styles.input, { borderLeftWidth: 0 }]}
              placeholderTextColor="#555566"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Κωδικός</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { paddingRight: 50 }]}
              placeholder="Τουλάχιστον 6 χαρακτήρες"
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

        {/* Confirm Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Επιβεβαίωση Κωδικού</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { paddingRight: 50 }]}
              placeholder="Επανάλαβε τον κωδικό"
              placeholderTextColor="#555566"
              secureTextEntry={!showConfirm}
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

        {/* Accept terms */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAcceptTerms(!acceptTerms)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
            {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            Αποδέχομαι τους{' '}
            <Text style={styles.termsLink}>Όρους Χρήσης</Text>
            {' '}και την{' '}
            <Text style={styles.termsLink}>Πολιτική Απορρήτου</Text>
          </Text>
        </TouchableOpacity>

        {/* Submit button */}
        <TouchableOpacity
          onPress={handleRegister}
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
              {loading ? 'Παρακαλώ περιμένετε...' : 'Create Account'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign in link */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.signinRow}
          activeOpacity={0.7}
        >
          <Text style={styles.signinText}>
            Already have an account?{' '}
            <Text style={styles.signinLink}>Sign In</Text>
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
    paddingBottom: 50,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 28,
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#1A1A1F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888899',
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666677',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#1A1A1F',
    borderWidth: 1.5,
    borderColor: '#2A2A35',
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryHover,
  },
  roleText: {
    fontSize: 13,
    color: '#666677',
    fontWeight: '600',
  },
  roleTextActive: {
    color: Colors.primary,
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
  optional: {
    color: '#555566',
    fontWeight: '400',
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
  prefixBox: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#2A2A35',
  },
  prefixText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF5555',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#444455',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    backgroundColor: 'rgba(0,201,167,0.05)',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checkLabel: {
    color: '#888899',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  btnWrapper: {
    marginTop: 28,
    marginBottom: 24,
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
  signinRow: {
    alignItems: 'center',
  },
  signinText: {
    color: '#888899',
    fontSize: 14,
  },
  signinLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

