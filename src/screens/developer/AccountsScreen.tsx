import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { AccountEntry, UserRole } from '../../types';
import { isReallyOnline } from '../../lib/onlineStatus';
import { accountDisplayName } from '../../lib/accounts';

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Διαχειριστής',
  shop: 'Μαγαζί',
  driver: 'Διανομέας',
  developer: 'Developer',
};

type RoleFilter = 'all' | UserRole;

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Όλοι' },
  { key: 'shop', label: 'Μαγαζιά' },
  { key: 'driver', label: 'Οδηγοί' },
  { key: 'owner', label: 'Owners' },
  { key: 'developer', label: 'Devs' },
];

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [roleTarget, setRoleTarget] = useState<AccountEntry | null>(null);
  const [editTarget, setEditTarget] = useState<AccountEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
    const channel = supabase
      .channel('dev-accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchAccounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAccounts() {
    const { data } = await supabase
      .from('users')
      .select('id, email, role, active, approved, online_status, last_seen_at, shops(name, phone), drivers(name, phone)')
      .order('role');

    if (!data) { setLoading(false); return; }

    const result: AccountEntry[] = data.map((u: any) => ({
      id: u.id,
      role: u.role,
      name: accountDisplayName(u.role, u.shops?.name, u.drivers?.name, u.email),
      phone: u.shops?.phone ?? u.drivers?.phone ?? null,
      email: u.email,
      active: u.active,
      approved: u.approved,
      online_status: isReallyOnline(u.online_status, u.last_seen_at),
      last_seen_at: u.last_seen_at,
    }));
    setAccounts(result);
    setLoading(false);
  }

  async function toggleActive(entry: AccountEntry) {
    const verb = entry.active ? 'απενεργοποιήσεις' : 'ενεργοποιήσεις';
    Alert.alert(
      entry.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση',
      `Θέλεις σίγουρα να ${verb} τον/την "${entry.name}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: entry.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση',
          style: entry.active ? 'destructive' : 'default',
          onPress: async () => {
            await supabase.from('users').update({ active: !entry.active, online_status: false }).eq('id', entry.id);
          },
        },
      ]
    );
  }

  // Permanent — wipes the account's orders/history/customers too (see
  // delete_account in supabase-setup.sql). Only ever targets shop/driver
  // accounts, same restriction the owner's Directory screen already has.
  function deleteAccount(entry: AccountEntry) {
    Alert.alert(
      'Διαγραφή Λογαριασμού',
      `Θέλεις σίγουρα να διαγράψεις μόνιμα τον/την "${entry.name}"; Θα σβηστεί και όλο το ιστορικό παραγγελιών του/της. Δεν αναιρείται.`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_account', { p_user_id: entry.id });
            if (error) Alert.alert('Σφάλμα', error.message);
          },
        },
      ]
    );
  }

  async function changeRole(entry: AccountEntry, newRole: UserRole) {
    Alert.alert(
      'Αλλαγή Ρόλου',
      `Να γίνει ο/η "${entry.name}" ${ROLE_LABELS[newRole]}; Θα αποκτήσει αμέσως πρόσβαση με τον νέο ρόλο.`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Επιβεβαίωση',
          onPress: async () => {
            const { error } = await supabase.rpc('promote_user_role', { p_user_id: entry.id, p_new_role: newRole });
            if (error) Alert.alert('Σφάλμα', error.message);
            setRoleTarget(null);
          },
        },
      ]
    );
  }

  function openEdit(entry: AccountEntry) {
    setEditTarget(entry);
    setEditName(entry.name);
    setEditPhone(entry.phone ?? '');
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!editName.trim()) {
      Alert.alert('Σφάλμα', 'Το όνομα είναι υποχρεωτικό');
      return;
    }
    setSaving(true);
    const table = editTarget.role === 'shop' ? 'shops' : 'drivers';
    const { error } = await supabase
      .from(table)
      .update({ name: editName.trim(), phone: editPhone.trim() || null })
      .eq('id', editTarget.id);
    setSaving(false);
    if (error) { Alert.alert('Σφάλμα', error.message); return; }
    setEditTarget(null);
  }

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.role === filter);

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>Δεν υπάρχουν λογαριασμοί</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.active && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                {!item.active ? (
                  <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Ανενεργός</Text></View>
                ) : (
                  <Text style={styles.onlineDot}>{item.online_status ? '🟢' : '⚫'}</Text>
                )}
              </View>
              <Text style={styles.roleLabel}>{ROLE_LABELS[item.role] ?? item.role}</Text>
              {item.email ? <Text style={styles.detail}>✉️ {item.email}</Text> : null}
              {item.phone ? <Text style={styles.detail}>📞 {item.phone}</Text> : null}
              {!item.approved && <Text style={styles.pendingText}>⏳ Εκκρεμεί έγκριση</Text>}

              <View style={styles.actionsRow}>
                {(item.role === 'shop' || item.role === 'driver') && (
                  <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => openEdit(item)}>
                    <Text style={styles.actionBtnSecondaryText}>✏️ Επεξεργασία</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setRoleTarget(item)}>
                  <Text style={styles.actionBtnSecondaryText}>🔁 Αλλαγή Ρόλου</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, item.active ? styles.deactivateBtn : styles.activateBtn]}
                  onPress={() => toggleActive(item)}
                >
                  <Text style={[styles.actionBtnText, item.active ? styles.deactivateBtnText : styles.activateBtnText]}>
                    {item.active ? '🚫 Απενεργοποίηση' : '✓ Ενεργοποίηση'}
                  </Text>
                </TouchableOpacity>
                {(item.role === 'shop' || item.role === 'driver') && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteAccount(item)}>
                    <Text style={styles.deleteBtnText}>🗑️ Διαγραφή</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!roleTarget} transparent animationType="fade" onRequestClose={() => setRoleTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Αλλαγή ρόλου: {roleTarget?.name}</Text>
            {(['owner', 'developer', 'shop', 'driver'] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={styles.roleOption}
                onPress={() => roleTarget && changeRole(roleTarget, r)}
              >
                <Text style={styles.roleOptionText}>{ROLE_LABELS[r]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRoleTarget(null)}>
              <Text style={styles.modalCancelBtnText}>Ακύρωση</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Επεξεργασία: {editTarget?.name}</Text>

            <Text style={styles.editLabel}>Όνομα</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Όνομα"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.editLabel}>Τηλέφωνο</Text>
            <TextInput
              style={styles.editInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />

            <View style={styles.editBtnsRow}>
              <TouchableOpacity style={styles.modalCancelBtnInline} onPress={() => setEditTarget(null)}>
                <Text style={styles.modalCancelBtnText}>Ακύρωση</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={saveEdit}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Αποθήκευση...' : '💾 Αποθήκευση'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  filterScroll: { maxHeight: 52, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterScrollContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 6, alignItems: 'center' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  filterChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  filterChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: { backgroundColor: Colors.surface, margin: 8, marginTop: 8, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, flex: 1 },
  onlineDot: { fontSize: 14 },
  inactiveBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveBadgeText: { color: Colors.error, fontSize: 11, fontWeight: '700' },
  roleLabel: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  pendingText: { color: Colors.warning, marginTop: 6, fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtnSecondary: { flexGrow: 1, minWidth: '30%', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  actionBtnSecondaryText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  actionBtn: { flexGrow: 1, minWidth: '30%', padding: 10, borderRadius: 10, alignItems: 'center' },
  deactivateBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  activateBtn: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.4)' },
  actionBtnText: { fontWeight: 'bold', fontSize: 12 },
  deactivateBtnText: { color: Colors.error },
  activateBtnText: { color: Colors.success },
  deleteBtn: { flexGrow: 1, minWidth: '30%', padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: Colors.error },
  deleteBtnText: { color: Colors.error, fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '85%', borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 16 },
  roleOption: { padding: 14, borderRadius: 10, backgroundColor: Colors.surfaceAlt, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  roleOptionText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  modalCancelBtn: { padding: 12, alignItems: 'center', marginTop: 4 },
  modalCancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  editLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 10 },
  editInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
  },
  editBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtnInline: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
});
