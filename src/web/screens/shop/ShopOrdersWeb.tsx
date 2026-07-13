import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { Order } from '../../../types';
import StatusBadge from '../../components/StatusBadge';
import { notifyWeb } from '../../../lib/webNotify';

const col = createColumnHelper<Order>();

export default function ShopOrdersWeb() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { initShop(); }, []);

  useEffect(() => {
    if (!shopId) return;
    fetchOrders();
    const channel = supabase
      .channel(`web-shop-orders-${shopId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, fetchOrders)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, (payload: any) => {
        if (payload.new?.status === 'assigned') {
          notifyWeb('Παραλαμβάνεται', `Η παραγγελία «${payload.new.street}» παραλήφθηκε από οδηγό.`);
        } else if (payload.new?.status === 'delivered') {
          notifyWeb('Παραδόθηκε', `Η παραγγελία «${payload.new.street}» ολοκληρώθηκε.`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function initShop() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setShopId(user.id);
    const { data } = await supabase.from('users').select('online_status').eq('id', user.id).single();
    if (data) setIsOpen(data.online_status);
  }

  async function fetchOrders() {
    if (!shopId) return;
    const { data } = await supabase.from('orders')
      .select('*, drivers(name)')
      .eq('shop_id', shopId)
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function toggleShop() {
    if (!shopId) return;
    const newStatus = !isOpen;
    await supabase.from('users').update({ online_status: newStatus, last_seen_at: new Date().toISOString() }).eq('id', shopId);
    setIsOpen(newStatus);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    await supabase.from('orders')
      .update({ status: 'cancelled', cancel_reason: cancelReason })
      .eq('id', cancelTarget.id);
    await supabase.from('order_timeline').insert({ order_id: cancelTarget.id, event: '❌ Ακυρώθηκε από το μαγαζί' });
    setCancelTarget(null);
    setCancelReason('');
    fetchOrders();
  }

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
      cell: ({ row }) => (
        <div>
          <strong style={{ color: colors.textPrimary }}>{row.original.street}</strong>
          {row.original.created_by_owner && (
            <div style={{ fontSize: 11, color: colors.primary, fontWeight: 600, marginTop: 2 }}>
              Ανατέθηκε από τον ιδιοκτήτη
            </div>
          )}
        </div>
      ),
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
    col.accessor('status', {
      header: 'Κατάσταση',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    col.display({
      id: 'driver',
      header: 'Οδηγός',
      cell: ({ row }) => {
        const name = (row.original as any).drivers?.name;
        return <span style={{ color: name ? colors.primary : colors.textMuted }}>{name ?? '—'}</span>;
      },
    }),
    col.display({
      id: 'actions',
      header: 'Ενέργεια',
      cell: ({ row }) => {
        if (row.original.status !== 'pending') return null;
        return (
          <button
            onClick={() => { setCancelTarget(row.original); setCancelReason(''); }}
            style={s.cancelBtn}
          >
            ✕ Ακύρωση
          </button>
        );
      },
    }),
  ], []);

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top control bar */}
      <div style={s.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={toggleShop}
            style={{
              ...s.statusBtn,
              background: isOpen ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isOpen ? '#22C55E' : '#EF4444',
              border: `1px solid ${isOpen ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }}
          >
            {isOpen ? 'Ανοιχτό' : 'Κλειστό'}
          </button>
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>
            {orders.length} ενεργές παραγγελίες
          </span>
        </div>
      </div>

      {/* Orders table */}
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
                <td colSpan={8} style={{ ...s.td, textAlign: 'center', padding: 40, color: colors.textSecondary }}>
                  Φόρτωση...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...s.td, textAlign: 'center', padding: 52 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                  <p style={{ color: colors.textSecondary, margin: 0 }}>Δεν υπάρχουν ενεργές παραγγελίες</p>
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

      {/* Cancel modal */}
      {cancelTarget && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ color: colors.textPrimary, margin: '0 0 6px' }}>✕ Ακύρωση Παραγγελίας</h3>
            <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 18px' }}>
              📍 {cancelTarget.street}
            </p>
            <label style={{ fontSize: 13, color: colors.textSecondary, display: 'block', marginBottom: 6 }}>
              Αιτία (προαιρετικά)
            </label>
            <input
              style={s.modalInput}
              placeholder="π.χ. Ο πελάτης ακύρωσε..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setCancelTarget(null)} style={s.btnSecondary}>Αναίρεση</button>
              <button onClick={confirmCancel} style={s.btnDanger}>✕ Ακύρωση Παραγγελίας</button>
            </div>
          </div>
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
  statusBtn: {
    padding: '8px 20px', borderRadius: 20,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
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
  cancelBtn: {
    padding: '5px 14px', borderRadius: 8, fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
    background: 'rgba(239,68,68,0.1)', color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.35)',
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
  btnDanger: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444',
  },
};
