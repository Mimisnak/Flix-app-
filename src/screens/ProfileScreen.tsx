import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';

const ROLE_LABELS: Record<string, string> = {
  shop: '🏬 Μαγαζί',
  driver: '🛵 Διανομέας',
  owner: '👑 Διαχειριστής',
  developer: '👨‍💻 Developer',
};

export default function ProfileScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const [role, setRole] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setEmail(user.email ?? '');

    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!userRow) return;
    setRole(userRow.role);

    if (userRow.role !== 'shop' && userRow.role !== 'driver') return;

    const table = userRow.role === 'shop' ? 'shops' : 'drivers';
    const { data } = await supabase
      .from(table)
      .select('name, phone')
      .eq('id', user.id)
      .single();
    if (data) {
      setName((data as any).name ?? '');
      setPhone((data as any).phone ?? '');
    }
  }

  async function saveProfile() {
    if (!name.trim()) {
      Alert.alert('Σφάλμα', 'Το όνομα είναι υποχρεωτικό');
      return;
    }
    setSaving(true);
    const table = role === 'shop' ? 'shops' : 'drivers';
    const { error } = await supabase
      .from(table)
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('id', userId);
    setSaving(false);
    if (error) Alert.alert('Σφάλμα', error.message);
    else Alert.alert('✅ Αποθηκεύτηκε', 'Τα στοιχεία σου ενημερώθηκαν.');
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      Alert.alert('Σφάλμα', 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) Alert.alert('Σφάλμα', error.message);
    else {
      setNewPassword('');
      Alert.alert('✅ Ενημερώθηκε', 'Ο κωδικός σου άλλαξε.');
    }
  }

  function handleSignOut() {
    Alert.alert('Αποσύνδεση', 'Είσαι σίγουρος ότι θέλεις να αποσυνδεθείς;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Αποσύνδεση',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const hasEditableProfile = role === 'shop' || role === 'driver';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.headerTitle}>Το Προφίλ μου</Text>
          <Text style={styles.headerSub}>{email}</Text>
          <Text style={styles.headerRole}>{ROLE_LABELS[role] ?? role}</Text>
        </LinearGradient>

        {hasEditableProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Στοιχεία</Text>

            <Text style={styles.label}>Όνομα</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Το όνομα σου"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Τηλέφωνο</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? 'Αποθήκευση...' : '💾 Αποθήκευση'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Αλλαγή Κωδικού</Text>

          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Νέος κωδικός (min 6 χαρακτήρες)"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, (saving || !newPassword) && styles.btnDisabled]}
            onPress={changePassword}
            disabled={saving || !newPassword}
          >
            <Text style={styles.btnText}>🔐 Αλλαγή Κωδικού</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => navigation.navigate('Help')}
          activeOpacity={0.7}
        >
          <Text style={styles.helpText}>📖 Οδηγός Χρήσης</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && styles.btnDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>{signingOut ? 'Αποσύνδεση...' : '🚪 Αποσύνδεση'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 32 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  headerRole: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 },
  section: {
    backgroundColor: Colors.surface, margin: 12, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 'bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    padding: 11, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
  },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eyeBtn: { position: 'absolute', right: 12, padding: 4 },
  btn: {
    backgroundColor: Colors.primary, padding: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 16,
  },
  btnSecondary: { backgroundColor: Colors.purple },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  helpBtn: {
    marginHorizontal: 12, marginTop: 16, padding: 14, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  helpText: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15 },
  signOutBtn: {
    marginHorizontal: 12, marginTop: 10, padding: 14, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  signOutText: { color: Colors.error, fontWeight: 'bold', fontSize: 15 },
});
