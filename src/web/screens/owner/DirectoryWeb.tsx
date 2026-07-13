import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { DirectoryEntry } from '../../../types';
import { isReallyOnline } from '../../../lib/onlineStatus';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

type Tab = 'shop' | 'driver';

const col = createColumnHelper<DirectoryEntry>();

export default function DirectoryWeb() {
  const [tab, setTab] = useState<Tab>('shop');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('web-directory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchEntries)
      .subscribe();

    // Fallback: the realtime socket can silently drop without reconnecting
    // fast enough. Poll so the list never stays stale for more than a few
    // seconds even if that happens.
    const poll = setInterval(fetchEntries, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  async function fetchEntries() {
    const { data } = await supabase
      .from('users')
      .select('id, email, active, online_status, last_seen_at, can_view_orders, shops(name, phone), drivers(name, phone)')
      .in('role', ['shop', 'driver'])
      .order('active', { ascending: false });

    if (!data) { setLoading(false); return; }

    const result: DirectoryEntry[] = data.map((u: any) => {
      const role: 'shop' | 'driver' = u.shops ? 'shop' : 'driver';
      const profile = u.shops ?? u.drivers;
      return {
        id: u.id,
        role,
        name: profile?.name ?? 'Άγνωστος',
        phone: profile?.phone ?? null,
        email: u.email,
        active: u.active,
        online_status: isReallyOnline(u.online_status, u.last_seen_at),
        last_seen_at: u.last_seen_at,
        can_view_orders: u.can_view_orders,
      };
    });

    setEntries(result);
    setLoading(false);
  }

  async function toggleActive(entry: DirectoryEntry) {
    const verb = entry.active ? 'απενεργοποιήσεις' : 'ενεργοποιήσεις';
    if (!window.confirm(`Θέλεις σίγουρα να ${verb} τον/την "${entry.name}";`)) return;
    setActionLoading(entry.id);
    await supabase
      .from('users')
      .update({ active: !entry.active, online_status: false })
      .eq('id', entry.id);
    setActionLoading(null);
  }

  async function toggleCanViewOrders(entry: DirectoryEntry) {
    await supabase
      .from('users')
      .update({ can_view_orders: !entry.can_view_orders })
      .eq('id', entry.id);
  }

  async function createShop() {
    if (!newShopName.trim()) { window.alert('Το όνομα του μαγαζιού είναι υποχρεωτικό.'); return; }
    setCreating(true);
    const { error } = await supabase.rpc('create_shop_without_account', {
      p_name: newShopName.trim(),
      p_phone: newShopPhone.trim() || null,
    });
    setCreating(false);
    if (error) { window.alert(error.message); return; }
    setNewShopName('');
    setNewShopPhone('');
    setCreateModalOpen(false);
    fetchEntries();
  }

  const filtered = useMemo(() => entries.filter(e => e.role === tab), [entries, tab]);

  const columns = useMemo(() => {
    const base = [
      col.accessor('name', {
        header: 'Όνομα',
        cell: info => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>{info.row.original.online_status ? '🟢' : '⚫'}</span>
            <strong style={{ color: info.row.original.active ? colors.textPrimary : colors.textSecondary }}>
              {info.getValue()}
            </strong>
            {!info.row.original.active && (
              <span style={s.inactiveBadge}>Ανενεργός</span>
            )}
          </div>
        ),
      }),
      col.accessor('phone', {
        header: 'Τηλέφωνο',
        cell: info => <span style={{ color: colors.textSecondary }}>{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('email', {
        header: 'Email',
        cell: info => info.getValue()
          ? <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>
          : <span style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 12 }}>Χωρίς λογαριασμό</span>,
      }),
    ];

    if (tab === 'driver') {
      base.push(
        col.accessor('can_view_orders', {
          header: 'Βλέπει παραγγελίες',
          cell: info => {
            const entry = info.row.original;
            if (!entry.active) return <span style={{ color: colors.textSecondary }}>—</span>;
            return (
              <label style={s.switchWrap}>
                <input
                  type="checkbox"
                  checked={info.getValue()}
                  onChange={() => toggleCanViewOrders(entry)}
                  style={{ display: 'none' }}
                />
                <span style={{
                  ...s.switchTrack,
                  background: info.getValue() ? colors.primary : colors.border,
                }}>
                  <span style={{
                    ...s.switchThumb,
                    transform: info.getValue() ? 'translateX(16px)' : 'translateX(0)',
                  }} />
                </span>
              </label>
            );
          },
        }) as any
      );
    }

    base.push(
      col.display({
        id: 'actions',
        header: 'Ενέργειες',
        cell: ({ row }) => {
          const entry = row.original;
          const isLoading = actionLoading === entry.id;
          return (
            <button
              onClick={() => toggleActive(entry)}
              disabled={isLoading}
              style={{
                ...s.actionBtn,
                background: entry.active ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: entry.active ? colors.error : colors.success,
                border: `1px solid ${entry.active ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '...' : entry.active ? '🚫 Απενεργοποίηση' : '✓ Ενεργοποίηση'}
            </button>
          );
        },
      }) as any
    );

    return base;
  }, [tab, actionLoading]);

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={s.tabRow}>
          <button
            onClick={() => setTab('shop')}
            style={{ ...s.tabBtn, background: tab === 'shop' ? colors.primary : 'transparent', color: tab === 'shop' ? '#fff' : colors.textSecondary }}
          >
            🏬 Μαγαζιά
          </button>
          <button
            onClick={() => setTab('driver')}
            style={{ ...s.tabBtn, background: tab === 'driver' ? colors.primary : 'transparent', color: tab === 'driver' ? '#fff' : colors.textSecondary }}
          >
            🛵 Οδηγοί
          </button>
        </div>

        {tab === 'shop' && (
          <button onClick={() => setCreateModalOpen(true)} style={s.createBtn}>
            🏬 Δημιουργία Μαγαζιού
          </button>
        )}
      </div>

      {createModalOpen && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ color: colors.textPrimary, margin: '0 0 6px' }}>🏬 Δημιουργία Μαγαζιού</h3>
            <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 18px' }}>
              Για μαγαζιά που δεν θα χρησιμοποιήσουν ποτέ την εφαρμογή — χωρίς email/κωδικό.
            </p>
            <label style={{ fontSize: 13, color: colors.textSecondary, display: 'block', marginBottom: 6 }}>
              Όνομα Μαγαζιού *
            </label>
            <input
              style={s.modalInput}
              placeholder="π.χ. Σουβλάκια ο Μίμης"
              value={newShopName}
              onChange={e => setNewShopName(e.target.value)}
              autoFocus
            />
            <label style={{ fontSize: 13, color: colors.textSecondary, display: 'block', margin: '14px 0 6px' }}>
              Τηλέφωνο (προαιρετικό)
            </label>
            <input
              style={s.modalInput}
              placeholder="π.χ. 2541012345"
              value={newShopPhone}
              onChange={e => setNewShopPhone(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setCreateModalOpen(false); setNewShopName(''); setNewShopPhone(''); }}
                style={s.btnSecondary}
              >
                Ακύρωση
              </button>
              <button onClick={createShop} disabled={creating} style={{ ...s.btnPrimary, opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Δημιουργία...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : filtered.length === 0 ? (
            <div style={cardStyles.empty}>Δεν υπάρχουν εγγραφές</div>
          ) : (
            filtered.map(entry => {
              const isLoading = actionLoading === entry.id;
              return (
                <div key={entry.id} style={cardStyles.card}>
                  <div style={cardStyles.row}>
                    <span style={{ ...cardStyles.title, color: entry.active ? colors.textPrimary : colors.textSecondary }}>
                      {entry.online_status ? '🟢' : '⚫'} {entry.name}
                    </span>
                    {!entry.active && <span style={s.inactiveBadge}>Ανενεργός</span>}
                  </div>
                  <div style={cardStyles.detail}>{entry.phone ?? '—'}</div>
                  <div style={cardStyles.detail}>
                    {entry.email ?? <span style={{ fontStyle: 'italic', color: colors.textMuted }}>Χωρίς λογαριασμό</span>}
                  </div>
                  {tab === 'driver' && entry.active && (
                    <label style={{ ...s.switchWrap, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={entry.can_view_orders}
                        onChange={() => toggleCanViewOrders(entry)}
                        style={{ display: 'none' }}
                      />
                      <span style={{ ...s.switchTrack, background: entry.can_view_orders ? colors.primary : colors.border }}>
                        <span style={{ ...s.switchThumb, transform: entry.can_view_orders ? 'translateX(16px)' : 'translateX(0)' }} />
                      </span>
                      <span style={{ fontSize: 12, color: colors.textSecondary }}>Βλέπει παραγγελίες</span>
                    </label>
                  )}
                  <button
                    onClick={() => toggleActive(entry)}
                    disabled={isLoading}
                    style={{
                      ...s.actionBtn, marginTop: 10, width: '100%',
                      background: entry.active ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                      color: entry.active ? colors.error : colors.success,
                      border: `1px solid ${entry.active ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? '...' : entry.active ? '🚫 Απενεργοποίηση' : '✓ Ενεργοποίηση'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} style={s.th}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: 40, color: colors.textSecondary }}>
                  Φόρτωση...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: 52, color: colors.textSecondary }}>
                  Δεν υπάρχουν εγγραφές
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} style={{ ...s.tr, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={s.td}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tabRow: {
    display: 'flex', gap: 6, background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 12, padding: 4, width: 'fit-content',
  },
  tabBtn: {
    padding: '8px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  tableWrap: {
    background: colors.surface, borderRadius: 12,
    border: `1px solid ${colors.border}`, overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '12px 16px',
    color: colors.textSecondary, fontWeight: 500, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap',
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  inactiveBadge: {
    background: 'rgba(239,68,68,0.15)', color: colors.error,
    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
  },
  switchWrap: { cursor: 'pointer', display: 'inline-block' },
  switchTrack: {
    display: 'inline-block', width: 36, height: 20, borderRadius: 10,
    position: 'relative', transition: 'background 0.15s',
  },
  switchThumb: {
    position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 8,
    background: '#fff', transition: 'transform 0.15s',
  },
  actionBtn: {
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  createBtn: {
    background: colors.primaryHover, color: colors.primary,
    border: `1px solid ${colors.primary}`, borderRadius: 10,
    padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 20, padding: 28, width: 420,
    maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box',
    background: colors.bg, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '11px 14px',
    fontSize: 14, color: colors.textPrimary, outline: 'none',
  },
  btnSecondary: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: 'transparent', border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
  },
  btnPrimary: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: colors.primary, border: 'none', color: '#fff',
  },
};
