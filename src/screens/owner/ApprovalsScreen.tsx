import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

interface PendingUser {
  id: string;
  role: 'shop' | 'driver';
  name: string;
}

export default function ApprovalsScreen() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel('approvals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Single JOIN query — no N+1 loop
  async function fetchPending() {
    const { data: users } = await supabase
      .from('users')
      .select('id, role, shops(name), drivers(name)')
      .eq('approved', false)
      .neq('role', 'owner');

    if (!users) { setLoading(false); return; }

    const result: PendingUser[] = users.map(u => ({
      id: u.id,
      role: u.role as 'shop' | 'driver',
      name: (u as any).shops?.name ?? (u as any).drivers?.name ?? 'Άγνωστος',
    }));

    setPending(result);
    setLoading(false);
  }

  async function approve(userId: string) {
    await supabase.from('users').update({ approved: true }).eq('id', userId);
    fetchPending();
  }

  async function reject(userId: string, name: string) {
    Alert.alert(
      'Απόρριψη',
      `Είσαι σίγουρος ότι θέλεις να απορρίψεις τον "${name}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Απόρριψη',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('users').delete().eq('id', userId);
            fetchPending();
          },
        },
      ]
    );
  }

  const renderItem = useCallback(({ item }: { item: PendingUser }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.role}>
          {item.role === 'shop' ? '🏬 Μαγαζί' : '🛵 Διανομέας'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)}>
          <Text style={styles.approveBtnText}>✓ Έγκριση</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(item.id, item.name)}>
          <Text style={styles.rejectBtnText}>✗ Απόρριψη</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [pending]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={styles.headerTitle}>Αιτήματα Εγγραφής</Text>
        {pending.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pending.length}</Text>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : pending.length === 0 ? (
        <Text style={styles.center}>Δεν υπάρχουν εκκρεμή αιτήματα ✅</Text>
      ) : (
        <FlatList
          data={pending}
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  badge: { backgroundColor: Colors.error, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  center: { textAlign: 'center', marginTop: 60, color: Colors.textSecondary, fontSize: 16 },
  card: {
    backgroundColor: Colors.surface, margin: 8, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  cardInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary },
  role: { color: Colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  approveBtnText: { color: '#fff', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: Colors.error, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  rejectBtnText: { color: '#fff', fontWeight: 'bold' },
});
