import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { Order } from '../../../types';
import StatusBadge from '../../components/StatusBadge';
import OrderDetailModalWeb from '../../components/OrderDetailModalWeb';
import { ordersToCsv } from '../../../lib/csv';
import { exportTextFile } from '../../../lib/exportFile';
import { fetchAllPaginated, formatDurationBetween } from '../../../lib/orderHelpers';

type HistoryOrder = Order & { shop_name: string; driver_name: string | null };
type Period = '1h' | '24h' | '7d' | '30d' | '1y';
type StatusFilter = 'all' | 'delivered' | 'cancelled';

const PERIODS: { key: Period; label: string }[] = [
  { key: '1h',  label: 'Ώρα' },
  { key: '24h', label: 'Ημέρα' },
  { key: '7d',  label: 'Εβδομάδα' },
  { key: '30d', label: 'Μήνας' },
  { key: '1y',  label: 'Χρόνος' },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'Όλες' },
  { key: 'delivered', label: 'Παραδόθηκαν' },
  { key: 'cancelled', label: 'Ακυρώθηκαν' },
];

function periodToDate(p: Period): string {
  const ms: Record<Period, number> = {
    '1h':  1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '1y':  365 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - ms[p]).toISOString();
}

const columnHelper = createColumnHelper<HistoryOrder>();

export default function HistoryWeb() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [period, setPeriod] = useState<Period>('24h');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<HistoryOrder | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, shops(name), drivers(name)')
      .gte('created_at', periodToDate(period))
      .in('status', ['delivered', 'cancelled'])
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    if (data) {
      setOrders(data.map((o: any) => ({
        ...o,
        shop_name: o.shops?.name ?? '—',
        driver_name: o.drivers?.name ?? null,
      })));
    }
    setLoading(false);
  }, [period, statusFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    const channel = supabase
      .channel('web-owner-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchHistory)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchHistory]);

  function matchesSearch(o: HistoryOrder, q: string): boolean {
    return !!(
      o.street?.toLowerCase().includes(q) ||
      o.shop_name?.toLowerCase().includes(q) ||
      o.driver_name?.toLowerCase().includes(q) ||
      o.phone?.includes(q) ||
      o.customer_name?.toLowerCase().includes(q)
    );
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => matchesSearch(o, q));
  }, [orders, search]);

  const columns = useMemo(() => [
    columnHelper.accessor('created_at', {
      header: 'Ημερομηνία / Ώρα',
      cell: info => {
        const d = new Date(info.getValue());
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
              {d.toLocaleDateString('el-GR')}
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>
              {d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('shop_name', { header: 'Κατάστημα' }),
    columnHelper.accessor('street', { header: 'Διεύθυνση' }),
    columnHelper.accessor('customer_name', {
      header: 'Πελάτης',
      cell: info => info.getValue() ?? '—',
    }),
    columnHelper.accessor('phone', {
      header: 'Τηλέφωνο',
      cell: info => info.getValue() ?? '—',
    }),
    columnHelper.accessor('driver_name', {
      header: 'Οδηγός',
      cell: info => info.getValue() ?? <span style={{ color: colors.textSecondary }}>—</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Κατάσταση',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'delivery_info',
      header: 'Παράδοση',
      cell: ({ row }) => {
        const o = row.original;
        if (o.status !== 'delivered' || !o.delivered_at) return <span style={{ color: colors.textSecondary }}>—</span>;
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
    columnHelper.accessor('cancel_reason', {
      header: 'Αιτία Ακύρωσης',
      cell: info => info.getValue()
        ? <span style={{ color: '#EF4444', fontSize: 12 }}>{info.getValue()}</span>
        : <span style={{ color: colors.textSecondary }}>—</span>,
    }),
  ], []);

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });

  async function handleExport() {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      function buildQuery() {
        let q = supabase
          .from('orders')
          .select('*, shops(name), drivers(name)')
          .gte('created_at', periodToDate(period))
          .in('status', ['delivered', 'cancelled'])
          .order('created_at', { ascending: false });
        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        return q;
      }
      const allRows = await fetchAllPaginated((from, to) => buildQuery().range(from, to));
      const allOrders: HistoryOrder[] = allRows.map((o: any) => ({
        ...o,
        shop_name: o.shops?.name ?? '—',
        driver_name: o.drivers?.name ?? null,
      }));
      const q = search.trim().toLowerCase();
      const exportRows = q ? allOrders.filter(o => matchesSearch(o, q)) : allOrders;
      const csv = ordersToCsv(exportRows);
      const periodLabel = PERIODS.find(p => p.key === period)?.label ?? period;
      await exportTextFile(`flixfix-paraggelies-${periodLabel}.csv`, csv, 'text/csv');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filter Bar */}
      <div style={s.filterBar}>
        {/* Period filters */}
        <div style={s.filterGroup}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                ...s.filterBtn,
                background: period === p.key ? colors.primary : 'transparent',
                color: period === p.key ? '#fff' : colors.textSecondary,
                border: `1px solid ${period === p.key ? colors.primary : colors.border}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div style={s.filterGroup}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              style={{
                ...s.filterBtn,
                background: statusFilter === opt.key ? colors.surface : 'transparent',
                color: statusFilter === opt.key ? colors.textPrimary : colors.textSecondary,
                border: `1px solid ${statusFilter === opt.key ? colors.primary : colors.border}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          style={s.search}
          placeholder="Αναζήτηση διεύθυνση, πελάτη, τηλέφωνο..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button
          style={{ ...s.filterBtn, background: colors.primary, color: '#fff', border: 'none', opacity: exporting || filtered.length === 0 ? 0.5 : 1 }}
          onClick={handleExport}
          disabled={exporting || filtered.length === 0}
        >
          {exporting ? 'Εξαγωγή...' : '⬇️ Λήψη CSV'}
        </button>
      </div>

      {/* Result count */}
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
        {loading ? 'Φόρτωση...' : `${filtered.length} αποτελέσματα`}
      </p>

      {/* Table */}
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
            {table.getRowModel().rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} style={{ ...s.td, textAlign: 'center', color: colors.textSecondary, padding: 40 }}>
                  Δεν βρέθηκαν παραγγελίες για αυτό το φίλτρο
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedOrder(row.original)}
                  style={{ ...s.tr, cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
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

      <OrderDetailModalWeb order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  filterGroup: {
    display: 'flex',
    gap: 6,
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  search: {
    flex: 1,
    minWidth: 200,
    padding: '7px 12px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.textPrimary,
    fontSize: 13,
    outline: 'none',
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
    minWidth: 800,
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
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '11px 16px', color: colors.textPrimary, verticalAlign: 'middle' },
};
