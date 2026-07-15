import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { Order } from '../../../types';
import StatusBadge from '../../components/StatusBadge';
import { formatDurationBetween } from '../../../lib/orderHelpers';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

const col = createColumnHelper<Order>();

export default function DriverHistoryWeb() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => { initDriver(); }, []);

  useEffect(() => {
    if (!driverId) return;
    fetchHistory();
    const channel = supabase
      .channel(`web-driver-history-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${driverId}` }, fetchHistory)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  async function initDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setDriverId(user.id);
  }

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const since = new Date();
    since.setHours(since.getHours() - 24);
    const { data } = await supabase.from('orders')
      .select('*, shops(name)')
      .eq('driver_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  const delivered = orders.filter(o => o.status === 'delivered').length;

  const columns = useMemo(() => [
    col.accessor('created_at', {
      header: 'Ημερομηνία / Ώρα',
      cell: info => (
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>
          {new Date(info.getValue()).toLocaleString('el-GR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
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
    col.display({
      id: 'shop',
      header: 'Μαγαζί',
      cell: ({ row }) => (
        <span style={{ color: colors.textSecondary }}>
          {(row.original as any).shops?.name ?? '—'}
        </span>
      ),
    }),
    col.accessor('status', {
      header: 'Κατάσταση',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    col.display({
      id: 'delivery_info',
      header: 'Παράδοση',
      cell: ({ row }) => {
        const o = row.original;
        if (o.status !== 'delivered' || !o.delivered_at) return <span style={{ color: colors.textMuted }}>—</span>;
        const time = new Date(o.delivered_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
        const duration = formatDurationBetween(o.assigned_at ?? o.created_at, o.delivered_at);
        return (
          <div>
            <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>{time}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>{duration}</div>
          </div>
        );
      },
    }),
    col.accessor('cancel_reason', {
      header: 'Αιτία Ακύρωσης',
      cell: info => (
        <span style={{ color: colors.textMuted, fontSize: 12 }}>{info.getValue() ?? '—'}</span>
      ),
    }),
  ], []);

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI cards */}
      <div style={s.statsRow}>
        {[
          { label: 'Σύνολο', value: orders.length, color: colors.textPrimary },
          { label: 'Παραδόθηκαν', value: delivered, color: '#22C55E' },
        ].map(stat => (
          <div key={stat.label} style={s.statCard}>
            <span style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</span>
            <span style={{ color: colors.textSecondary, fontSize: 13 }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Orders */}
      {isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : orders.length === 0 ? (
            <div style={cardStyles.empty}>Δεν υπάρχουν παραδόσεις τις τελευταίες 24 ώρες</div>
          ) : (
            orders.map(o => {
              const delivery = o.status === 'delivered' && o.delivered_at
                ? { time: new Date(o.delivered_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }), duration: formatDurationBetween(o.assigned_at ?? o.created_at, o.delivered_at) }
                : null;
              return (
                <div key={o.id} style={cardStyles.card}>
                  <div style={cardStyles.row}>
                    <span style={cardStyles.title}>{o.street}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  {o.customer_name && <div style={cardStyles.detail}>{o.customer_name}</div>}
                  <div style={cardStyles.meta}>{(o as any).shops?.name ?? '—'}</div>
                  {delivery && (
                    <div style={{ color: '#22C55E', marginTop: 4, fontSize: 12, fontWeight: 600 }}>
                      {delivery.time} · διάρκεια {delivery.duration}
                    </div>
                  )}
                  {o.cancel_reason && <div style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>{o.cancel_reason}</div>}
                  <div style={cardStyles.meta}>
                    {new Date(o.created_at).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                    Δεν υπάρχουν παραδόσεις τις τελευταίες 24 ώρες
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
  statsRow: { display: 'flex', gap: 14 },
  statCard: {
    flex: 1, background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 12, padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 4,
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
};
