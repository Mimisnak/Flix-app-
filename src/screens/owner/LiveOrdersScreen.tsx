import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { addOrderTimeline } from '../../lib/orderHelpers';
import { isReallyOnline } from '../../lib/onlineStatus';
import { Driver, Order } from '../../types';
import { Colors } from '../../constants/colors';

type DriverOption = Driver & { online: boolean };

export default function LiveOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();

    const channel = supabase
      .channel('owner-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchDrivers();
      })
      .subscribe();

    // Fallback: the realtime socket can silently drop (phone sleep, network
    // switch) without reconnecting fast enough. Poll so the screen never
    // stays stale for more than a few seconds even if that happens.
    const poll = setInterval(() => {
      fetchOrders();
      fetchDrivers();
    }, 8000);

    // Also refetch the moment the app comes back to the foreground, so
    // reopening after the phone was asleep doesn't wait for the poll tick.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchOrders();
        fetchDrivers();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      appStateSub.remove();
    };
  }, []);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, shops(name), drivers(name)')
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: false });

    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  // Every active driver is selectable — an owner may want to hand an order
  // to someone who's off-shift (call them, cover a gap, etc). Online drivers
  // are just sorted first and marked with a dot so the common case (assign
  // to whoever's already on shift) is still fast.
  async function fetchDrivers() {
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id, online_status, last_seen_at')
      .eq('role', 'driver')
      .eq('active', true);

    if (!activeUsers?.length) { setDrivers([]); return; }

    const { data } = await supabase
      .from('drivers')
      .select('*')
      .in('id', activeUsers.map(u => u.id));

    if (!data) { setDrivers([]); return; }

    const onlineById = new Map(activeUsers.map(u => [u.id, isReallyOnline(u.online_status, u.last_seen_at)]));
    const options = (data as Driver[])
      .map(d => ({ ...d, online: onlineById.get(d.id) ?? false }))
      .sort((a, b) => (a.online === b.online ? a.name.localeCompare(b.name) : a.online ? -1 : 1));
    setDrivers(options);
  }

  const assignDriver = useCallback(async (orderId: string, driver: Driver) => {
    await supabase
      .from('orders')
      .update({ driver_id: driver.id, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', orderId);
    await addOrderTimeline(orderId, `🛵 Πήρε ο ${driver.name} — σε διαδρομή`);
  }, []);

  // Offline drivers are selectable (owner may have called them directly),
  // but get a confirmation first so it isn't an accidental tap — the driver
  // won't see the order pop up on their own screen unless/until they're online.
  const handleAssignPress = useCallback((orderId: string, driver: DriverOption) => {
    if (driver.online) { assignDriver(orderId, driver); return; }
    Alert.alert(
      'Ο οδηγός είναι εκτός σύνδεσης',
      `Ο ${driver.name} δεν είναι σε βάρδια αυτή τη στιγμή. Να του ανατεθεί η παραγγελία;`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Ανάθεση', onPress: () => assignDriver(orderId, driver) },
      ]
    );
  }, [assignDriver]);

  const renderOrder = useCallback(({ item }: { item: Order }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.street}>{item.street}</Text>
          <View style={[styles.badge, item.status === 'pending' ? styles.badgePending : styles.badgeAssigned]}>
            <Text style={styles.badgeText}>
              {item.status === 'pending' ? '🟡 Αναμονή' : '🛵 Διαδρομή'}
            </Text>
          </View>
        </View>

        {item.customer_name ? <Text style={styles.detail}>👤 {item.customer_name}</Text> : null}
        {item.phone ? <Text style={styles.detail}>📞 {item.phone}</Text> : null}
        <Text style={styles.detail}>🏬 {(item as any).shops?.name ?? '—'}</Text>
        {item.status === 'assigned' && (
          <Text style={styles.detail}>🛵 {(item as any).drivers?.name}</Text>
        )}
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
        </Text>

        {item.status === 'pending' && drivers.length > 0 && (
          <View style={styles.assignRow}>
            <Text style={styles.assignLabel}>Ανάθεση σε:</Text>
            <View style={styles.assignBtns}>
              {drivers.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.assignBtn}
                  onPress={() => handleAssignPress(item.id, d)}
                >
                  <Text style={styles.assignBtnText}>{d.online ? '🟢' : '⚫'} {d.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
  ), [drivers, handleAssignPress]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={styles.headerTitle}>Live Παραγγελίες</Text>
        <View style={styles.counts}>
          <Text style={styles.countBadge}>{orders.filter(o => o.status === 'pending').length} αναμονή</Text>
          <Text style={styles.countBadge}>{orders.filter(o => o.status === 'assigned').length} διαδρομή</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.center}>Δεν υπάρχουν ενεργές παραγγελίες 🎉</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          renderItem={renderOrder}
          contentContainerStyle={{ paddingBottom: 16 }}
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  counts: { flexDirection: 'row', gap: 8 },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12 },
  center: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: {
    backgroundColor: Colors.surface, margin: 8, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  street: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8, color: Colors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  badgeAssigned: { backgroundColor: 'rgba(58, 158, 251, 0.15)' },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  detail: { color: Colors.textSecondary, marginTop: 3, fontSize: 13 },
  time: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  assignRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  assignLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  assignBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assignBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  assignBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
