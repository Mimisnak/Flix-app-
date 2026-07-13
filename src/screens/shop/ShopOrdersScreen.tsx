import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';

export default function ShopOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const navigation = useNavigation<any>();

  useEffect(() => {
    initShop();
  }, []);

  useEffect(() => {
    if (!shopId) return;

    fetchOrders();

    const channel = supabase
      .channel(`shop-orders-${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
        fetchOrders
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

  async function fetchOrders() {
    if (!shopId) return;
    const { data } = await supabase
      .from('orders')
      .select('*, drivers(name)')
      .eq('shop_id', shopId)
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: false });

    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function toggleShop() {
    if (!shopId) return;
    const newStatus = !isOpen;
    await supabase.from('users').update({ online_status: newStatus, last_seen_at: new Date().toISOString() }).eq('id', shopId);
    setIsOpen(newStatus);
  }

  function openCancelModal(orderId: string) {
    setCancelOrderId(orderId);
    setCancelReason('');
    setCancelModalVisible(true);
  }

  async function confirmCancel() {
    if (!cancelOrderId) return;
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: cancelReason })
      .eq('id', cancelOrderId);
    setCancelModalVisible(false);
    setCancelOrderId(null);
    setCancelReason('');
    fetchOrders();
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <TouchableOpacity
          style={[styles.statusBtn, isOpen ? styles.statusOpen : styles.statusClosed]}
          onPress={toggleShop}
        >
          <View style={[styles.statusDot, { backgroundColor: isOpen ? '#22C55E' : '#EF4444' }]} />
          <Text style={styles.statusText}>{isOpen ? 'Ανοιχτό' : 'Κλειστό'}</Text>
        </TouchableOpacity>
        <Text style={styles.orderCount}>{orders.length} ενεργές</Text>
      </LinearGradient>

      <TouchableOpacity
        style={[styles.newOrderBtn, !isOpen && styles.newOrderBtnDisabled]}
        onPress={() => {
          if (!isOpen) {
            Alert.alert('Το μαγαζί είναι κλειστό', 'Άνοιξε το μαγαζί για να δημιουργήσεις νέα παραγγελία.');
            return;
          }
          navigation.navigate('NewOrder');
        }}
      >
        <Text style={styles.newOrderText}>
          {isOpen ? '＋ Νέα Παραγγελία' : 'Το μαγαζί είναι κλειστό'}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#3A9EFB" style={{ marginTop: 60 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.center}>Δεν υπάρχουν ενεργές παραγγελίες</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.created_by_owner && (
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Ανατέθηκε από τον ιδιοκτήτη</Text>
                </View>
              )}
              <View style={styles.cardHeader}>
                <Text style={styles.street}>{item.street}</Text>
                <View style={[styles.badge, item.status === 'pending' ? styles.badgePending : styles.badgeAssigned]}>
                  <Text style={styles.badgeText}>
                    {item.status === 'pending' ? 'Αναμονή' : 'Σε διαδρομή'}
                  </Text>
                </View>
              </View>
              {item.customer_name ? <Text style={styles.detail}>Πελάτης: {item.customer_name}</Text> : null}
              {item.phone ? <Text style={styles.detail}>Τηλέφωνο: {item.phone}</Text> : null}
              {item.bell ? <Text style={styles.detail}>Κουδούνι: {item.bell}</Text> : null}
              {item.floor ? <Text style={styles.detail}>Όροφος: {item.floor}</Text> : null}
              {item.notes ? <Text style={styles.detail}>Σημειώσεις: {item.notes}</Text> : null}
              {item.amount != null ? (
                <Text style={styles.amount}>Ποσό: {item.amount.toFixed(2)}€</Text>
              ) : null}
              {item.status === 'assigned' && (
                <Text style={styles.driver}>Ντελιβεράς: {(item as any).drivers?.name}</Text>
              )}
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => openCancelModal(item.id)}
                >
                  <Text style={styles.cancelBtnText}>Ακύρωση</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Cancel Modal */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ακύρωση Παραγγελίας</Text>
            <Text style={styles.modalLabel}>Αιτία (προαιρετικά)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="π.χ. Ο πελάτης ακύρωσε..."
              value={cancelReason}
              onChangeText={setCancelReason}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Αναίρεση</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={confirmCancel}>
                <Text style={styles.modalBtnConfirmText}>Ακύρωση</Text>
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
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  statusOpen: { backgroundColor: 'rgba(255,255,255,0.15)' },
  statusClosed: { backgroundColor: 'rgba(0,0,0,0.25)' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: 'bold', fontSize: 13, color: '#fff' },
  orderCount: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  newOrderBtn: {
    margin: 12, backgroundColor: Colors.primary, padding: 15,
    borderRadius: 14, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  newOrderBtnDisabled: {
    backgroundColor: Colors.surfaceAlt, shadowOpacity: 0,
    borderWidth: 1, borderColor: Colors.border,
  },
  newOrderText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  center: { textAlign: 'center', marginTop: 50, color: Colors.textSecondary, fontSize: 15 },
  card: {
    backgroundColor: Colors.surface, margin: 8, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  ownerBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primaryHover, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  ownerBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  street: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8, color: Colors.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  badgeAssigned: { backgroundColor: 'rgba(58, 158, 251, 0.15)' },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  amount: { color: Colors.success, marginTop: 4, fontSize: 14, fontWeight: '700' },
  driver: { color: Colors.primary, marginTop: 6, fontWeight: '600', fontSize: 13 },
  time: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  cancelBtn: {
    marginTop: 10, padding: 9, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  cancelBtnText: { color: Colors.error, fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    width: '85%', elevation: 10, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 14 },
  modalLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.bg,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtnCancel: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalBtnCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalBtnConfirm: {
    flex: 1, backgroundColor: Colors.error, padding: 12,
    borderRadius: 10, alignItems: 'center',
  },
  modalBtnConfirmText: { color: '#fff', fontWeight: 'bold' },
});
