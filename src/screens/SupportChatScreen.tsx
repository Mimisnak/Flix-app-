import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { SupportMessage } from '../types';
import { fetchOwnThread, sendUserMessage, markThreadRead } from '../lib/supportChat';
import { formatOrderDateTime } from '../lib/orderHelpers';

export default function SupportChatScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    markThreadRead(userId);

    const channel = supabase
      .channel(`support-thread-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` }, () => {
        load();
        markThreadRead(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function load() {
    if (!userId) return;
    const data = await fetchOwnThread(userId);
    setMessages(data);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }

  async function handleSend() {
    if (!userId || !text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    await sendUserMessage(userId, body);
    setSending(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎧 Υποστήριξη</Text>
          <Text style={styles.headerSub}>Στείλε μας το ερώτημα ή το πρόβλημά σου και θα λάβεις απάντηση σύντομα.</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Δεν υπάρχουν μηνύματα ακόμα. Στείλε μας το πρώτο σου μήνυμα!</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.sender_role === 'user' && styles.bubbleRowMine]}>
              <View style={[styles.bubble, item.sender_role === 'user' ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={item.sender_role === 'user' ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
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
            placeholder="Γράψε το μήνυμά σου..."
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
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: 14 },
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
