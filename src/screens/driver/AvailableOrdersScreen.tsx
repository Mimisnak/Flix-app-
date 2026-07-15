import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { sendPushToUsers } from '../../lib/notifications';
import { addOrderTimeline } from '../../lib/orderHelpers';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';

export default function AvailableOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOnShift, setIsOnShift] = useState(false);
  const [canViewOrders, setCanViewOrders] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initDriver();
  }, []);

  useEffect(() => {
    if (!userId) return;

    fetchAvailable();

    const channel = supabase
      .channel('available-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAvailable)
      // Own row only — catches the owner flipping "Βλέπει παραγγελίες" or
      // shift status while this screen is already open. Without this, the
      // list stayed visible (stale local state) until the driver restarted
      // the app, even though the server itself was already blocking access.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload: any) => {
        setIsOnShift(payload.new.online_status);
        setCanViewOrders(payload.new.can_view_orders ?? true);
        // While can_view_orders was false, RLS blocked pending/assigned
        // orders from being fetched at all — flipping it back on doesn't
        // retroactively backfill the already-fetched (empty) local state,
        // so re-fetch here to pick up anything created in the meantime.
        fetchAvailable();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function initDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [userRow, driverRow] = await Promise.all([
      supabase.from('users').select('online_status, can_view_orders').eq('id', user.id).single(),
      supabase.from('drivers').select('name').eq('id', user.id).single(),
    ]);

    if (userRow.data) {
      setIsOnShift(userRow.data.online_status);
      setCanViewOrders(userRow.data.can_view_orders ?? true);
    }
    if (driverRow.data) setDriverName(driverRow.data.name);
  }

  async function fetchAvailable() {
    // Also pull 'assigned' orders — a driver on shift can see who already
    // has each order (read-only), not just the ones still up for grabs.
    const { data } = await supabase
      .from('orders')
      .select('*, shops(name), drivers(name)')
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: true });

    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function toggleShift() {
    if (!userId) return;
    const newStatus = !isOnShift;
    await supabase.from('users').update({ online_status: newStatus, last_seen_at: new Date().toISOString() }).eq('id', userId);
    setIsOnShift(newStatus);
    // Re-fetch on going on-shift: covers orders placed while off-shift that
    // the realtime channel may have missed (app backgrounded, reconnect gap).
    if (newStatus) fetchAvailable();
  }

  const takeOrder = useCallback(async (orderId: string) => {
    if (!userId || !isOnShift || !canViewOrders) return;
    const { data: order } = await supabase
      .from('orders')
      .update({ driver_id: userId, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('shop_id, street')
      .single();
    if (!order) return; // someone else took it first
    await addOrderTimeline(orderId, `🛵 Πήρε ο ${driverName || 'διανομέας'} — σε διαδρομή`);
    if (order?.shop_id) {
      sendPushToUsers([order.shop_id], '🛵 Παραλαμβάνεται!', `Ο ${driverName || 'διανομέας'} πήρε την παραγγελία.`);
    }
  }, [userId, driverName, isOnShift, canViewOrders]);

  const renderItem = useCallback(({ item }: { item: Order }) => {
    const takenByMe = item.status === 'assigned' && item.driver_id === userId;
    const takenByOther = item.status === 'assigned' && item.driver_id !== userId;
    return (
      <View style={[styles.card, takenByOther && styles.cardTaken]}>
        <Text style={styles.street}>{item.street}</Text>
        {item.customer_name ? <Text style={styles.detail}>{item.customer_name}</Text> : null}
        {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
        {item.bell ? <Text style={styles.detail}>Κουδούνι: {item.bell}</Text> : null}
        {item.floor ? <Text style={styles.detail}>Όροφος {item.floor}</Text> : null}
        {item.notes ? <Text style={styles.detail}>{item.notes}</Text> : null}
        {item.amount != null ? <Text style={styles.amount}>{item.amount.toFixed(2)}€</Text> : null}
        <Text style={styles.shop}>{(item as any).shops?.name}</Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {takenByOther ? (
          <View style={styles.takenBadge}>
            <Text style={styles.takenBadgeText}>
              Την έχει ο {(item as any).drivers?.name ?? 'άλλος οδηγός'}
            </Text>
          </View>
        ) : takenByMe ? (
          <View style={styles.takenBadgeMine}>
            <Text style={styles.takenBadgeMineText}>Την πήρες εσύ — δες την στις "Οι παραγγελίες μου"</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.takeBtn} onPress={() => takeOrder(item.id)}>
            <Text style={styles.takeBtnText}>✋ Παίρνω αυτή</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [takeOrder, userId]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>Διαθέσιμες Παραγγελίες</Text>
          <Text style={styles.headerSub}>{orders.length} περιμένουν</Text>
        </View>
        <TouchableOpacity
          style={[styles.shiftBtn, isOnShift ? styles.shiftOn : styles.shiftOff]}
          onPress={toggleShift}
        >
          <View style={[styles.shiftDot, { backgroundColor: isOnShift ? '#22C55E' : '#71717A' }]} />
          <Text style={styles.shiftText} numberOfLines={1}>{isOnShift ? 'Σε βάρδια' : 'Εκτός βάρδιας'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {!canViewOrders ? (
        <Text style={styles.center}>Δεν έχεις πρόσβαση στις παραγγελίες. Επικοινώνησε με τον διαχειριστή.</Text>
      ) : !isOnShift ? (
        <Text style={styles.center}>Είσαι εκτός βάρδιας. Βάλε "Σε βάρδια" για να δεις και να πάρεις παραγγελίες.</Text>
      ) : loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.center}>Δεν υπάρχουν διαθέσιμες παραγγελίες</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitleWrap: { flex: 1, flexShrink: 1, marginRight: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  // flexShrink: 0 so a longer title never compresses "Σε βάρδια" down to
  // where it wraps onto two lines ("Σε" / "βάρδια") on narrower phones.
  shiftBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  shiftOn: { backgroundColor: 'rgba(21, 87, 36, 0.85)', borderColor: 'rgba(255,255,255,0.3)' },
  shiftOff: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.15)' },
  shiftDot: { width: 8, height: 8, borderRadius: 4 },
  shiftText: { fontWeight: 'bold', fontSize: 12, color: '#fff' },
  center: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: {
    backgroundColor: Colors.surface, margin: 8, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  cardTaken: { opacity: 0.6 },
  takenBadge: {
    marginTop: 12, padding: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)', borderWidth: 1, borderColor: Colors.border,
  },
  takenBadgeText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  takenBadgeMine: {
    marginTop: 12, padding: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(58, 158, 251, 0.12)', borderWidth: 1, borderColor: Colors.primary,
  },
  takenBadgeMineText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  street: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  shop: { color: Colors.textMuted, marginTop: 6, fontSize: 12 },
  amount: { color: Colors.success, marginTop: 4, fontSize: 14, fontWeight: '700' },
  time: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  takeBtn: {
    backgroundColor: Colors.primary, padding: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  takeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
