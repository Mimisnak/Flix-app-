import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../theme';
import { SupportMessage } from '../../types';
import { fetchOwnThread, sendUserMessage, markThreadRead } from '../../lib/supportChat';
import { formatOrderDateTime } from '../../lib/orderHelpers';

export default function SupportChatWeb() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      .channel(`web-support-thread-${userId}`)
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
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
  }

  async function handleSend() {
    if (!userId || !text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    await sendUserMessage(userId, body);
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h3 style={s.headerTitle}>🎧 Υποστήριξη</h3>
        <p style={s.headerSub}>Στείλε μας το ερώτημα ή το πρόβλημά σου και θα λάβεις απάντηση σύντομα.</p>
      </div>

      <div style={s.messages}>
        {messages.length === 0 ? (
          <p style={s.empty}>Δεν υπάρχουν μηνύματα ακόμα. Στείλε μας το πρώτο σου μήνυμα!</p>
        ) : (
          messages.map(m => (
            <div key={m.id} style={{ ...s.bubbleRow, justifyContent: m.sender_role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={m.sender_role === 'user' ? s.bubbleMine : s.bubbleTheirs}>
                <div style={{ fontSize: 14 }}>{m.message}</div>
                <div style={s.bubbleTime}>{formatOrderDateTime(m.created_at)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Γράψε το μήνυμά σου... (Enter για αποστολή)"
          rows={2}
        />
        <button
          style={{ ...s.sendBtn, opacity: !text.trim() || sending ? 0.4 : 1 }}
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column',
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 140px)', maxWidth: 720,
  },
  header: { padding: '16px 20px', borderBottom: `1px solid ${colors.border}` },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: 700, margin: 0 },
  headerSub: { color: colors.textSecondary, fontSize: 12, margin: '4px 0 0' },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
  bubbleRow: { display: 'flex' },
  bubbleMine: {
    maxWidth: '70%', background: colors.primary, color: '#fff',
    borderRadius: 14, borderBottomRightRadius: 4, padding: '10px 14px',
  },
  bubbleTheirs: {
    maxWidth: '70%', background: colors.bg, color: colors.textPrimary,
    border: `1px solid ${colors.border}`, borderRadius: 14, borderBottomLeftRadius: 4, padding: '10px 14px',
  },
  bubbleTime: { fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  inputRow: {
    display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12,
    borderTop: `1px solid ${colors.border}`,
  },
  input: {
    flex: 1, resize: 'none', borderRadius: 12, border: `1px solid ${colors.border}`,
    background: colors.bg, color: colors.textPrimary, padding: '10px 14px',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, border: 'none',
    background: colors.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
};
