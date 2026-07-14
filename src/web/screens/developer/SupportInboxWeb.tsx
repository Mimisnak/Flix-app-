import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { SupportMessage } from '../../../types';
import { sendDeveloperReply, markThreadRead } from '../../../lib/supportChat';
import { formatOrderDateTime } from '../../../lib/orderHelpers';
import { accountDisplayName } from '../../../lib/accounts';

const ROLE_LABELS: Record<string, string> = {
  owner: '👑 Διαχειριστής',
  shop: '🏬 Μαγαζί',
  driver: '🛵 Διανομέας',
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

export default function SupportInboxWeb() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: accounts }] = await Promise.all([
      supabase.from('support_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, email, role, shops(name), drivers(name)'),
    ]);
    if (!msgs) return;

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
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('web-dev-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function deleteThread(thread: Thread) {
    if (!window.confirm(`Θα διαγραφούν όλα τα μηνύματα με ${thread.name}. Αυτή η ενέργεια δεν αναιρείται.`)) return;
    await supabase.from('support_messages').delete().eq('user_id', thread.userId);
    if (selected?.userId === thread.userId) setSelected(null);
    load();
  }

  return (
    <div style={s.layout}>
      <div style={s.threadList}>
        {threads.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: 13, padding: 16 }}>Δεν υπάρχουν μηνύματα υποστήριξης</p>
        ) : (
          threads.map(t => (
            <div
              key={t.userId}
              onClick={() => setSelected(t)}
              style={{ ...s.threadRow, background: selected?.userId === t.userId ? colors.primaryHover : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={s.threadName}>{t.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.unread > 0 && <span style={s.unreadBadge}>{t.unread}</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(t); }}
                    style={s.deleteBtn}
                    title="Διαγραφή συνομιλίας"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div style={s.threadRole}>{ROLE_LABELS[t.role] ?? t.role}</div>
              <div style={s.threadPreview}>{t.lastMessage}</div>
              <div style={s.threadTime}>{formatOrderDateTime(t.lastAt)}</div>
            </div>
          ))
        )}
      </div>

      <div style={s.chatPane}>
        {selected ? (
          <ThreadChat key={selected.userId} thread={selected} onSent={load} onDelete={() => deleteThread(selected)} />
        ) : (
          <div style={s.emptyChat}>Διάλεξε μια συνομιλία από αριστερά</div>
        )}
      </div>
    </div>
  );
}

function ThreadChat({ thread, onSent, onDelete }: { thread: Thread; onSent: () => void; onDelete: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', thread.userId)
      .order('created_at', { ascending: true });
    setMessages((data as SupportMessage[]) ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
  }, [thread.userId]);

  useEffect(() => {
    load();
    markThreadRead(thread.userId);
    const channel = supabase
      .channel(`web-dev-thread-${thread.userId}`)
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
    onSent();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <div style={{ ...s.chatHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong style={{ color: colors.textPrimary }}>{thread.name}</strong>
          <span style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
            {ROLE_LABELS[thread.role] ?? thread.role}
          </span>
        </div>
        <button onClick={onDelete} style={s.deleteBtn} title="Διαγραφή συνομιλίας">🗑️</button>
      </div>
      <div style={s.messages}>
        {messages.map(m => (
          <div key={m.id} style={{ ...s.bubbleRow, justifyContent: m.sender_role === 'developer' ? 'flex-end' : 'flex-start' }}>
            <div style={m.sender_role === 'developer' ? s.bubbleMine : s.bubbleTheirs}>
              <div style={{ fontSize: 14 }}>{m.message}</div>
              <div style={s.bubbleTime}>{formatOrderDateTime(m.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Απάντησε... (Enter για αποστολή)"
          rows={2}
        />
        <button style={{ ...s.sendBtn, opacity: !text.trim() || sending ? 0.4 : 1 }} onClick={handleSend} disabled={!text.trim() || sending}>
          ➤
        </button>
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex', gap: 16, height: 'calc(100vh - 140px)',
  },
  threadList: {
    width: 320, minWidth: 280, background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 16, overflowY: 'auto',
  },
  threadRow: {
    padding: '14px 16px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer',
  },
  threadName: { color: colors.textPrimary, fontWeight: 700, fontSize: 14 },
  threadRole: { color: colors.primary, fontSize: 11, fontWeight: 600, marginTop: 2 },
  threadPreview: { color: colors.textSecondary, fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  threadTime: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  unreadBadge: {
    background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700,
    minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
  },
  deleteBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, padding: 2,
  },
  chatPane: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, overflow: 'hidden',
  },
  emptyChat: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 14 },
  chatHeader: { padding: '14px 20px', borderBottom: `1px solid ${colors.border}` },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
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
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12, borderTop: `1px solid ${colors.border}` },
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
