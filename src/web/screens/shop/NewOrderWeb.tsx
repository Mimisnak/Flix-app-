import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sendPushToOnlineDrivers, sendPushToOwners } from '../../../lib/notifications';
import { colors } from '../../theme';
import { Customer } from '../../../types';

export default function NewOrderWeb() {
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [street, setStreet] = useState('');
  const [bell, setBell] = useState('');
  const [floor, setFloor] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { initShop(); }, []);

  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`web-new-order-shop-status-${shopId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${shopId}` },
        (payload: any) => setIsOpen(payload.new.online_status)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function initShop() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setShopId(user.id);
    const { data } = await supabase.from('users').select('online_status').eq('id', user.id).single();
    if (data) setIsOpen(data.online_status);
    setStatusLoading(false);
  }

  async function openShop() {
    if (!shopId) return;
    await supabase.from('users').update({ online_status: true, last_seen_at: new Date().toISOString() }).eq('id', shopId);
    setIsOpen(true);
  }

  async function doSearchCustomer(phoneInput: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', user.id)
      .ilike('phone', `${phoneInput}%`)
      .limit(5);
    setSuggestions((data as Customer[]) ?? []);
  }

  function handlePhoneChange(val: string) {
    setPhone(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.length < 4) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(() => doSearchCustomer(val), 350);
  }

  // Same idea as phone search, but keyed by address — a shared street
  // (apartment block, same road) can belong to several different
  // customers, so typing the street should offer them as a choice too.
  async function doSearchByStreet(streetInput: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', user.id)
      .ilike('address', `%${streetInput}%`)
      .limit(5);
    setStreetSuggestions((data as Customer[]) ?? []);
  }

  function handleStreetChange(val: string) {
    setStreet(val);
    if (streetSearchTimer.current) clearTimeout(streetSearchTimer.current);
    if (val.trim().length < 3) { setStreetSuggestions([]); return; }
    streetSearchTimer.current = setTimeout(() => doSearchByStreet(val), 350);
  }

  function applyCustomer(c: Customer) {
    setPhone(c.phone);
    setCustomerName(c.name ?? '');
    setStreet(c.address ?? '');
    setBell(c.bell ?? '');
    setFloor(c.floor ?? '');
    setSuggestions([]);
    setStreetSuggestions([]);
  }

  async function saveCustomer(userId: string) {
    if (!phone) return;
    const { data: existing } = await supabase
      .from('customers').select('id').eq('shop_id', userId).eq('phone', phone).single();
    if (existing) {
      await supabase.from('customers')
        .update({ name: customerName || null, address: street, bell: bell || null, floor: floor || null })
        .eq('id', existing.id);
    } else {
      await supabase.from('customers')
        .insert({ shop_id: userId, phone, name: customerName || null, address: street, bell: bell || null, floor: floor || null });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!street.trim() || !isOpen) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    const { data: order, error } = await supabase.from('orders').insert({
      shop_id: user.id,
      street: street.trim(),
      phone: phone.trim() || null,
      customer_name: customerName.trim() || null,
      bell: bell.trim() || null,
      floor: floor.trim() || null,
      notes: notes.trim() || null,
      amount: isNaN(parsedAmount) ? null : parsedAmount,
      status: 'pending',
    }).select().single();

    if (error) { setLoading(false); return; }

    await supabase.from('order_timeline').insert({ order_id: order.id, event: '🟡 Βγήκε παραγγελία' });
    await saveCustomer(user.id);
    sendPushToOnlineDrivers('🔔 Νέα παραγγελία!', `📍 ${street.trim()}`);
    sendPushToOwners('🔔 Νέα παραγγελία από μαγαζί', `📍 ${street.trim()}`);

    setPhone(''); setCustomerName(''); setStreet(''); setBell(''); setFloor(''); setNotes(''); setAmount('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 580 }}>
      {success && (
        <div style={s.successBanner}>
          Η παραγγελία καταχωρήθηκε! Οι online οδηγοί ειδοποιήθηκαν.
        </div>
      )}

      {!statusLoading && !isOpen && (
        <div style={s.closedBanner}>
          <span>Το μαγαζί είναι κλειστό — άνοιξέ το για να δημιουργήσεις παραγγελία.</span>
          <button type="button" onClick={openShop} style={s.openBtn}>Άνοιγμα Μαγαζιού</button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex', flexDirection: 'column', gap: 18,
          opacity: isOpen ? 1 : 0.5,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >

        {/* Phone + Autocomplete */}
        <div style={{ position: 'relative' }}>
          <label style={s.label}>Τηλέφωνο</label>
          <input
            style={s.input}
            type="tel"
            value={phone}
            onChange={e => handlePhoneChange(e.target.value)}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div style={s.suggestions}>
              {suggestions.map(c => (
                <div
                  key={c.id}
                  style={s.suggestion}
                  onClick={() => applyCustomer(c)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{c.phone}</span>
                  <span style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 10 }}>
                    {[c.name, c.address].filter(Boolean).join(' — ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Address */}
        <div style={{ position: 'relative' }}>
          <label style={s.label}>
            Διεύθυνση <span style={{ color: colors.error }}>*</span>
          </label>
          <input
            style={s.input}
            placeholder="Οδός + αριθμός"
            value={street}
            onChange={e => handleStreetChange(e.target.value)}
            required
          />
          {streetSuggestions.length > 0 && (
            <div style={s.suggestions}>
              {streetSuggestions.map(c => (
                <div
                  key={c.id}
                  style={s.suggestion}
                  onClick={() => applyCustomer(c)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{c.name || 'Χωρίς όνομα'} — {c.phone}</span>
                  <span style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 10 }}>{c.address}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Name */}
        <div>
          <label style={s.label}>Όνομα Παραλήπτη</label>
          <input
            style={s.input}
            placeholder="Προαιρετικό"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
        </div>

        {/* Bell + Floor */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Κουδούνι</label>
            <input style={s.input} placeholder="Προαιρετικό" value={bell} onChange={e => setBell(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Όροφος</label>
            <input style={s.input} placeholder="Προαιρετικό" type="number" value={floor} onChange={e => setFloor(e.target.value)} />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label style={s.label}>Ποσό (€)</label>
          <input style={s.input} value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        {/* Notes */}
        <div>
          <label style={s.label}>Σημειώσεις</label>
          <textarea
            style={{ ...s.input, height: 80, resize: 'none' } as React.CSSProperties}
            placeholder="Προαιρετικό"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !street.trim() || !isOpen}
          style={{
            ...s.submitBtn,
            opacity: loading || !street.trim() || !isOpen ? 0.55 : 1,
            cursor: loading || !street.trim() || !isOpen ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Αποθήκευση...' : '✓ Καταχώρηση Παραγγελίας'}
        </button>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: colors.textSecondary, marginBottom: 6,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '11px 14px',
    fontSize: 14, color: colors.textPrimary, outline: 'none',
  },
  suggestions: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 10, zIndex: 100, overflow: 'hidden',
    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
  },
  suggestion: {
    padding: '10px 14px', cursor: 'pointer',
    borderBottom: `1px solid ${colors.border}`, transition: 'background 0.1s',
  },
  submitBtn: {
    background: colors.primary, color: '#fff', border: 'none',
    borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700,
    boxShadow: `0 4px 20px ${colors.primaryGlow}`,
  },
  successBanner: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.4)',
    color: '#22C55E', borderRadius: 10,
    padding: '12px 16px', fontSize: 14,
    fontWeight: 600, marginBottom: 16,
  },
  closedBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: colors.error, borderRadius: 10,
    padding: '12px 16px', fontSize: 14,
    fontWeight: 600, marginBottom: 16,
  },
  openBtn: {
    background: colors.success, color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
