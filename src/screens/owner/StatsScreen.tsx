import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

type DateRange = 'today' | 'yesterday' | 'week';

interface DriverStat {
  id: string;
  name: string;
  delivered: number;
  assigned: number;
}

interface ShopStat {
  id: string;
  name: string;
  total: number;
}

export default function StatsScreen() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [driverStats, setDriverStats] = useState<DriverStat[]>([]);
  const [shopStats, setShopStats] = useState<ShopStat[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  function getDateStart(range: DateRange): string {
    const d = new Date();
    if (range === 'today') {
      d.setHours(0, 0, 0, 0);
    } else if (range === 'yesterday') {
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
    }
    return d.toISOString();
  }

  function getDateEnd(range: DateRange): string | null {
    if (range === 'yesterday') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    return null;
  }

  async function fetchStats() {
    setLoading(true);
    const start = getDateStart(dateRange);
    const end = getDateEnd(dateRange);

    let query = supabase
      .from('orders')
      .select('id, status, driver_id, shop_id, drivers(name), shops(name)')
      .gte('created_at', start);

    if (end) query = query.lt('created_at', end);

    const { data } = await query;

    if (!data) { setLoading(false); return; }

    setTotalOrders(data.length);
    setDeliveredCount(data.filter(o => o.status === 'delivered').length);

    // Driver leaderboard
    const driverMap: Record<string, DriverStat> = {};
    for (const o of data) {
      if (!o.driver_id) continue;
      const driverName = (o as any).drivers?.name ?? 'Άγνωστος';
      if (!driverMap[o.driver_id]) {
        driverMap[o.driver_id] = { id: o.driver_id, name: driverName, delivered: 0, assigned: 0 };
      }
      if (o.status === 'delivered') driverMap[o.driver_id].delivered += 1;
      if (o.status === 'assigned') driverMap[o.driver_id].assigned += 1;
    }
    const sortedDrivers = Object.values(driverMap).sort((a, b) => b.delivered - a.delivered);
    setDriverStats(sortedDrivers);

    // Shop breakdown
    const shopMap: Record<string, ShopStat> = {};
    for (const o of data) {
      const shopName = (o as any).shops?.name ?? 'Άγνωστο';
      if (!shopMap[o.shop_id]) {
        shopMap[o.shop_id] = { id: o.shop_id, name: shopName, total: 0 };
      }
      shopMap[o.shop_id].total += 1;
    }
    const sortedShops = Object.values(shopMap).sort((a, b) => b.total - a.total);
    setShopStats(sortedShops);

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [dateRange]);

  const dateFilters: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Σήμερα' },
    { key: 'yesterday', label: 'Χθες' },
    { key: 'week', label: '7 Μέρες' },
  ];

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      {/* Date filter */}
      <View style={styles.dateRow}>
        {dateFilters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.dateBtn, dateRange === f.key && styles.dateBtnActive]}
            onPress={() => setDateRange(f.key)}
          >
            <Text style={[styles.dateBtnText, dateRange === f.key && styles.dateBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary cards */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{totalOrders}</Text>
          <Text style={styles.summaryLabel}>Σύνολο</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{deliveredCount}</Text>
          <Text style={styles.summaryLabel}>Παραδόθηκαν</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{totalOrders - deliveredCount}</Text>
          <Text style={styles.summaryLabel}>Σε εξέλιξη</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Driver Leaderboard */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Leaderboard Drivers</Text>
            {driverStats.length === 0 ? (
              <Text style={styles.empty}>Δεν υπάρχουν δεδομένα</Text>
            ) : (
              driverStats.map((d, idx) => (
                <View key={d.id} style={[styles.leaderRow, idx === 0 && styles.leaderFirst]}>
                  <Text style={styles.medal}>{medals[idx] ?? `${idx + 1}.`}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverName, idx === 0 && styles.driverNameFirst]}>
                      {d.name}
                    </Text>
                  </View>
                  <View style={styles.statPills}>
                    <View style={styles.pillDelivered}>
                      <Text style={styles.pillText}>✅ {d.delivered}</Text>
                    </View>
                    {d.assigned > 0 && (
                      <View style={styles.pillAssigned}>
                        <Text style={styles.pillText}>🛵 {d.assigned}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Shop Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏬 Παραγγελίες ανά Μαγαζί</Text>
            {shopStats.length === 0 ? (
              <Text style={styles.empty}>Δεν υπάρχουν δεδομένα</Text>
            ) : (
              shopStats.map((s, idx) => (
                <View key={s.id} style={styles.shopRow}>
                  <Text style={styles.shopName}>{s.name}</Text>
                  <View style={styles.shopBar}>
                    <View
                      style={[
                        styles.shopBarFill,
                        { width: `${Math.round((s.total / (shopStats[0]?.total || 1)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.shopCount}>{s.total}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  dateRow: {
    flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dateBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  dateBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  dateBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  summaryCard: { flexDirection: 'row', padding: 20, margin: 12, borderRadius: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  summaryLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  section: {
    backgroundColor: Colors.surface, margin: 12, marginTop: 0, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 14 },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  leaderFirst: { backgroundColor: 'rgba(245, 158, 11, 0.12)', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 10 },
  medal: { fontSize: 22, width: 36 },
  driverName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  driverNameFirst: { color: Colors.warning },
  statPills: { flexDirection: 'row', gap: 6 },
  pillDelivered: { backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillAssigned: { backgroundColor: 'rgba(58, 158, 251, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  shopName: { width: 90, fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  shopBar: { flex: 1, height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  shopBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  shopCount: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: 'bold', color: Colors.textPrimary },
});
