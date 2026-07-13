import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sendPushToOnlineDrivers } from '../../../lib/notifications';
import { colors } from '../../theme';
import { Customer } from '../../../types';

const OPEN_ORDER_STREET = 'Ανοιχτή Παραγγελία';

interface ShopOption { id: string; name: string; }

export default function OwnerNewOrderWeb() {
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopId, setShopId] = useState('');
  const [isOpenOrder, setIsOpenOrder] = useState(false);
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchShops(); }, []);

  async function fetchShops() {
    const { data } = await supabase
      .from('users')
      .select('id, shops(name)')
      .eq('role', 'shop')
      .eq('active', true);

    if (data) {
      const options = data
        .map((u: any) => ({ id: u.id, name: u.shops?.name ?? 'Άγνωστο' }))
        .sort((a: ShopOption, b: ShopOption) => a.name.localeCompare(b.name));
      setShops(options);
    }
  }

  async function doSearchCustomer(phoneInput: string) {
    if (!shopId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
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
    if (!shopId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
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

  async function saveCustomer() {
    if (!phone || !shopId) return;
    const { data: existing } = await supabase
      .from('customers').select('id').eq('shop_id', shopId).eq('phone', phone).single();
    if (existing) {
      await supabase.from('customers')
        .update({ name: customerName || null, address: street, bell: bell || null, floor: floor || null })
        .eq('id', existing.id);
    } else {
      await supabase.from('customers')
        .insert({ shop_id: shopId, phone, name: customerName || null, address: street, bell: bell || null, floor: floor || null });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) { window.alert('Επίλεξε για ποιο μαγαζί είναι η παραγγελία.'); return; }
    if (!isOpenOrder && !street.trim()) return;
    setLoading(true);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    const { data: order, error } = await supabase.from('orders').insert({
      shop_id: shopId,
      street: isOpenOrder ? OPEN_ORDER_STREET : street.trim(),
      phone: isOpenOrder ? null : (phone.trim() || null),
      customer_name: isOpenOrder ? null : (customerName.trim() || null),
      bell: isOpenOrder ? null : (bell.trim() || null),
      floor: isOpenOrder ? null : (floor.trim() || null),
      notes: notes.trim() || null,
      amount: isNaN(parsedAmount) ? null : parsedAmount,
      status: 'pending',
      created_by_owner: true,
      is_open_order: isOpenOrder,
    }).select().single();

    if (error) { window.alert(error.message); setLoading(false); return; }

    await supabase.from('order_timeline').insert({
      order_id: order.id,
      event: '🟡 Βγήκε παραγγελία (καταχωρήθηκε από τον διαχειριστή)',
    });
    if (!isOpenOrder) await saveCustomer();
    const shopName = shops.find(s => s.id === shopId)?.name ?? '';
    sendPushToOnlineDrivers('🔔 Νέα παραγγελία!', isOpenOrder ? `🏬 ${shopName}` : `📍 ${street.trim()}`);

    setPhone(''); setCustomerName(''); setStreet(''); setBell(''); setFloor(''); setNotes(''); setAmount('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 580 }}>
      {success && (
        <div style={s.successBanner}>
          ✅ Η παραγγελία καταχωρήθηκε! Οι online οδηγοί ειδοποιήθηκαν.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div>
          <label style={s.label}>
            Μαγαζί <span style={{ color: colors.error }}>*</span>
          </label>
          <select
            style={s.input}
            value={shopId}
            onChange={e => setShopId(e.target.value)}
            required
          >
            <option value="" disabled>Επιλογή μαγαζιού...</option>
            {shops.map(sh => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
          </select>
        </div>

        <label style={s.openOrderRow}>
          <div style={{ flex: 1 }}>
            <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700 }}>Ανοιχτή Παραγγελία</div>
            <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
              Χωρίς διεύθυνση/τηλέφωνο/όνομα — μόνο το μαγαζί. Χρήσιμο όταν ξέρετε ήδη πού πάει.
            </div>
          </div>
          <input
            type="checkbox"
            checked={isOpenOrder}
            onChange={e => setIsOpenOrder(e.target.checked)}
            style={{ width: 20, height: 20, cursor: 'pointer' }}
          />
        </label>

        {!isOpenOrder && (
          <>
            <div style={{ position: 'relative' }}>
              <label style={s.label}>Τηλέφωνο</label>
              <input
                style={s.input}
                type="tel"
                placeholder="π.χ. 6941234567"
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

            <div>
              <label style={s.label}>Όνομα Παραλήπτη</label>
              <input
                style={s.input}
                placeholder="Προαιρετικό"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>

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
          </>
        )}

        <div>
          <label style={s.label}>Ποσό (€)</label>
          <input style={s.input} placeholder="π.χ. 12.50" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

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
          disabled={loading || !shopId || (!isOpenOrder && !street.trim())}
          style={{
            ...s.submitBtn,
            opacity: loading || !shopId || (!isOpenOrder && !street.trim()) ? 0.55 : 1,
            cursor: loading || !shopId || (!isOpenOrder && !street.trim()) ? 'not-allowed' : 'pointer',
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
  openOrderRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
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
};
