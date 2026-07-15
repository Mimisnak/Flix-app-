import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { addOrderTimeline } from '../../../lib/orderHelpers';
import { sendPushToUsers } from '../../../lib/notifications';
import { notifyWeb } from '../../../lib/webNotify';
import { colors } from '../../theme';
import { Order } from '../../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

const col = createColumnHelper<Order>();

export default function AvailableOrdersWeb() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOnShift, setIsOnShift] = useState(false);
  const [canViewOrders, setCanViewOrders] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [loading, setLoading] = useState(true);
  const [takingId, setTakingId] = useState<string | null>(null);
  // Realtime callbacks close over stale state; refs let the new-order
  // listener always read the current shift/visibility flags.
  const isOnShiftRef = useRef(isOnShift);
  const canViewOrdersRef = useRef(canViewOrders);
  useEffect(() => { isOnShiftRef.current = isOnShift; }, [isOnShift]);
  useEffect(() => { canViewOrdersRef.current = canViewOrders; }, [canViewOrders]);

  useEffect(() => { initDriver(); }, []);

  useEffect(() => {
    if (!userId) return;
    fetchAvailable();
    const channel = supabase
      .channel('web-available-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAvailable)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.new?.status === 'pending' && isOnShiftRef.current && canViewOrdersRef.current) {
          notifyWeb('Νέα παραγγελία', payload.new.street ?? 'Νέα παραγγελία διαθέσιμη');
        }
      })
      // Own row only — catches the owner flipping "Βλέπει παραγγελίες" or
      // shift status while this tab is already open. Without this, the
      // list stayed visible (stale local state) until the tab reloaded,
      // even though the server itself was already blocking access.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload: any) => {
        setIsOnShift(payload.new.online_status);
        setCanViewOrders(payload.new.can_view_orders ?? true);
        // While can_view_orders was false, RLS blocked pending/assigned
        // orders from being fetched at all — flipping it back on doesn't
        // retroactively backfill the already-fetched (empty) local state,
        // so re-fetch here to pick up anything created in the meantime.
        fetchAvailable();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function initDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [userRow, driverRow] = await Promise.all([
      supabase.from('users').select('online_status, can_view_orders').eq('id', user.id).single(),
      supabase.from('drivers').select('name').eq('id', user.id).single(),
    ]);
    if (userRow.data) {
      setIsOnShift(userRow.data.online_status);
      setCanViewOrders(userRow.data.can_view_orders ?? true);
    }
    if (driverRow.data) setDriverName(driverRow.data.name);
  }

  async function fetchAvailable() {
    // Also pull 'assigned' orders — a driver on shift can see who already
    // has each order (read-only), not just the ones still up for grabs.
    const { data } = await supabase.from('orders')
      .select('*, shops(name), drivers(name)')
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: true });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function toggleShift() {
    if (!userId) return;
    const newStatus = !isOnShift;
    await supabase.from('users').update({ online_status: newStatus, last_seen_at: new Date().toISOString() }).eq('id', userId);
    setIsOnShift(newStatus);
    // Re-fetch on going on-shift: covers orders placed while off-shift that
    // the realtime channel may have missed (tab backgrounded, reconnect gap).
    if (newStatus) fetchAvailable();
  }

  const takeOrder = useCallback(async (orderId: string, shopId: string) => {
    if (!userId || !isOnShift || !canViewOrders) return;
    setTakingId(orderId);
    const { data: order } = await supabase.from('orders')
      .update({ driver_id: userId, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('shop_id')
      .single();
    if (order) {
      await addOrderTimeline(orderId, `🛵 Πήρε ο ${driverName || 'διανομέας'} — σε διαδρομή`);
      sendPushToUsers([shopId], '🛵 Παραλαμβάνεται!', `Ο ${driverName || 'διανομέας'} πήρε την παραγγελία.`);
    }
    setTakingId(null);
  }, [userId, driverName, isOnShift, canViewOrders]);

  const columns = useMemo(() => [
    col.accessor('created_at', {
      header: 'Ώρα',
      cell: info => (
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>
          {new Date(info.getValue()).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    }),
    col.accessor('street', {
      header: 'Διεύθυνση',
      cell: info => <strong style={{ color: colors.textPrimary }}>{info.getValue()}</strong>,
    }),
    col.accessor('customer_name', {
      header: 'Πελάτης',
      cell: info => <span style={{ color: colors.textSecondary }}>{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('phone', {
      header: 'Τηλέφωνο',
      cell: info => <span style={{ color: colors.textSecondary }}>{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('amount', {
      header: 'Ποσό',
      cell: info => info.getValue() != null
        ? <span style={{ color: '#22C55E', fontWeight: 700 }}>{(info.getValue() as number).toFixed(2)}€</span>
        : <span style={{ color: colors.textMuted }}>—</span>,
    }),
    col.display({
      id: 'shop',
      header: 'Μαγαζί',
      cell: ({ row }) => (
        <span style={{ color: colors.textSecondary }}>
          {(row.original as any).shops?.name ?? '—'}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: 'Ενέργεια',
      cell: ({ row }) => {
        const item = row.original;
        const busy = takingId === item.id;
        if (item.status === 'assigned') {
          const takenByMe = item.driver_id === userId;
          return (
            <span style={{ color: takenByMe ? colors.primary : colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
              {takenByMe ? 'Δική σου' : `Την έχει ο ${(row.original as any).drivers?.name ?? 'άλλος οδηγός'}`}
            </span>
          );
        }
        return (
          <button
            onClick={() => takeOrder(item.id, item.shop_id)}
            disabled={busy}
            style={{ ...s.takeBtn, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? '...' : '✋ Παίρνω αυτή'}
          </button>
        );
      },
    }),
  ], [takeOrder, takingId, userId]);

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Shift toggle bar */}
      <div style={s.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={toggleShift}
            style={{
              ...s.statusBtn,
              background: isOnShift ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isOnShift ? '#22C55E' : '#EF4444',
              border: `1px solid ${isOnShift ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }}
          >
            {isOnShift ? '🟢 Σε βάρδια' : '⚫ Εκτός βάρδιας'}
          </button>
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>
            {orders.length} διαθέσιμες παραγγελίες
          </span>
        </div>
      </div>

      {/* Table */}
      {!canViewOrders ? (
        <div style={s.tableWrap}>
          <div style={{ textAlign: 'center', padding: 52 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🚫</div>
            <p style={{ color: colors.textSecondary, margin: 0 }}>
              Δεν έχεις πρόσβαση στις παραγγελίες. Επικοινώνησε με τον διαχειριστή.
            </p>
          </div>
        </div>
      ) : !isOnShift ? (
        <div style={s.tableWrap}>
          <div style={{ textAlign: 'center', padding: 52 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚫</div>
            <p style={{ color: colors.textSecondary, margin: 0 }}>
              Είσαι εκτός βάρδιας. Βάλε "Σε βάρδια" για να δεις και να πάρεις παραγγελίες.
            </p>
          </div>
        </div>
      ) : isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : orders.length === 0 ? (
            <div style={cardStyles.empty}>
              Δεν υπάρχουν διαθέσιμες παραγγελίες
            </div>
          ) : (
            orders.map(item => {
              const takenByMe = item.status === 'assigned' && item.driver_id === userId;
              const takenByOther = item.status === 'assigned' && item.driver_id !== userId;
              const busy = takingId === item.id;
              return (
                <div key={item.id} style={cardStyles.card}>
                  <div style={cardStyles.row}>
                    <span style={cardStyles.title}>{item.street}</span>
                    <span style={{ color: colors.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {item.customer_name && <div style={cardStyles.detail}>{item.customer_name}</div>}
                  {item.phone && <div style={cardStyles.detail}>{item.phone}</div>}
                  {item.amount != null && <div style={cardStyles.amount}>{item.amount.toFixed(2)}€</div>}
                  <div style={cardStyles.meta}>{(item as any).shops?.name ?? '—'}</div>
                  {takenByOther ? (
                    <div style={{ ...cardStyles.badge, background: 'rgba(148,163,184,0.12)', color: colors.textSecondary }}>
                      Την έχει ο {(item as any).drivers?.name ?? 'άλλος οδηγός'}
                    </div>
                  ) : takenByMe ? (
                    <div style={{ ...cardStyles.badge, background: colors.primaryHover, color: colors.primary }}>
                      Δική σου
                    </div>
                  ) : (
                    <button
                      onClick={() => takeOrder(item.id, item.shop_id)}
                      disabled={busy}
                      style={{ ...s.takeBtn, marginTop: 10, width: '100%', opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? '...' : '✋ Παίρνω αυτή'}
                    </button>
                  )}
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
                  <td colSpan={7} style={{ ...s.td, textAlign: 'center', padding: 40, color: colors.textSecondary }}>
                    Φόρτωση...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...s.td, textAlign: 'center', padding: 52 }}>
                          <p style={{ color: colors.textSecondary, margin: 0 }}>
                      Δεν υπάρχουν διαθέσιμες παραγγελίες
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{ ...s.tr, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                  >
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
  topBar: {
    display: 'flex', alignItems: 'center', padding: '12px 16px',
    background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`,
  },
  statusBtn: { padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  tableWrap: {
    background: colors.surface, borderRadius: 12,
    border: `1px solid ${colors.border}`, overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '12px 16px',
    color: colors.textSecondary, fontWeight: 500, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.border}`,
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  takeBtn: {
    padding: '7px 18px', borderRadius: 8, fontSize: 13,
    fontWeight: 600, border: `1px solid rgba(58,158,251,0.4)`,
    background: colors.primaryHover, color: colors.primary,
  },
};
