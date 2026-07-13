import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { supabase } from '../../../lib/supabase';
import { colors } from '../../theme';
import { AccountEntry, UserRole } from '../../../types';
import { isReallyOnline } from '../../../lib/onlineStatus';
import { accountDisplayName } from '../../../lib/accounts';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cardStyles } from '../../components/cardStyles';

const ROLE_LABELS: Record<UserRole, string> = {
  owner: '👑 Διαχειριστής',
  shop: '🏬 Μαγαζί',
  driver: '🛵 Ντελιβεράς',
  developer: '👨‍💻 Developer',
};

type RoleFilter = 'all' | UserRole;

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Όλοι' },
  { key: 'shop', label: '🏬 Μαγαζιά' },
  { key: 'driver', label: '🛵 Οδηγοί' },
  { key: 'owner', label: '👑 Owners' },
  { key: 'developer', label: '👨‍💻 Devs' },
];

const col = createColumnHelper<AccountEntry>();

export default function AccountsWeb() {
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [roleTarget, setRoleTarget] = useState<AccountEntry | null>(null);
  const [editTarget, setEditTarget] = useState<AccountEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
    const channel = supabase
      .channel('web-dev-accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchAccounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAccounts() {
    const { data } = await supabase
      .from('users')
      .select('id, email, role, active, approved, online_status, last_seen_at, shops(name, phone), drivers(name, phone)')
      .order('role');

    if (!data) { setLoading(false); return; }

    const result: AccountEntry[] = data.map((u: any) => ({
      id: u.id,
      role: u.role,
      name: accountDisplayName(u.role, u.shops?.name, u.drivers?.name, u.email),
      phone: u.shops?.phone ?? u.drivers?.phone ?? null,
      email: u.email,
      active: u.active,
      approved: u.approved,
      online_status: isReallyOnline(u.online_status, u.last_seen_at),
      last_seen_at: u.last_seen_at,
    }));
    setAccounts(result);
    setLoading(false);
  }

  async function toggleActive(entry: AccountEntry) {
    const verb = entry.active ? 'απενεργοποιήσεις' : 'ενεργοποιήσεις';
    if (!window.confirm(`Θέλεις σίγουρα να ${verb} τον/την "${entry.name}";`)) return;
    await supabase.from('users').update({ active: !entry.active, online_status: false }).eq('id', entry.id);
  }

  async function changeRole(entry: AccountEntry, newRole: UserRole) {
    if (!window.confirm(`Να γίνει ο/η "${entry.name}" ${ROLE_LABELS[newRole]}; Θα αποκτήσει αμέσως πρόσβαση με τον νέο ρόλο.`)) return;
    const { error } = await supabase.rpc('promote_user_role', { p_user_id: entry.id, p_new_role: newRole });
    if (error) window.alert(error.message);
    setRoleTarget(null);
  }

  function openEdit(entry: AccountEntry) {
    setEditTarget(entry);
    setEditName(entry.name);
    setEditPhone(entry.phone ?? '');
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!editName.trim()) { window.alert('Το όνομα είναι υποχρεωτικό'); return; }
    setSaving(true);
    const table = editTarget.role === 'shop' ? 'shops' : 'drivers';
    const { error } = await supabase
      .from(table)
      .update({ name: editName.trim(), phone: editPhone.trim() || null })
      .eq('id', editTarget.id);
    setSaving(false);
    if (error) { window.alert(error.message); return; }
    setEditTarget(null);
  }

  const filtered = useMemo(
    () => (filter === 'all' ? accounts : accounts.filter(a => a.role === filter)),
    [accounts, filter]
  );

  const columns = useMemo(() => [
    col.accessor('name', {
      header: 'Όνομα',
      cell: info => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{info.row.original.online_status ? '🟢' : '⚫'}</span>
          <strong style={{ color: colors.textPrimary }}>{info.getValue()}</strong>
          {!info.row.original.active && <span style={s.inactiveBadge}>Ανενεργός</span>}
        </div>
      ),
    }),
    col.accessor('role', {
      header: 'Ρόλος',
      cell: info => <span style={{ color: colors.primary, fontWeight: 600, fontSize: 13 }}>{ROLE_LABELS[info.getValue()]}</span>,
    }),
    col.accessor('email', {
      header: 'Email',
      cell: info => info.getValue() ?? <span style={{ color: colors.textMuted, fontStyle: 'italic' }}>Χωρίς λογαριασμό</span>,
    }),
    col.accessor('phone', {
      header: 'Τηλέφωνο',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('approved', {
      header: 'Έγκριση',
      cell: info => info.getValue() ? '✓' : <span style={{ color: '#F59E0B' }}>⏳ Εκκρεμεί</span>,
    }),
    col.display({
      id: 'actions',
      header: 'Ενέργειες',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(row.original.role === 'shop' || row.original.role === 'driver') && (
            <button style={s.actionBtnSecondary} onClick={() => openEdit(row.original)}>✏️ Επεξεργασία</button>
          )}
          <button style={s.actionBtnSecondary} onClick={() => setRoleTarget(row.original)}>🔁 Ρόλος</button>
          <button
            style={{ ...s.actionBtn, ...(row.original.active ? s.deactivateBtn : s.activateBtn) }}
            onClick={() => toggleActive(row.original)}
          >
            {row.original.active ? '🚫 Απενεργοποίηση' : '✓ Ενεργοποίηση'}
          </button>
        </div>
      ),
    }),
  ], []);

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...s.filterBtn,
              background: filter === f.key ? colors.primary : 'transparent',
              color: filter === f.key ? '#fff' : colors.textSecondary,
              border: `1px solid ${filter === f.key ? colors.primary : colors.border}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isMobile ? (
        <div style={cardStyles.list}>
          {loading ? (
            <p style={{ color: colors.textSecondary, textAlign: 'center' }}>Φόρτωση...</p>
          ) : filtered.length === 0 ? (
            <div style={cardStyles.empty}>Δεν υπάρχουν λογαριασμοί</div>
          ) : (
            filtered.map(entry => (
              <div key={entry.id} style={cardStyles.card}>
                <div style={cardStyles.row}>
                  <span style={cardStyles.title}>{entry.online_status ? '🟢' : '⚫'} {entry.name}</span>
                  {!entry.active && <span style={s.inactiveBadge}>Ανενεργός</span>}
                </div>
                <div style={{ color: colors.primary, fontWeight: 600, fontSize: 13 }}>{ROLE_LABELS[entry.role]}</div>
                <div style={cardStyles.detail}>
                  {entry.email ?? <span style={{ fontStyle: 'italic', color: colors.textMuted }}>Χωρίς λογαριασμό</span>}
                </div>
                <div style={cardStyles.detail}>{entry.phone ?? '—'}</div>
                <div style={cardStyles.detail}>
                  {entry.approved ? 'Εγκεκριμένος ✓' : <span style={{ color: '#F59E0B' }}>⏳ Εκκρεμεί έγκριση</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {(entry.role === 'shop' || entry.role === 'driver') && (
                    <button style={s.actionBtnSecondary} onClick={() => openEdit(entry)}>✏️ Επεξεργασία</button>
                  )}
                  <button style={s.actionBtnSecondary} onClick={() => setRoleTarget(entry)}>🔁 Ρόλος</button>
                  <button
                    style={{ ...s.actionBtn, ...(entry.active ? s.deactivateBtn : s.activateBtn) }}
                    onClick={() => toggleActive(entry)}
                  >
                    {entry.active ? '🚫 Απενεργοποίηση' : '✓ Ενεργοποίηση'}
                  </button>
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
                  <th key={h.id} style={s.th}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: 40 }}>Φόρτωση...</td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: 40, color: colors.textSecondary }}>Δεν υπάρχουν λογαριασμοί</td></tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} style={{ ...s.tr, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={s.td}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {roleTarget && (
        <div style={s.overlay} onClick={() => setRoleTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: colors.textPrimary, margin: '0 0 16px' }}>Αλλαγή ρόλου: {roleTarget.name}</h3>
            {(['owner', 'developer', 'shop', 'driver'] as UserRole[]).map(r => (
              <button key={r} style={s.roleOption} onClick={() => changeRole(roleTarget, r)}>
                {ROLE_LABELS[r]}
              </button>
            ))}
            <button style={s.btnSecondary} onClick={() => setRoleTarget(null)}>Ακύρωση</button>
          </div>
        </div>
      )}

      {editTarget && (
        <div style={s.overlay} onClick={() => setEditTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: colors.textPrimary, margin: '0 0 16px' }}>Επεξεργασία: {editTarget.name}</h3>

            <label style={s.editLabel}>Όνομα</label>
            <input style={s.editInput} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Όνομα" />

            <label style={s.editLabel}>Τηλέφωνο</label>
            <input style={s.editInput} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="π.χ. 6941234567" />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={{ ...s.btnSecondary, width: 'auto', flex: 1, marginTop: 0 }} onClick={() => setEditTarget(null)}>Ακύρωση</button>
              <button
                style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? 'Αποθήκευση...' : '💾 Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  filterBtn: { padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  tableWrap: { background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 800 },
  th: {
    textAlign: 'left', padding: '12px 16px', color: colors.textSecondary, fontWeight: 500,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap',
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '11px 16px', color: colors.textPrimary, verticalAlign: 'middle' },
  inactiveBadge: { background: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  actionBtnSecondary: {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, whiteSpace: 'nowrap',
  },
  actionBtn: { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  deactivateBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444' },
  activateBtn: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 28, width: 380, maxWidth: '90vw' },
  roleOption: {
    display: 'block', width: '100%', textAlign: 'left', padding: 14, borderRadius: 10, marginBottom: 8,
    background: colors.bg, border: `1px solid ${colors.border}`, color: colors.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    width: '100%', padding: 12, borderRadius: 10, marginTop: 4, background: 'transparent',
    border: `1px solid ${colors.border}`, color: colors.textSecondary, fontWeight: 600, cursor: 'pointer',
  },
  editLabel: { display: 'block', fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  editInput: {
    width: '100%', boxSizing: 'border-box', background: colors.bg, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '11px 14px', fontSize: 14, color: colors.textPrimary, outline: 'none',
  },
  saveBtn: {
    flex: 1, padding: 12, borderRadius: 10, background: colors.primary,
    border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
  },
};
