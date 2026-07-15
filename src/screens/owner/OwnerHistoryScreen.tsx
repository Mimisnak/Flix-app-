import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';
import { ordersToCsv } from '../../lib/csv';
import { exportTextFile } from '../../lib/exportFile';
import { fetchAllPaginated, formatDurationBetween } from '../../lib/orderHelpers';
import OrderDetailModal from './OrderDetailModal';

function deliveryInfo(item: Order): string | null {
  if (item.status !== 'delivered' || !item.delivered_at) return null;
  const deliveredTime = new Date(item.delivered_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  const duration = formatDurationBetween(item.assigned_at ?? item.created_at, item.delivered_at);
  return `Παραδόθηκε ${deliveredTime} · διάρκεια ${duration}`;
}

type StatusFilter = 'all' | 'pending' | 'assigned' | 'delivered' | 'cancelled';
type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all';

interface DriverOption { id: string; name: string; }

export default function OwnerHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('owner-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, dateFilter, driverFilter]);

  // Screens inside a bottom-tab navigator stay mounted, so a plain useEffect
  // only fires once — refetch every time this tab regains focus too.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [statusFilter, dateFilter, driverFilter])
  );

  async function fetchDrivers() {
    const { data } = await supabase.from('drivers').select('id, name').order('name');
    if (data) setDrivers(data as DriverOption[]);
  }

  function getDateStart(range: DateFilter): string | null {
    if (range === 'all') return null;
    const d = new Date();
    if (range === 'today') d.setHours(0, 0, 0, 0);
    else if (range === 'yesterday') { d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); }
    else if (range === 'week') { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); }
    else if (range === 'month') { d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0); }
    else { d.setFullYear(d.getFullYear() - 1); d.setHours(0, 0, 0, 0); }
    return d.toISOString();
  }

  function getDateEnd(range: DateFilter): string | null {
    if (range === 'yesterday') {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
    }
    return null;
  }

  async function fetchOrders() {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, shops(name), drivers(name)')
      .order('created_at', { ascending: false })
      .limit(300);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (driverFilter !== 'all') query = query.eq('driver_id', driverFilter);

    const dateStart = getDateStart(dateFilter);
    const dateEnd = getDateEnd(dateFilter);
    if (dateStart) query = query.gte('created_at', dateStart);
    if (dateEnd) query = query.lt('created_at', dateEnd);

    const { data } = await query;
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Όλες' },
    { key: 'pending', label: 'Αναμονή' },
    { key: 'assigned', label: 'Διαδρομή' },
    { key: 'delivered', label: 'Παραδόθηκαν' },
    { key: 'cancelled', label: 'Ακυρωμένες' },
  ];

  const dateFilters: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Σήμερα' },
    { key: 'yesterday', label: 'Χθες' },
    { key: 'week', label: 'Εβδομάδα' },
    { key: 'month', label: 'Μήνας' },
    { key: 'year', label: 'Χρόνος' },
    { key: 'all', label: 'Όλα' },
  ];

  async function handleExport() {
    if (exporting || orders.length === 0) return;
    setExporting(true);
    try {
      function buildQuery() {
        let q = supabase
          .from('orders')
          .select('*, shops(name), drivers(name)')
          .order('created_at', { ascending: false });
        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        if (driverFilter !== 'all') q = q.eq('driver_id', driverFilter);
        const dateStart = getDateStart(dateFilter);
        const dateEnd = getDateEnd(dateFilter);
        if (dateStart) q = q.gte('created_at', dateStart);
        if (dateEnd) q = q.lt('created_at', dateEnd);
        return q;
      }
      const allOrders = await fetchAllPaginated((from, to) => buildQuery().range(from, to));
      const csv = ordersToCsv(allOrders.map((o: any) => ({
        ...o,
        shop_name: o.shops?.name,
        driver_name: o.drivers?.name,
      })));
      const periodLabel = dateFilters.find(f => f.key === dateFilter)?.label ?? dateFilter;
      await exportTextFile(`flixfix-paraggelies-${periodLabel}.csv`, csv, 'text/csv');
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message ?? 'Η εξαγωγή απέτυχε.');
    } finally {
      setExporting(false);
    }
  }

  const delivered = orders.filter(o => o.status === 'delivered').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{orders.length}</Text>
          <Text style={styles.statLabel}>Σύνολο</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{delivered}</Text>
          <Text style={styles.statLabel}>Παρεδόθη</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{cancelled}</Text>
          <Text style={styles.statLabel}>Ακυρώθη</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, (exporting || orders.length === 0) && { opacity: 0.5 }]}
          onPress={handleExport}
          disabled={exporting || orders.length === 0}
        >
          <Text style={styles.exportBtnText}>{exporting ? '...' : '⬇️ CSV'}</Text>
        </TouchableOpacity>
      </View>

      {/* Date filter */}
      <View style={styles.filterRow}>
        {dateFilters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, dateFilter === f.key && styles.filterBtnActive]}
            onPress={() => setDateFilter(f.key)}
          >
            <Text style={[styles.filterText, dateFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filter */}
      <View style={styles.filterRow}>
        {statusFilters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterBtnActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Driver filter */}
      {drivers.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.driverScroll} contentContainerStyle={styles.driverScrollContent}>
          <TouchableOpacity
            style={[styles.driverChip, driverFilter === 'all' && styles.driverChipActive]}
            onPress={() => setDriverFilter('all')}
          >
            <Text style={[styles.driverChipText, driverFilter === 'all' && styles.driverChipTextActive]}>
              Όλοι
            </Text>
          </TouchableOpacity>
          {drivers.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.driverChip, driverFilter === d.id && styles.driverChipActive]}
              onPress={() => setDriverFilter(d.id)}
            >
              <Text style={[styles.driverChipText, driverFilter === d.id && styles.driverChipTextActive]}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Orders list */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          ListEmptyComponent={<Text style={styles.center}>Δεν υπάρχουν παραγγελίες</Text>}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setSelectedOrder(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.street}>{item.street}</Text>
                <Text style={styles.meta}>
                  {(item as any).shops?.name ?? '—'}  |  {(item as any).drivers?.name ?? '—'}
                </Text>
                {item.amount != null && (
                  <Text style={styles.amount}>{item.amount.toFixed(2)}€</Text>
                )}
                {item.cancel_reason && (
                  <Text style={styles.cancelReason}>{item.cancel_reason}</Text>
                )}
                {deliveryInfo(item) && (
                  <Text style={styles.deliveryInfo}>{deliveryInfo(item)}</Text>
                )}
                <Text style={styles.meta}>
                  {new Date(item.created_at).toLocaleString('el-GR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.statusIcon}>
                {item.status === 'delivered' ? 'Παραδόθηκε' : item.status === 'assigned' ? 'Διαδρομή' : item.status === 'cancelled' ? 'Ακυρώθηκε' : 'Αναμονή'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.primaryDark, padding: 16, gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  exportBtn: {
    alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, padding: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  driverScroll: { maxHeight: 44, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  driverScrollContent: { paddingHorizontal: 8, paddingVertical: 6, gap: 6, alignItems: 'center' },
  driverChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  driverChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  driverChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  driverChipTextActive: { color: '#fff', fontWeight: 'bold' },
  center: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
  row: {
    backgroundColor: Colors.surface, marginHorizontal: 8, marginVertical: 4,
    borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  street: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 14 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  amount: { color: Colors.success, fontSize: 12, fontWeight: '700', marginTop: 2 },
  cancelReason: { color: Colors.error, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  deliveryInfo: { color: Colors.success, fontSize: 11, marginTop: 2, fontWeight: '600' },
  statusIcon: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginLeft: 8 },
});
