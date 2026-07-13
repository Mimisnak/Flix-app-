import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { sendPushToOnlineDrivers } from '../../lib/notifications';
import { Customer } from '../../types';
import { Colors } from '../../constants/colors';

export default function NewOrderScreen() {
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [street, setStreet] = useState('');
  const [bell, setBell] = useState('');
  const [floor, setFloor] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigation = useNavigation<any>();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { initShop(); }, []);

  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`new-order-shop-status-${shopId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${shopId}` },
        (payload: any) => setIsOpen(payload.new.online_status)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function initShop() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setShopId(user.id);
    const { data } = await supabase.from('users').select('online_status').eq('id', user.id).single();
    if (data) setIsOpen(data.online_status);
  }

  async function openShop() {
    if (!shopId) return;
    await supabase.from('users').update({ online_status: true, last_seen_at: new Date().toISOString() }).eq('id', shopId);
    setIsOpen(true);
  }

  async function doSearchCustomer(phoneInput: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', user.id)
      .ilike('phone', `${phoneInput}%`)
      .limit(5);
    setSuggestions((data as Customer[]) ?? []);
  }

  function handlePhoneChange(phoneInput: string) {
    setPhone(phoneInput);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (phoneInput.length < 4) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(() => doSearchCustomer(phoneInput), 350);
  }

  // Same idea as phone search, but keyed by address — a shared street
  // (apartment block, same road) can belong to several different
  // customers, so typing the street should offer them as a choice too.
  async function doSearchByStreet(streetInput: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', user.id)
      .ilike('address', `%${streetInput}%`)
      .limit(5);
    setStreetSuggestions((data as Customer[]) ?? []);
  }

  function handleStreetChange(streetInput: string) {
    setStreet(streetInput);
    if (streetSearchTimer.current) clearTimeout(streetSearchTimer.current);
    if (streetInput.trim().length < 3) { setStreetSuggestions([]); return; }
    streetSearchTimer.current = setTimeout(() => doSearchByStreet(streetInput), 350);
  }

  function applyCustomer(c: Customer) {
    setPhone(c.phone);
    setCustomerName(c.name ?? '');
    setStreet(c.address ?? '');
    setBell(c.bell ?? '');
    setFloor(c.floor ?? '');
    setSuggestions([]);
    setStreetSuggestions([]);
  }

  async function saveCustomer(userId: string) {
    if (!phone) return;

    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_id', userId)
      .eq('phone', phone)
      .single();

    if (existing) {
      await supabase.from('customers').update({
        name: customerName || null,
        address: street,
        bell: bell || null,
        floor: floor || null,
      }).eq('id', existing.id);
    } else {
      await supabase.from('customers').insert({
        shop_id: userId,
        phone,
        name: customerName || null,
        address: street,
        bell: bell || null,
        floor: floor || null,
      });
    }
  }

  async function handleSubmit() {
    if (!street.trim()) {
      Alert.alert('Σφάλμα', 'Η διεύθυνση είναι υποχρεωτική');
      return;
    }
    if (!isOpen) {
      Alert.alert('Το μαγαζί είναι κλειστό', 'Άνοιξε το μαγαζί για να δημιουργήσεις παραγγελία.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const parsedAmount = parseFloat(amount.replace(',', '.'));

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        shop_id: user.id,
        street: street.trim(),
        phone: phone.trim() || null,
        customer_name: customerName.trim() || null,
        bell: bell.trim() || null,
        floor: floor.trim() || null,
        notes: notes.trim() || null,
        amount: isNaN(parsedAmount) ? null : parsedAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Σφάλμα', error.message);
      setLoading(false);
      return;
    }

    await supabase.from('order_timeline').insert({
      order_id: order.id,
      event: '🟡 Βγήκε παραγγελία',
    });

    await saveCustomer(user.id);
    sendPushToOnlineDrivers('🔔 Νέα παραγγελία!', `📍 ${street.trim()}`);

    setLoading(false);
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!isOpen && (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>
              Το μαγαζί είναι κλειστό — άνοιξέ το για να δημιουργήσεις παραγγελία.
            </Text>
            <TouchableOpacity style={styles.openBtn} onPress={openShop}>
              <Text style={styles.openBtnText}>Άνοιγμα Μαγαζιού</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Τηλέφωνο</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={handlePhoneChange}
        />

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.suggestion}
                onPress={() => applyCustomer(s)}
              >
                <Text style={styles.suggPhone}>{s.phone}</Text>
                <Text style={styles.suggDetail}>
                  {[s.name, s.address].filter(Boolean).join(' — ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Διεύθυνση <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Οδός + αριθμός"
          value={street}
          onChangeText={handleStreetChange}
        />

        {streetSuggestions.length > 0 && (
          <View style={styles.suggestions}>
            {streetSuggestions.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.suggestion}
                onPress={() => applyCustomer(s)}
              >
                <Text style={styles.suggPhone}>{s.name || 'Χωρίς όνομα'} — {s.phone}</Text>
                <Text style={styles.suggDetail}>{s.address}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Όνομα Παραλήπτη</Text>
        <TextInput
          style={styles.input}
          placeholder="Προαιρετικό"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Κουδούνι</Text>
            <TextInput
              style={styles.input}
              placeholder="Προαιρετικό"
              value={bell}
              onChangeText={setBell}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Όροφος</Text>
            <TextInput
              style={styles.input}
              placeholder="Προαιρετικό"
              value={floor}
              onChangeText={setFloor}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.label}>Ποσό (€)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Σημειώσεις</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Προαιρετικό"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, (loading || !isOpen) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || !isOpen}
        >
          <Text style={styles.submitText}>
            {loading ? 'Αποθήκευση...' : '✓ Καταχώρηση Παραγγελίας'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 5, marginTop: 14 },
  required: { color: Colors.error },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 13, fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  suggestions: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginBottom: 4, overflow: 'hidden',
  },
  suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggPhone: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 14 },
  suggDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  closedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  closedBannerText: { color: Colors.error, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  openBtn: {
    backgroundColor: Colors.success, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  openBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  submitBtn: {
    backgroundColor: Colors.primary, padding: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 24,
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { backgroundColor: Colors.primaryDark, opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
