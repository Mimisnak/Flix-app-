import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import Text from '../../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';
import { formatDurationBetween } from '../../lib/orderHelpers';

function deliveryInfo(item: Order): string | null {
  if (item.status !== 'delivered' || !item.delivered_at) return null;
  const deliveredTime = new Date(item.delivered_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  const duration = formatDurationBetween(item.assigned_at ?? item.created_at, item.delivered_at);
  return `Παραδόθηκε ${deliveredTime} · διάρκεια ${duration}`;
}

export default function DriverHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    fetchHistory();

    const channel = supabase
      .channel(`driver-history-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${userId}` },
        fetchHistory
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Screens inside a bottom-tab navigator stay mounted, so a plain useEffect
  // only fires once — refetch every time this tab regains focus too.
  useFocusEffect(
    useCallback(() => {
      if (userId) fetchHistory();
    }, [userId])
  );

  async function initUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  }

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const since = new Date();
    since.setHours(since.getHours() - 24);

    const { data } = await supabase
      .from('orders')
      .select('*, shops(name)')
      .eq('driver_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data as Order[]);
      setTotal(data.filter(o => o.status === 'delivered').length);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ιστορικό 24 Ωρών</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{orders.length}</Text>
            <Text style={styles.statLabel}>Σύνολο</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{total}</Text>
            <Text style={styles.statLabel}>Παραδόθηκαν</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.center}>Δεν υπάρχουν παραδόσεις τις τελευταίες 24 ώρες</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shop}>{(item as any).shops?.name ?? '—'}</Text>
                <Text style={styles.street}>{item.street}</Text>
                {item.customer_name ? <Text style={styles.meta}>{item.customer_name}</Text> : null}
                {deliveryInfo(item) && (
                  <Text style={styles.deliveryInfo}>{deliveryInfo(item)}</Text>
                )}
                {item.status === 'cancelled' && item.cancel_reason && (
                  <Text style={styles.cancelReason}>{item.cancel_reason}</Text>
                )}
                <Text style={styles.meta}>
                  {new Date(item.created_at).toLocaleString('el-GR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.statusIcon}>
                {item.status === 'delivered' ? 'Παραδόθηκε' : item.status === 'cancelled' ? 'Ακυρώθηκε' : 'Διαδρομή'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.surface, padding: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 16 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  statLabel: { color: Colors.textSecondary, fontSize: 11 },
  center: { textAlign: 'center', marginTop: 50, color: Colors.textSecondary, paddingHorizontal: 24 },
  row: {
    backgroundColor: Colors.surface, marginHorizontal: 8, marginVertical: 4,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  shop: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  street: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  deliveryInfo: { color: Colors.success, fontSize: 11, marginTop: 2, fontWeight: '600' },
  cancelReason: { color: Colors.error, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  statusIcon: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginLeft: 8 },
});
