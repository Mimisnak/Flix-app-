import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
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

export default function ShopHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    initShop();
  }, []);

  useEffect(() => {
    if (!shopId) return;

    fetchHistory();

    const channel = supabase
      .channel(`shop-history-${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
        fetchHistory
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  // Screens inside a bottom-tab navigator stay mounted, so a plain useEffect
  // only fires once — refetch every time this tab regains focus too.
  useFocusEffect(
    useCallback(() => {
      if (shopId) fetchHistory();
    }, [shopId])
  );

  async function initShop() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setShopId(user.id);
  }

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const since = new Date();
    since.setHours(since.getHours() - 24);

    const { data } = await supabase
      .from('orders')
      .select('*, drivers(name)')
      .eq('shop_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ιστορικό 24 Ωρών</Text>
        <Text style={styles.headerSub}>{orders.length} παραγγελίες</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.center}>Δεν υπάρχουν παραγγελίες τις τελευταίες 24 ώρες</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                {item.created_by_owner && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>Ανατέθηκε από τον ιδιοκτήτη</Text>
                  </View>
                )}
                <Text style={styles.street}>{item.street}</Text>
                {item.customer_name ? <Text style={styles.meta}>Πελάτης: {item.customer_name}</Text> : null}
                {item.phone ? <Text style={styles.meta}>Τηλέφωνο: {item.phone}</Text> : null}
                {item.status === 'assigned' || item.status === 'delivered'
                  ? <Text style={styles.meta}>Ντελιβεράς: {(item as any).drivers?.name ?? '—'}</Text>
                  : null
                }
                {deliveryInfo(item) && (
                  <Text style={styles.deliveryInfo}>{deliveryInfo(item)}</Text>
                )}
                <Text style={styles.meta}>
                  {new Date(item.created_at).toLocaleString('el-GR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                item.status === 'delivered' ? styles.statusDelivered
                  : item.status === 'assigned' ? styles.statusAssignedB
                  : item.status === 'cancelled' ? styles.statusCancelledB
                  : styles.statusPendingB,
              ]}>
                <Text style={styles.statusBadgeText}>
                  {item.status === 'delivered' ? 'Παραδόθηκε'
                    : item.status === 'assigned' ? 'Σε διαδρομή'
                    : item.status === 'cancelled' ? 'Ακυρώθηκε'
                    : 'Αναμονή'}
                </Text>
              </View>
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
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  center: { textAlign: 'center', marginTop: 50, color: Colors.textSecondary, paddingHorizontal: 24 },
  row: {
    backgroundColor: Colors.surface, marginHorizontal: 8, marginVertical: 4,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  street: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 14 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  deliveryInfo: { color: Colors.success, fontSize: 11, marginTop: 2, fontWeight: '600' },
  ownerBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primaryHover, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  ownerBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginLeft: 8 },
  statusPendingB: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  statusAssignedB: { backgroundColor: 'rgba(58, 158, 251, 0.15)' },
  statusDelivered: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  statusCancelledB: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
});
