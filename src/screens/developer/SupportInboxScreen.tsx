import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { SupportMessage } from '../../types';
import { sendDeveloperReply, markThreadRead } from '../../lib/supportChat';
import { formatOrderDateTime } from '../../lib/orderHelpers';
import { accountDisplayName } from '../../lib/accounts';

const ROLE_LABELS: Record<string, string> = {
  owner: '👑 Διαχειριστής',
  shop: '🏬 Μαγαζί',
  driver: '🛵 Ντελιβεράς',
  developer: '👨‍💻 Developer',
};

interface Thread {
  userId: string;
  name: string;
  role: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export default function SupportInboxScreen() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: accounts }] = await Promise.all([
      supabase.from('support_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, email, role, shops(name), drivers(name)'),
    ]);
    if (!msgs) { setLoading(false); return; }

    const accountMap = new Map((accounts ?? []).map((a: any) => [a.id, a]));
    const threadMap = new Map<string, Thread>();
    for (const m of msgs as SupportMessage[]) {
      if (!threadMap.has(m.user_id)) {
        const acc: any = accountMap.get(m.user_id);
        threadMap.set(m.user_id, {
          userId: m.user_id,
          name: accountDisplayName(acc?.role, acc?.shops?.name, acc?.drivers?.name, acc?.email),
          role: acc?.role ?? '—',
          lastMessage: m.message,
          lastAt: m.created_at,
          unread: 0,
        });
      }
      if (m.sender_role === 'user' && !m.read) {
        threadMap.get(m.user_id)!.unread += 1;
      }
    }
    setThreads(Array.from(threadMap.values()).sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('dev-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (openThread) {
    return <ThreadDetail thread={openThread} onBack={() => { setOpenThread(null); load(); }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎧 Υποστήριξη</Text>
        <Text style={styles.headerSub}>{threads.filter(t => t.unread > 0).length} με νέα μηνύματα</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.userId}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>Δεν υπάρχουν μηνύματα υποστήριξης</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setOpenThread(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.roleLabel}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              <Text style={styles.time}>{formatOrderDateTime(item.lastAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function ThreadDetail({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', thread.userId)
      .order('created_at', { ascending: true });
    setMessages((data as SupportMessage[]) ?? []);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [thread.userId]);

  useEffect(() => {
    load();
    markThreadRead(thread.userId);
    const channel = supabase
      .channel(`dev-thread-${thread.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${thread.userId}` }, () => {
        load();
        markThreadRead(thread.userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [thread.userId, load]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    await sendDeveloperReply(thread.userId, body);
    setSending(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Πίσω</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{thread.name}</Text>
          <Text style={styles.headerSub}>{ROLE_LABELS[thread.role] ?? thread.role}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.sender_role === 'developer' && styles.bubbleRowMine]}>
              <View style={[styles.bubble, item.sender_role === 'developer' ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={item.sender_role === 'developer' ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                  {item.message}
                </Text>
                <Text style={styles.bubbleTime}>{formatOrderDateTime(item.created_at)}</Text>
              </View>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Απάντησε..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: 'bold' },
  headerSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    marginHorizontal: 8, marginTop: 8, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15 },
  unreadBadge: {
    backgroundColor: Colors.error, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  roleLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  preview: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  time: { color: Colors.textMuted, fontSize: 11, marginLeft: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 14, padding: 12 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: '#fff', fontSize: 14 },
  bubbleTextTheirs: { color: Colors.textPrimary, fontSize: 14 },
  bubbleTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
