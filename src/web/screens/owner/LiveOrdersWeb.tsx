import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { Order, Driver } from '../../../types';
import StatusBadge from '../../components/StatusBadge';
import { addOrderTimeline } from '../../../lib/orderHelpers';
import { sendPushToUsers } from '../../../lib/notifications';
import { isReallyOnline } from '../../../lib/onlineStatus';
import { notifyWeb } from '../../../lib/webNotify';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

type OrderRow = Order & { shop_name: string; driver_name: string | null };
type DriverOption = Driver & { online: boolean };

const columnHelper = createColumnHelper<OrderRow>();

export default function LiveOrdersWeb() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();

    const channel = supabase
      .channel('web-live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.new?.status === 'pending') {
          notifyWeb('Νέα παραγγελία', payload.new.street ?? 'Νέα παραγγελία από μαγαζί');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchDrivers)
      .subscribe();

    // Fallback: the realtime socket can silently drop without reconnecting
    // fast enough (tab throttling, network blips). Poll so the dashboard
    // never stays stale for more than a few seconds even if that happens.
    const poll = setInterval(() => {
      fetchOrders();
      fetchDrivers();
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, shops(name), drivers(name)')
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data.map((o: any) => ({
        ...o,
        shop_name: o.shops?.name ?? '—',
        driver_name: o.drivers?.name ?? null,
      })));
    }
    setLoading(false);
  }

  // Every active driver is selectable — an owner may want to hand an order
  // to someone off-shift. Online drivers sort first and get a dot marker.
  async function fetchDrivers() {
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id, online_status, last_seen_at')
      .eq('role', 'driver')
      .eq('active', true);

    if (!activeUsers?.length) { setDrivers([]); return; }

    const { data } = await supabase
      .from('drivers')
      .select('*')
      .in('id', activeUsers.map((u: any) => u.id));

    if (!data) { setDrivers([]); return; }

    const onlineById = new Map(activeUsers.map((u: any) => [u.id, isReallyOnline(u.online_status, u.last_seen_at)]));
    const options = (data as Driver[])
      .map(d => ({ ...d, online: onlineById.get(d.id) ?? false }))
      .sort((a, b) => (a.online === b.online ? a.name.localeCompare(b.name) : a.online ? -1 : 1));
    setDrivers(options);
  }

  // `.eq('status', 'pending')` makes this idempotent against a double-click:
  // once the first click's UPDATE commits, a second click's WHERE clause no
  // longer matches, so `.select().single()` returns no row and the second
  // click's timeline log is skipped instead of duplicating it.
  async function assignDriver(orderId: string, driverId: string) {
    const driver = drivers.find(d => d.id === driverId);
    const { data } = await supabase
      .from('orders')
      .update({ driver_id: driverId, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')
      .single();
    setAssigning(null);
    if (!data) return;
    await addOrderTimeline(orderId, `🛵 Πήρε ο ${driver?.name ?? 'διανομέας'} — σε διαδρομή`);
  }

  // Lets the owner undo a mistaken order (wrong shop, duplicate, assigned to
  // the wrong driver, etc). Cancels rather than hard-deletes so it still
  // shows up in the history with a clear reason, same as a shop/driver cancel.
  async function cancelOrder(order: OrderRow) {
    if (!window.confirm(`Θέλεις σίγουρα να ακυρώσεις την παραγγελία "${order.street}";`)) return;
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: 'Ακυρώθηκε από τον διαχειριστή' })
      .eq('id', order.id);
    await addOrderTimeline(order.id, '❌ Ακυρώθηκε από τον διαχειριστή');
    if (order.driver_id) {
      sendPushToUsers([order.driver_id], '❌ Ακυρώθηκε', `Η παραγγελία "${order.street}" ακυρώθηκε από τον διαχειριστή.`);
    }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('created_at', {
      header: 'Ώρα',
      cell: info => new Date(info.getValue()).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
    }),
    columnHelper.accessor('shop_name', { header: 'Κατάστημα' }),
    columnHelper.accessor('street', { header: 'Διεύθυνση' }),
    columnHelper.accessor('phone', {
      header: 'Τηλέφωνο',
      cell: info => info.getValue() ?? '—',
    }),
    columnHelper.accessor('amount', {
      header: 'Ποσό',
      cell: info => info.getValue() != null ? `€${Number(info.getValue()).toFixed(2)}` : '—',
    }),
    columnHelper.accessor('status', {
      header: 'Κατάσταση',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('driver_name', {
      header: 'Οδηγός',
      cell: info => info.getValue() ?? <span style={{ color: colors.textSecondary }}>—</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ενέργεια',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <AssignCell
            order={row.original}
            drivers={drivers}
            isOpen={assigning === row.original.id}
            onOpen={() => setAssigning(row.original.id)}
            onClose={() => setAssigning(null)}
            onAssign={assignDriver}
          />
          <button onClick={() => cancelOrder(row.original)} style={s.cancelBtn}>✕ Ακύρωση</button>
        </div>
      ),
    }),
  ], [drivers, assigning]);

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  if (loading) {
    return <p style={{ color: colors.textSecondary, fontSize: 14 }}>Φόρτωση παραγγελιών...</p>;
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={s.statsBar}>
        <Chip label={`${orders.length} Ενεργές`} color={colors.primary} />
        <Chip label={`${orders.filter(o => o.status === 'pending').length} Αναμονή`} color="#F59E0B" />
        <Chip label={`${orders.filter(o => o.status === 'assigned').length} Ανατεθειμένες`} color="#22C55E" />
        <Chip label={`${drivers.filter(d => d.online).length}/${drivers.length} Online Οδηγοί`} color="#A78BFA" />
      </div>

      {/* Orders */}
      {isMobile ? (
        <div style={cardStyles.list}>
          {orders.length === 0 ? (
            <div style={cardStyles.empty}>✓ Δεν υπάρχουν ενεργές παραγγελίες</div>
          ) : (
            orders.map(item => (
              <div key={item.id} style={cardStyles.card}>
                <div style={cardStyles.row}>
                  <span style={cardStyles.title}>{item.street}</span>
                  <StatusBadge status={item.status} />
                </div>
                {item.customer_name && <div style={cardStyles.detail}>{item.customer_name}</div>}
                {item.phone && <div style={cardStyles.detail}>{item.phone}</div>}
                <div style={cardStyles.meta}>{item.shop_name}</div>
                {item.driver_name && <div style={{ color: colors.primary, marginTop: 6, fontWeight: 600, fontSize: 13 }}>{item.driver_name}</div>}
                <div style={cardStyles.meta}>
                  {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AssignCell
                    order={item}
                    drivers={drivers}
                    isOpen={assigning === item.id}
                    onOpen={() => setAssigning(item.id)}
                    onClose={() => setAssigning(null)}
                    onAssign={assignDriver}
                  />
                  <button onClick={() => cancelOrder(item)} style={s.cancelBtn}>✕ Ακύρωση</button>
                </div>
              </div>
            ))
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...s.td, textAlign: 'center', color: colors.textSecondary, padding: 40 }}>
                  ✓ Δεν υπάρχουν ενεργές παραγγελίες
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    ...s.tr,
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
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

// ── Sub-components ──────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`,
      color,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

interface AssignCellProps {
  order: OrderRow;
  drivers: DriverOption[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAssign: (orderId: string, driverId: string) => void;
}

function AssignCell({ order, drivers, isOpen, onOpen, onClose, onAssign }: AssignCellProps) {
  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        style={{
          ...s.btn,
          background: order.status === 'assigned' ? 'transparent' : colors.primary,
          color: order.status === 'assigned' ? colors.primary : '#fff',
          border: order.status === 'assigned' ? `1px solid ${colors.primary}` : 'none',
        }}
      >
        {order.status === 'assigned' ? 'Αλλαγή' : 'Ανάθεση'}
      </button>
    );
  }

  // Offline drivers are selectable (owner may have called them directly),
  // but get a confirm() first so it isn't an accidental click — the driver
  // won't see the order pop up on their own screen unless/until they're online.
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const driverId = e.target.value;
    if (!driverId) return;
    const driver = drivers.find(d => d.id === driverId);
    if (driver && !driver.online) {
      const confirmed = window.confirm(
        `Ο ${driver.name} δεν είναι σε βάρδια αυτή τη στιγμή. Να του ανατεθεί η παραγγελία;`
      );
      if (!confirmed) { e.target.value = ''; return; }
    }
    onAssign(order.id, driverId);
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        autoFocus
        style={s.select}
        defaultValue=""
        onChange={handleChange}
      >
        <option value="" disabled>Επιλογή οδηγού...</option>
        {drivers.length === 0
          ? <option disabled>Κανένας ενεργός οδηγός</option>
          : drivers.map(d => <option key={d.id} value={d.id}>{d.online ? '🟢' : '⚫'} {d.name}</option>)
        }
      </select>
      <button onClick={onClose} style={{ ...s.btn, background: 'transparent', color: colors.textSecondary, padding: '5px 8px' }}>
        ✕
      </button>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  statsBar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tableWrap: {
    background: colors.surface,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    minWidth: 700,
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    color: colors.textSecondary,
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.border}`,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: `1px solid ${colors.border}`,
  },
  td: {
    padding: '11px 16px',
    color: colors.textPrimary,
    verticalAlign: 'middle',
  },
  btn: {
    padding: '5px 14px',
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  select: {
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    color: colors.textPrimary,
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  },
  cancelBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: 'rgba(239,68,68,0.1)',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.35)',
  },
};
