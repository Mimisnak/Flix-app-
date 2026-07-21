import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import Text from '../components/AppText';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';

// Also on web (see src/web/screens/ProfileWeb.tsx) — kept in sync.
interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

export default function AppUpdatesScreen() {
  const [role, setRole] = useState('');
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single();
      if (userRow) setRole((userRow as any).role);
    }
    const { data } = await supabase
      .from('app_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  }

  async function postAnnouncement() {
    if (!newMessage.trim()) return;
    setPosting(true);
    const { error } = await supabase.from('app_announcements').insert({ message: newMessage.trim() });
    setPosting(false);
    if (error) {
      Alert.alert('Σφάλμα', error.message);
      return;
    }
    setNewMessage('');
    load();
  }

  function deleteAnnouncement(id: string) {
    Alert.alert('Διαγραφή', 'Θέλεις σίγουρα να διαγράψεις αυτή την ειδοποίηση;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('app_announcements').delete().eq('id', id);
          load();
        },
      },
    ]);
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} size="large" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {role === 'developer' && (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Τι νέο υπάρχει στην εφαρμογή;"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.postBtn, (posting || !newMessage.trim()) && styles.btnDisabled]}
            onPress={postAnnouncement}
            disabled={posting || !newMessage.trim()}
          >
            <Text style={styles.postBtnText}>{posting ? 'Δημοσίευση...' : 'Δημοσίευση'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.empty}>Δεν υπάρχουν ειδοποιήσεις ακόμα.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString('el-GR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
            {role === 'developer' && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteAnnouncement(item.id)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  composer: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 11,
    fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
    minHeight: 70, textAlignVertical: 'top',
  },
  postBtn: { backgroundColor: Colors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  message: { color: Colors.textPrimary, fontSize: 15, lineHeight: 21 },
  date: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
  deleteBtn: { position: 'absolute', top: 10, right: 10 },
  deleteBtnText: { fontSize: 16 },
});
