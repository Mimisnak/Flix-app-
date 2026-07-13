import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';

interface DriverStat {
  id: string;
  name: string;
  deliveries: number;
  revenue: number;
}

interface ShopStat {
  id: string;
  name: string;
  total: number;
}

interface Stats {
  totalOrders: number;
  deliveredCount: number;
}

type DateRange = 'today' | 'yesterday' | 'week';

const columnHelper = createColumnHelper<DriverStat>();

// Mirrors the date-range logic in screens/owner/StatsScreen.tsx (mobile) so
// "today"/"yesterday"/"week" report the same numbers on both platforms.
function getDateStart(range: DateRange): string {
  const d = new Date();
  if (range === 'today') d.setHours(0, 0, 0, 0);
  else if (range === 'yesterday') { d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); }
  else { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); }
  return d.toISOString();
}

function getDateEnd(range: DateRange): string | null {
  if (range === 'yesterday') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  return null;
}

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Σήμερα' },
  { key: 'yesterday', label: 'Χθες' },
  { key: 'week', label: '7 Μέρες' },
];

export default function StatsWeb() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, deliveredCount: 0 });
  const [drivers, setDrivers] = useState<DriverStat[]>([]);
  const [shops, setShops] = useState<ShopStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  async function fetchStats() {
    setLoading(true);
    const start = getDateStart(dateRange);
    const end = getDateEnd(dateRange);

    let query = supabase
      .from('orders')
      .select('amount, status, driver_id, shop_id')
      .gte('created_at', start);
    if (end) query = query.lt('created_at', end);

    const { data } = await query;
    const rows = data ?? [];

    setStats({
      totalOrders: rows.length,
      deliveredCount: rows.filter(o => o.status === 'delivered').length,
    });

    // Aggregate deliveries + revenue per driver (delivered orders only, within range)
    const driverMap: Record<string, { count: number; revenue: number }> = {};
    for (const o of rows) {
      if (!o.driver_id || o.status !== 'delivered') continue;
      if (!driverMap[o.driver_id]) driverMap[o.driver_id] = { count: 0, revenue: 0 };
      driverMap[o.driver_id].count += 1;
      driverMap[o.driver_id].revenue += o.amount ?? 0;
    }

    // Aggregate order count per shop (all statuses, within range) — mirrors
    // the shop breakdown in screens/owner/StatsScreen.tsx (mobile).
    const shopMap: Record<string, number> = {};
    for (const o of rows) {
      if (!o.shop_id) continue;
      shopMap[o.shop_id] = (shopMap[o.shop_id] ?? 0) + 1;
    }

    const [driverIds, shopIds] = [Object.keys(driverMap), Object.keys(shopMap)];

    const [driverRowsRes, shopRowsRes] = await Promise.all([
      driverIds.length
        ? supabase.from('drivers').select('id, name').in('id', driverIds)
        : Promise.resolve({ data: [] as any[] }),
      shopIds.length
        ? supabase.from('shops').select('id, name').in('id', shopIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const driverStats: DriverStat[] = (driverRowsRes.data ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      deliveries: driverMap[d.id]?.count ?? 0,
      revenue: driverMap[d.id]?.revenue ?? 0,
    })).sort((a, b) => b.deliveries - a.deliveries);

    const shopStats: ShopStat[] = (shopRowsRes.data ?? []).map((sh: any) => ({
      id: sh.id,
      name: sh.name,
      total: shopMap[sh.id] ?? 0,
    })).sort((a, b) => b.total - a.total);

    setDrivers(driverStats);
    setShops(shopStats);
    setLoading(false);
  }

  const maxDeliveries = drivers[0]?.deliveries ?? 1;

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'rank',
      header: '#',
      cell: ({ row }) => (
        <span style={{ color: row.index === 0 ? '#F59E0B' : row.index === 1 ? '#9CA3AF' : row.index === 2 ? '#CD7C3A' : colors.textSecondary, fontWeight: 700, fontSize: 15 }}>
          {row.index === 0 ? '🥇' : row.index === 1 ? '🥈' : row.index === 2 ? '🥉' : `#${row.index + 1}`}
        </span>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Οδηγός',
      cell: info => <strong style={{ color: colors.textPrimary }}>{info.getValue()}</strong>,
    }),
    columnHelper.accessor('deliveries', {
      header: 'Παραδόσεις',
      cell: info => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: colors.border, borderRadius: 4, height: 6, minWidth: 80 }}>
            <div style={{ width: `${(info.getValue() / maxDeliveries) * 100}%`, background: colors.primary, borderRadius: 4, height: '100%' }} />
          </div>
          <span style={{ color: colors.textPrimary, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>
            {info.getValue()}
          </span>
        </div>
      ),
    }),
  ], [drivers, maxDeliveries]);

  const table = useReactTable({
    data: drivers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) return <p style={{ color: colors.textSecondary, fontSize: 14 }}>Φόρτωση στατιστικών...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Date range filter — mirrors the mobile StatsScreen filter */}
      <div style={s.filterRow}>
        {DATE_RANGES.map(f => (
          <button
            key={f.key}
            onClick={() => setDateRange(f.key)}
            style={{
              ...s.filterBtn,
              background: dateRange === f.key ? colors.primary : 'transparent',
              color: dateRange === f.key ? '#fff' : colors.textSecondary,
              border: `1px solid ${dateRange === f.key ? colors.primary : colors.border}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        <KpiCard
          icon="📦"
          label="Σύνολο Παραγγελιών"
          value={stats.totalOrders.toString()}
          sub="στην επιλεγμένη περίοδο"
          accent={colors.primary}
        />
        <KpiCard
          icon="✅"
          label="Παραδόθηκαν"
          value={stats.deliveredCount.toString()}
          sub={`${stats.totalOrders - stats.deliveredCount} σε εξέλιξη`}
          accent={colors.success}
        />
      </div>

      {/* Top Drivers Table */}
      <div>
        <h3 style={s.sectionTitle}>🏆 Κατάταξη Οδηγών</h3>
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
                  <td colSpan={5} style={{ ...s.td, textAlign: 'center', color: colors.textSecondary, padding: 32 }}>
                    Δεν υπάρχουν παραδόσεις ακόμα
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
      </div>

      {/* Shop Breakdown */}
      <div>
        <h3 style={s.sectionTitle}>🏬 Παραγγελίες ανά Μαγαζί</h3>
        <div style={s.shopCard}>
          {shops.length === 0 ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Δεν υπάρχουν δεδομένα
            </p>
          ) : (
            shops.map(sh => (
              <div key={sh.id} style={s.shopRow}>
                <span style={s.shopName}>{sh.name}</span>
                <div style={s.shopBar}>
                  <div
                    style={{
                      ...s.shopBarFill,
                      width: `${Math.round((sh.total / (shops[0]?.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span style={s.shopCount}>{sh.total}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accent: string;
}

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div style={{ ...s.kpiCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <p style={s.kpiLabel}>{label}</p>
      <p style={{ ...s.kpiValue, color: accent }}>{value}</p>
      <p style={s.kpiSub}>{sub}</p>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  filterRow: {
    display: 'flex',
    gap: 8,
  },
  filterBtn: {
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    background: colors.surface,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: '20px 24px',
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    margin: 0,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  kpiValue: {
    fontSize: 36,
    fontWeight: 700,
    margin: 0,
    marginBottom: 4,
    letterSpacing: '-1px',
  },
  kpiSub: {
    color: colors.textSecondary,
    fontSize: 12,
    margin: 0,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 600,
    margin: '0 0 12px',
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
    padding: '12px 16px',
    color: colors.textPrimary,
    verticalAlign: 'middle',
  },
  shopCard: {
    background: colors.surface,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: '8px 20px',
  },
  shopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  shopName: {
    width: 160,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 500,
    color: colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shopBar: {
    flex: 1,
    height: 8,
    background: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  shopBarFill: {
    height: '100%',
    background: colors.primary,
    borderRadius: 4,
  },
  shopCount: {
    width: 32,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: 700,
    color: colors.textPrimary,
  },
};
