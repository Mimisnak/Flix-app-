import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, FlatList, Modal, StyleSheet,
  Switch, TextInput, TouchableOpacity, View,
} from 'react-native';
import Text from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { DirectoryEntry } from '../../types';
import { Colors } from '../../constants/colors';
import { isReallyOnline } from '../../lib/onlineStatus';

type Tab = 'shop' | 'driver';

export default function DirectoryScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('shop');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('directory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchEntries)
      .subscribe();

    // Fallback: the realtime socket can silently drop (phone sleep, network
    // switch) without reconnecting fast enough. Poll so the list never
    // stays stale for more than a few seconds even if that happens.
    const poll = setInterval(fetchEntries, 8000);

    // Also refetch the moment the app comes back to the foreground, so
    // reopening after the phone was asleep doesn't wait for the poll tick.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchEntries();
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      appStateSub.remove();
    };
  }, []);

  async function fetchEntries() {
    const { data } = await supabase
      .from('users')
      .select('id, email, active, online_status, last_seen_at, can_view_orders, shops(name, phone), drivers(name, phone)')
      .in('role', ['shop', 'driver'])
      .order('active', { ascending: false });

    if (!data) { setLoading(false); return; }

    const result: DirectoryEntry[] = data.map((u: any) => {
      const role: 'shop' | 'driver' = u.shops ? 'shop' : 'driver';
      const profile = u.shops ?? u.drivers;
      return {
        id: u.id,
        role,
        name: profile?.name ?? 'Άγνωστος',
        phone: profile?.phone ?? null,
        email: u.email,
        active: u.active,
        online_status: isReallyOnline(u.online_status, u.last_seen_at),
        last_seen_at: u.last_seen_at,
        can_view_orders: u.can_view_orders,
      };
    });

    setEntries(result);
    setLoading(false);
  }

  async function deleteAccount(entry: DirectoryEntry) {
    Alert.alert(
      'Οριστική Διαγραφή',
      `Θα διαγραφούν οριστικά ο/η "${entry.name}" και ΟΛΕΣ οι παραγγελίες/ιστορικό του. Δεν αναιρείται.`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_account', { p_user_id: entry.id });
            if (error) Alert.alert('Σφάλμα', error.message);
            else fetchEntries();
          },
        },
      ]
    );
  }

  async function toggleCanViewOrders(entry: DirectoryEntry) {
    await supabase
      .from('users')
      .update({ can_view_orders: !entry.can_view_orders })
      .eq('id', entry.id);
  }

  async function createShop() {
    if (!newShopName.trim()) {
      Alert.alert('Σφάλμα', 'Το όνομα του μαγαζιού είναι υποχρεωτικό.');
      return;
    }
    setCreating(true);
    const { error } = await supabase.rpc('create_shop_without_account', {
      p_name: newShopName.trim(),
      p_phone: newShopPhone.trim() || null,
    });
    setCreating(false);
    if (error) {
      Alert.alert('Σφάλμα', error.message);
      return;
    }
    setNewShopName('');
    setNewShopPhone('');
    setCreateModalVisible(false);
    fetchEntries();
  }

  const filtered = entries.filter(e => e.role === tab);

  const renderItem = useCallback(({ item }: { item: DirectoryEntry }) => (
    <View style={[styles.card, !item.active && styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        {!item.active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Ανενεργός</Text>
          </View>
        )}
        {item.active && (
          <Text style={styles.onlineDot}>{item.online_status ? '🟢' : '⚫'}</Text>
        )}
      </View>

      {item.phone ? <Text style={styles.detail}>📞 {item.phone}</Text> : null}
      {item.email
        ? <Text style={styles.detail}>✉️ {item.email}</Text>
        : <Text style={styles.noAccountText}>🚫 Χωρίς λογαριασμό (δημιουργήθηκε από τον διαχειριστή)</Text>
      }

      {item.role === 'driver' && item.active && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Βλέπει τις παραγγελίες</Text>
          <Switch
            value={item.can_view_orders}
            onValueChange={() => toggleCanViewOrders(item)}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionBtn, styles.deactivateBtn]}
        onPress={() => deleteAccount(item)}
      >
        <Text style={[styles.actionBtnText, styles.deactivateBtnText]}>
          🗑️ Διαγραφή
        </Text>
      </TouchableOpacity>
    </View>
  ), [entries]);

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'shop' && styles.tabActive]}
          onPress={() => setTab('shop')}
        >
          <Text style={[styles.tabText, tab === 'shop' && styles.tabTextActive]}>Μαγαζιά</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'driver' && styles.tabActive]}
          onPress={() => setTab('driver')}
        >
          <Text style={[styles.tabText, tab === 'driver' && styles.tabTextActive]}>Οδηγοί</Text>
        </TouchableOpacity>
      </View>

      {tab === 'shop' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { flex: 1 }]}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.headerActionBtnText}>🏬 Δημιουργία Μαγαζιού</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { flex: 1 }]}
            onPress={() => navigation.navigate('OwnerNewOrder')}
          >
            <Text style={styles.headerActionBtnText}>➕ Νέα Παραγγελία</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create-shop modal — no email/password, just a name + optional phone */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🏬 Δημιουργία Μαγαζιού</Text>
            <Text style={styles.modalSubtitle}>
              Για μαγαζιά που δεν θα χρησιμοποιήσουν ποτέ την εφαρμογή — χωρίς email/κωδικό.
            </Text>

            <Text style={styles.modalLabel}>Όνομα Μαγαζιού *</Text>
            <TextInput
              style={styles.modalInput}
              placeholderTextColor={Colors.textMuted}
              value={newShopName}
              onChangeText={setNewShopName}
              autoFocus
            />

            <Text style={styles.modalLabel}>Τηλέφωνο (προαιρετικό)</Text>
            <TextInput
              style={styles.modalInput}
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={newShopPhone}
              onChangeText={setNewShopPhone}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => { setCreateModalVisible(false); setNewShopName(''); setNewShopPhone(''); }}
              >
                <Text style={styles.modalBtnCancelText}>Ακύρωση</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, creating && { opacity: 0.6 }]}
                onPress={createShop}
                disabled={creating}
              >
                <Text style={styles.modalBtnConfirmText}>{creating ? 'Δημιουργία...' : 'Δημιουργία'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.center}>Δεν υπάρχουν εγγραφές</Text>}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14,
    padding: 4, margin: 12, marginBottom: 0,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: Colors.surfaceAlt },
  tabText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: Colors.textPrimary },
  actionsRow: { flexDirection: 'row', gap: 10, margin: 12 },
  headerActionBtn: {
    backgroundColor: Colors.primaryHover, borderWidth: 1, borderColor: Colors.primary,
    padding: 13, borderRadius: 12, alignItems: 'center',
  },
  headerActionBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 13 },
  center: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: {
    backgroundColor: Colors.surface, margin: 8, marginTop: 4, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, flex: 1 },
  onlineDot: { fontSize: 14 },
  inactiveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  inactiveBadgeText: { color: Colors.error, fontSize: 11, fontWeight: '700' },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  noAccountText: { color: Colors.textMuted, marginTop: 3, fontSize: 12, fontStyle: 'italic' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  switchLabel: { color: Colors.textSecondary, fontSize: 13 },
  actionBtn: { marginTop: 12, padding: 11, borderRadius: 10, alignItems: 'center' },
  deactivateBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  actionBtnText: { fontWeight: 'bold', fontSize: 13 },
  deactivateBtnText: { color: Colors.error },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    width: '88%', elevation: 10, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 6 },
  modalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  modalLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 10 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtnCancel: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalBtnCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalBtnConfirm: {
    flex: 1, backgroundColor: Colors.primary, padding: 12,
    borderRadius: 10, alignItems: 'center',
  },
  modalBtnConfirmText: { color: '#fff', fontWeight: 'bold' },
});
