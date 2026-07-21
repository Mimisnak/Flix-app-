import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { addOrderTimeline } from '../../../lib/orderHelpers';
import { sendPushToUsers } from '../../../lib/notifications';
import { colors } from '../../theme';
import { Order } from '../../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

const col = createColumnHelper<Order>();

type IssueStep = 'choice' | 'other';

export default function MyOrdersWeb() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [issueOrder, setIssueOrder] = useState<Order | null>(null);
  const [issueStep, setIssueStep] = useState<IssueStep>('choice');
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => { initUser(); }, []);

  useEffect(() => {
    if (!userId) return;
    fetchMyOrders();
    const channel = supabase
      .channel(`web-my-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${userId}` }, fetchMyOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function initUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  }

  async function fetchMyOrders() {
    if (!userId) return;
    const { data } = await supabase.from('orders')
      .select('*, shops(name)')
      .eq('driver_id', userId)
      .eq('status', 'assigned')
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  const completeOrder = useCallback(async (orderId: string, shopId: string) => {
    setCompletingId(orderId);
    await supabase.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', orderId);
    await addOrderTimeline(orderId, '✅ Παραδόθηκε');
    setOrders(prev => prev.filter(o => o.id !== orderId));
    sendPushToUsers([shopId], '✅ Παραδόθηκε!', 'Η παραγγελία ολοκληρώθηκε επιτυχώς.');
    setCompletingId(null);
  }, []);

  function openIssueModal(order: Order) {
    setIssueOrder(order);
    setIssueStep('choice');
    setOtherReason('');
  }

  function closeIssueModal() {
    setIssueOrder(null);
    setIssueStep('choice');
    setOtherReason('');
  }

  const cancelOrder = useCallback(async (orderId: string, shopId: string, reason: string) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled', cancel_reason: reason }).eq('id', orderId);
    if (error) {
      window.alert('Δεν ήταν δυνατή η ακύρωση της παραγγελίας. Δοκίμασε ξανά.');
      return;
    }
    await addOrderTimeline(orderId, `❌ Ακυρώθηκε από τον οδηγό — ${reason}`);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    sendPushToUsers([shopId], '❌ Ακυρώθηκε', reason);
    closeIssueModal();
  }, []);

  // Clearing driver_id no longer matches this screen's `driver_id=eq.userId`
  // realtime filter, so remove it from the local list directly instead of
  // waiting on a channel event that won't arrive.
  const unassignOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ driver_id: null, status: 'pending', assigned_at: null }).eq('id', orderId);
    if (error) {
      window.alert('Δεν ήταν δυνατή η αποδέσμευση της παραγγελίας. Δοκίμασε ξανά.');
      return;
    }
    await addOrderTimeline(orderId, '↩️ Αποδεσμεύτηκε από τον οδηγό — επέστρεψε στις διαθέσιμες');
    setOrders(prev => prev.filter(o => o.id !== orderId));
    closeIssueModal();
  }, []);

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
        const busy = completingId === item.id;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => completeOrder(item.id, item.shop_id)}
              disabled={busy}
              style={{ ...s.completeBtn, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy ? '...' : '✅ Παραδόθηκε'}
            </button>
            <button onClick={() => openIssueModal(item)} style={s.issueBtn}>
              ⚠️ Πρόβλημα
            </button>
          </div>
        );
      },
    }),
  ], [completeOrder, completingId]);

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {orders.length > 0 && (
        <div style={{ color: colors.textSecondary, fontSize: 14 }}>
          {orders.length} παραγγελίες σε εξέλιξη
        </div>
      )}

      {isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : orders.length === 0 ? (
            <div style={cardStyles.empty}>
              Δεν έχεις ενεργές παραγγελίες
            </div>
          ) : (
            orders.map(item => {
              const busy = completingId === item.id;
              return (
                <div key={item.id} style={cardStyles.card}>
                  <div style={{ color: colors.primary, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {(item as any).shops?.name ?? '—'}
                  </div>
                  <div style={cardStyles.row}>
                    <span style={cardStyles.title}>{item.street}</span>
                  </div>
                  {item.customer_name && <div style={cardStyles.detail}>{item.customer_name}</div>}
                  {item.phone && <div style={cardStyles.detail}>{item.phone}</div>}
                  {item.amount != null && <div style={cardStyles.amount}>{item.amount.toFixed(2)}€</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => completeOrder(item.id, item.shop_id)}
                      disabled={busy}
                      style={{ ...s.completeBtn, flex: 1, opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? '...' : '✅ Παραδόθηκε'}
                    </button>
                    <button onClick={() => openIssueModal(item)} style={s.issueBtn}>
                      ⚠️ Πρόβλημα
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
                <td colSpan={7} style={{ ...s.td, textAlign: 'center', padding: 40, color: colors.textSecondary }}>
                  Φόρτωση...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...s.td, textAlign: 'center', padding: 52 }}>
                      <p style={{ color: colors.textSecondary, margin: 0 }}>
                    Δεν έχεις ενεργές παραγγελίες
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

      {issueOrder && (
        <div style={s.overlay}>
          <div style={s.modal}>
            {issueStep === 'choice' ? (
              <>
                <h3 style={{ color: colors.textPrimary, margin: '0 0 4px' }}>Πρόβλημα με την παραγγελία</h3>
                <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 18px' }}>{issueOrder.street}</p>

                <button
                  style={s.optionBtn}
                  onClick={() => cancelOrder(issueOrder.id, issueOrder.shop_id, 'Αδυναμία επικοινωνίας πελάτη')}
                >
                  <span style={{ display: 'block', fontWeight: 600 }}>Αδυναμία επικοινωνίας πελάτη</span>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textMuted, marginTop: 3 }}>Ακυρώνει την παραγγελία</span>
                </button>

                <button style={s.optionBtn} onClick={() => unassignOrder(issueOrder.id)}>
                  <span style={{ display: 'block', fontWeight: 600 }}>Έκανα λάθος / Ανάθεση σε άλλον</span>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textMuted, marginTop: 3 }}>Επιστρέφει στις διαθέσιμες, ΔΕΝ ακυρώνεται</span>
                </button>

                <button style={s.optionBtn} onClick={() => setIssueStep('other')}>
                  <span style={{ display: 'block', fontWeight: 600 }}>Άλλο</span>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textMuted, marginTop: 3 }}>Γράψε την αιτία — ακυρώνει την παραγγελία</span>
                </button>

                <button onClick={closeIssueModal} style={s.btnSecondary}>Πίσω</button>
              </>
            ) : (
              <>
                <h3 style={{ color: colors.textPrimary, margin: '0 0 14px' }}>Αιτία ακύρωσης</h3>
                <textarea
                  style={s.modalInput}
                  placeholder="Γράψε τι έγινε..."
                  value={otherReason}
                  onChange={e => setOtherReason(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={() => setIssueStep('choice')} style={s.btnSecondary}>Πίσω</button>
                  <button
                    onClick={() => cancelOrder(issueOrder.id, issueOrder.shop_id, otherReason.trim())}
                    disabled={!otherReason.trim()}
                    style={{ ...s.btnDanger, opacity: otherReason.trim() ? 1 : 0.5, cursor: otherReason.trim() ? 'pointer' : 'not-allowed' }}
                  >
                    Ακύρωση Παραγγελίας
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
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
  completeBtn: {
    padding: '7px 18px', borderRadius: 8, fontSize: 13,
    fontWeight: 600, border: '1px solid rgba(34,197,94,0.4)',
    background: 'rgba(34,197,94,0.12)', color: '#22C55E',
    cursor: 'pointer',
  },
  issueBtn: {
    padding: '7px 14px', borderRadius: 8, fontSize: 13,
    fontWeight: 600, border: '1px solid rgba(239,68,68,0.35)',
    background: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 20, padding: 28, width: 440,
    maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  optionBtn: {
    display: 'block', width: '100%', textAlign: 'left', boxSizing: 'border-box',
    background: colors.bg, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '12px 14px', marginBottom: 10,
    color: colors.textPrimary, fontSize: 14, cursor: 'pointer',
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box', minHeight: 90, resize: 'vertical',
    background: colors.bg, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '11px 14px',
    fontSize: 14, color: colors.textPrimary, outline: 'none',
  },
  btnSecondary: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: 'transparent', border: `1px solid ${colors.border}`,
    color: colors.textSecondary, marginTop: 4,
  },
  btnDanger: {
    flex: 1, padding: '11px 16px', borderRadius: 10,
    fontSize: 14, fontWeight: 600,
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444',
  },
};
