import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { sendPushToOnlineDrivers } from '../../lib/notifications';
import { Customer } from '../../types';
import { Colors } from '../../constants/colors';

const OPEN_ORDER_STREET = 'Ανοιχτή Παραγγελία';

interface ShopOption { id: string; name: string; }

export default function OwnerNewOrderScreen() {
  const navigation = useNavigation<any>();

  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isOpenOrder, setIsOpenOrder] = useState(false);
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchShops(); }, []);

  async function fetchShops() {
    const { data } = await supabase
      .from('users')
      .select('id, shops(name)')
      .eq('role', 'shop')
      .eq('active', true);

    if (data) {
      const options = data
        .map((u: any) => ({ id: u.id, name: u.shops?.name ?? 'Άγνωστο' }))
        .sort((a: ShopOption, b: ShopOption) => a.name.localeCompare(b.name));
      setShops(options);
    }
  }

  async function doSearchCustomer(phoneInput: string) {
    if (!shopId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
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
    if (!shopId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
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

  async function saveCustomer() {
    if (!phone || !shopId) return;
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_id', shopId)
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
        shop_id: shopId,
        phone,
        name: customerName || null,
        address: street,
        bell: bell || null,
        floor: floor || null,
      });
    }
  }

  async function handleSubmit() {
    if (!shopId) {
      Alert.alert('Σφάλμα', 'Επίλεξε για ποιο μαγαζί είναι η παραγγελία.');
      return;
    }
    if (!isOpenOrder && !street.trim()) {
      Alert.alert('Σφάλμα', 'Η διεύθυνση είναι υποχρεωτική');
      return;
    }

    setLoading(true);

    const parsedAmount = parseFloat(amount.replace(',', '.'));

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        shop_id: shopId,
        street: isOpenOrder ? OPEN_ORDER_STREET : street.trim(),
        phone: isOpenOrder ? null : (phone.trim() || null),
        customer_name: isOpenOrder ? null : (customerName.trim() || null),
        bell: isOpenOrder ? null : (bell.trim() || null),
        floor: isOpenOrder ? null : (floor.trim() || null),
        notes: notes.trim() || null,
        amount: isNaN(parsedAmount) ? null : parsedAmount,
        status: 'pending',
        created_by_owner: true,
        is_open_order: isOpenOrder,
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
      event: '🟡 Βγήκε παραγγελία (καταχωρήθηκε από τον διαχειριστή)',
    });

    if (!isOpenOrder) await saveCustomer();
    const shopName = shops.find(s => s.id === shopId)?.name ?? '';
    sendPushToOnlineDrivers('🔔 Νέα παραγγελία!', isOpenOrder ? `🏬 ${shopName}` : `📍 ${street.trim()}`);

    setLoading(false);
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Μαγαζί <Text style={styles.required}>*</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {shops.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.shopChip, shopId === s.id && styles.shopChipActive]}
              onPress={() => setShopId(s.id)}
            >
              <Text style={[styles.shopChipText, shopId === s.id && styles.shopChipTextActive]}>
                🏬 {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          {shops.length === 0 && (
            <Text style={styles.emptyShops}>Δεν υπάρχουν ενεργά μαγαζιά</Text>
          )}
        </ScrollView>

        <View style={styles.openOrderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.openOrderTitle}>Ανοιχτή Παραγγελία</Text>
            <Text style={styles.openOrderHint}>
              Χωρίς διεύθυνση/τηλέφωνο/όνομα — μόνο το μαγαζί. Χρήσιμο όταν ξέρετε ήδη πού πάει.
            </Text>
          </View>
          <Switch
            value={isOpenOrder}
            onValueChange={setIsOpenOrder}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {!isOpenOrder && (
          <>
            <Text style={styles.label}>Τηλέφωνο</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={Colors.textMuted}
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
              placeholderTextColor={Colors.textMuted}
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
              placeholderTextColor={Colors.textMuted}
              value={customerName}
              onChangeText={setCustomerName}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Κουδούνι</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Προαιρετικό"
                  placeholderTextColor={Colors.textMuted}
                  value={bell}
                  onChangeText={setBell}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Όροφος</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Προαιρετικό"
                  placeholderTextColor={Colors.textMuted}
                  value={floor}
                  onChangeText={setFloor}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}

        <Text style={styles.label}>Ποσό (€)</Text>
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Σημειώσεις</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Προαιρετικό"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
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
  shopScroll: { flexDirection: 'row' },
  shopChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  shopChipActive: { backgroundColor: Colors.primaryHover, borderColor: Colors.primary },
  shopChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  shopChipTextActive: { color: Colors.primary },
  emptyShops: { color: Colors.textMuted, fontSize: 13, paddingVertical: 10 },
  openOrderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14, marginTop: 16,
  },
  openOrderTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  openOrderHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 16 },
  suggestions: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginTop: 4, overflow: 'hidden',
  },
  suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggPhone: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 14 },
  suggDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  submitBtn: {
    backgroundColor: Colors.primary, padding: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
