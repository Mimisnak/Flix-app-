import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

interface PendingUser {
  id: string;
  role: 'shop' | 'driver';
  name: string;
  email: string;
}

const columnHelper = createColumnHelper<PendingUser>();

export default function ApprovalsWeb() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel('web-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchPending() {
    const { data } = await supabase
      .from('users')
      .select('id, role, email, shops(name), drivers(name)')
      .eq('approved', false)
      .neq('role', 'owner');

    if (!data) { setLoading(false); return; }

    setPending(data.map((u: any) => ({
      id: u.id,
      role: u.role as 'shop' | 'driver',
      name: u.shops?.name ?? u.drivers?.name ?? 'Άγνωστος',
      email: u.email ?? '—',
    })));
    setLoading(false);
  }

  async function approve(userId: string) {
    setActionLoading(userId);
    await supabase.from('users').update({ approved: true }).eq('id', userId);
    setActionLoading(null);
    // realtime will trigger fetchPending automatically
  }

  async function reject(user: PendingUser) {
    const confirmed = window.confirm(`Είσαι σίγουρος ότι θέλεις να απορρίψεις τον "${user.name}"; Αυτή η ενέργεια δεν αναιρείται.`);
    if (!confirmed) return;
    setActionLoading(user.id);
    await supabase.from('users').delete().eq('id', user.id);
    setActionLoading(null);
  }

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Όνομα',
      cell: info => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={s.avatar}>
            {info.getValue().charAt(0).toUpperCase()}
          </div>
          <div>
            <strong style={{ color: colors.textPrimary, display: 'block' }}>{info.getValue()}</strong>
            <span style={{ color: colors.textSecondary, fontSize: 12 }}>{info.row.original.email}</span>
          </div>
        </div>
      ),
    }),

    columnHelper.accessor('role', {
      header: 'Ρόλος',
      cell: info => (
        <span style={{
          ...s.roleBadge,
          background: info.getValue() === 'shop' ? 'rgba(58,158,251,0.15)' : 'rgba(167,139,250,0.15)',
          color: info.getValue() === 'shop' ? colors.primary : '#A78BFA',
        }}>
          {info.getValue() === 'shop' ? '🏬 Μαγαζί' : '🛵 Ντελιβεράς'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ενέργειες',
      cell: ({ row }) => {
        const user = row.original;
        const isLoading = actionLoading === user.id;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => approve(user.id)}
              disabled={isLoading}
              style={{
                ...s.btn,
                background: 'rgba(34,197,94,0.15)',
                color: '#22C55E',
                border: '1px solid rgba(34,197,94,0.4)',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '...' : '✓ Έγκριση'}
            </button>
            <button
              onClick={() => reject(user)}
              disabled={isLoading}
              style={{
                ...s.btn,
                background: 'rgba(239,68,68,0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239,68,68,0.4)',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '...' : '✕ Απόρριψη'}
            </button>
          </div>
        );
      },
    }),
  ], [actionLoading]);

  const table = useReactTable({ data: pending, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {pending.length > 0 ? (
          <span style={s.pendingBadge}>
            {pending.length} σε αναμονή έγκρισης
          </span>
        ) : (
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>
            ✓ Δεν υπάρχουν εκκρεμείς αιτήσεις
          </span>
        )}
      </div>

      {isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : pending.length === 0 ? (
            <div style={cardStyles.empty}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              Όλοι οι χρήστες έχουν εγκριθεί
            </div>
          ) : (
            pending.map(user => {
              const isLoading = actionLoading === user.id;
              return (
                <div key={user.id} style={cardStyles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={s.avatar}>{user.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <strong style={{ color: colors.textPrimary, display: 'block' }}>{user.name}</strong>
                      <span style={{ color: colors.textSecondary, fontSize: 12 }}>{user.email}</span>
                    </div>
                  </div>
                  <span style={{
                    ...s.roleBadge,
                    background: user.role === 'shop' ? 'rgba(58,158,251,0.15)' : 'rgba(167,139,250,0.15)',
                    color: user.role === 'shop' ? colors.primary : '#A78BFA',
                  }}>
                    {user.role === 'shop' ? '🏬 Μαγαζί' : '🛵 Ντελιβεράς'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => approve(user.id)}
                      disabled={isLoading}
                      style={{ ...s.btn, flex: 1, background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.4)', opacity: isLoading ? 0.5 : 1 }}
                    >
                      {isLoading ? '...' : '✓ Έγκριση'}
                    </button>
                    <button
                      onClick={() => reject(user)}
                      disabled={isLoading}
                      style={{ ...s.btn, flex: 1, background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)', opacity: isLoading ? 0.5 : 1 }}
                    >
                      {isLoading ? '...' : '✕ Απόρριψη'}
                    </button>
                  </div>
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
                <td colSpan={3} style={{ ...s.td, textAlign: 'center', color: colors.textSecondary, padding: 40 }}>
                  Φόρτωση...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ ...s.td, textAlign: 'center', padding: 48 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
                    Όλοι οι χρήστες έχουν εγκριθεί
                  </p>
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
  pendingBadge: {
    background: 'rgba(245,158,11,0.15)',
    color: '#F59E0B',
    padding: '5px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    background: colors.primaryHover,
    color: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },
  roleBadge: {
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
  },
  btn: {
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  },
  tableWrap: {
    background: colors.surface,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '12px 20px',
    color: colors.textSecondary,
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.border}`,
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '14px 20px', verticalAlign: 'middle' },
};
