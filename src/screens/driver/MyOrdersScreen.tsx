import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { sendPushToUsers } from '../../lib/notifications';
import { addOrderTimeline } from '../../lib/orderHelpers';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';

type IssueStep = 'choice' | 'other';

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [issueOrder, setIssueOrder] = useState<Order | null>(null);
  const [issueStep, setIssueStep] = useState<IssueStep>('choice');
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    fetchMyOrders();

    const channel = supabase
      .channel(`my-orders-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${userId}` },
        fetchMyOrders
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function initUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  }

  async function fetchMyOrders() {
    if (!userId) return;
    const { data } = await supabase
      .from('orders')
      .select('*, shops(name)')
      .eq('driver_id', userId)
      .eq('status', 'assigned')
      .order('created_at', { ascending: false });

    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  const completeOrder = useCallback(async (orderId: string) => {
    const { data: order } = await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('shop_id')
      .single();
    await addOrderTimeline(orderId, '✅ Παραδόθηκε');
    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (order?.shop_id) {
      sendPushToUsers([order.shop_id], '✅ Παραδόθηκε!', 'Η παραγγελία ολοκληρώθηκε επιτυχώς.');
    }
  }, []);

  function openIssueModal(order: Order) {
    setIssueOrder(order);
    setIssueStep('choice');
    setOtherReason('');
  }

  function closeIssueModal() {
    setIssueOrder(null);
    setIssueStep('choice');
    setOtherReason('');
  }

  // Cancels the order outright (customer unreachable, or a custom reason).
  const cancelOrder = useCallback(async (orderId: string, shopId: string, reason: string) => {
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: reason })
      .eq('id', orderId);
    await addOrderTimeline(orderId, `❌ Ακυρώθηκε από τον οδηγό — ${reason}`);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    sendPushToUsers([shopId], '❌ Ακυρώθηκε', reason);
    closeIssueModal();
  }, []);

  // Does NOT cancel — releases the order back to the pool for another driver.
  // Clearing driver_id also means this update no longer matches this screen's
  // `driver_id=eq.userId` realtime filter, so remove it from the local list
  // directly instead of waiting on a channel event that won't arrive.
  const unassignOrder = useCallback(async (orderId: string) => {
    await supabase
      .from('orders')
      .update({ driver_id: null, status: 'pending', assigned_at: null })
      .eq('id', orderId);
    await addOrderTimeline(orderId, '↩️ Αποδεσμεύτηκε από τον οδηγό — επέστρεψε στις διαθέσιμες');
    setOrders(prev => prev.filter(o => o.id !== orderId));
    closeIssueModal();
  }, []);

  const renderItem = useCallback(({ item }: { item: Order }) => (
    <View style={styles.card}>
      <Text style={styles.street}>{item.street}</Text>
      {item.customer_name ? <Text style={styles.detail}>👤 {item.customer_name}</Text> : null}
      {item.phone ? <Text style={styles.detail}>📞 {item.phone}</Text> : null}
      {item.bell ? <Text style={styles.detail}>🔔 Κουδούνι: {item.bell}</Text> : null}
      {item.floor ? <Text style={styles.detail}>🏢 Όροφος {item.floor}</Text> : null}
      {item.notes ? <Text style={styles.detail}>📝 {item.notes}</Text> : null}
      {item.amount != null ? <Text style={styles.amount}>💵 {item.amount.toFixed(2)}€</Text> : null}
      <Text style={styles.shop}>🏬 {(item as any).shops?.name}</Text>
      <TouchableOpacity style={styles.completeBtn} onPress={() => completeOrder(item.id)}>
        <Text style={styles.completeBtnText}>✅ Ολοκλήρωση Παράδοσης</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.issueBtn} onPress={() => openIssueModal(item)}>
        <Text style={styles.issueBtnText}>⚠️ Πρόβλημα / Ακύρωση</Text>
      </TouchableOpacity>
    </View>
  ), [completeOrder]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={styles.headerTitle}>Οι Παραγγελίες μου</Text>
        <Text style={styles.headerSub}>{orders.length} ενεργές</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.center}>Δεν έχεις ενεργές παραγγελίες</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={renderItem}
        />
      )}

      <Modal visible={!!issueOrder} transparent animationType="fade" onRequestClose={closeIssueModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {issueStep === 'choice' ? (
              <>
                <Text style={styles.modalTitle}>⚠️ Πρόβλημα με την παραγγελία</Text>
                <Text style={styles.modalSubtitle}>{issueOrder?.street}</Text>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => issueOrder && cancelOrder(issueOrder.id, issueOrder.shop_id, 'Αδυναμία επικοινωνίας πελάτη')}
                >
                  <Text style={styles.modalOptionText}>Αδυναμία επικοινωνίας πελάτη</Text>
                  <Text style={styles.modalOptionHint}>Ακυρώνει την παραγγελία</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => issueOrder && unassignOrder(issueOrder.id)}
                >
                  <Text style={styles.modalOptionText}>Έκανα λάθος / Ανάθεση σε άλλον</Text>
                  <Text style={styles.modalOptionHint}>Επιστρέφει στις διαθέσιμες, ΔΕΝ ακυρώνεται</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={() => setIssueStep('other')}>
                  <Text style={styles.modalOptionText}>Άλλο</Text>
                  <Text style={styles.modalOptionHint}>Γράψε την αιτία — ακυρώνει την παραγγελία</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeIssueModal}>
                  <Text style={styles.modalCancelBtnText}>Πίσω</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Αιτία ακύρωσης</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Γράψε τι έγινε..."
                  placeholderTextColor={Colors.textMuted}
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                  autoFocus
                />
                <View style={styles.modalBtnsRow}>
                  <TouchableOpacity style={styles.modalCancelBtnInline} onPress={() => setIssueStep('choice')}>
                    <Text style={styles.modalCancelBtnText}>Πίσω</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, !otherReason.trim() && styles.btnDisabled]}
                    disabled={!otherReason.trim()}
                    onPress={() => issueOrder && cancelOrder(issueOrder.id, issueOrder.shop_id, otherReason.trim())}
                  >
                    <Text style={styles.modalConfirmBtnText}>Ακύρωση Παραγγελίας</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  center: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: {
    backgroundColor: Colors.surface, margin: 8, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  street: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  amount: { color: Colors.success, marginTop: 4, fontSize: 14, fontWeight: '700' },
  shop: { color: Colors.textMuted, marginTop: 6, fontSize: 12 },
  completeBtn: {
    backgroundColor: Colors.success, padding: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
    shadowColor: Colors.success, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  completeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  issueBtn: {
    marginTop: 8, padding: 11, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  issueBtnText: { color: Colors.error, fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 22, width: '88%', borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  modalOption: {
    padding: 14, borderRadius: 12, backgroundColor: Colors.surfaceAlt,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  modalOptionText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  modalOptionHint: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  modalCancelBtn: { padding: 12, alignItems: 'center', marginTop: 4 },
  modalCancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.bg,
    minHeight: 90, textAlignVertical: 'top',
  },
  modalBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtnInline: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalConfirmBtn: { flex: 1, backgroundColor: Colors.error, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalConfirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
});
