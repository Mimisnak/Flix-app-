import React, { useEffect, useState } from 'react';
import { colors } from '../theme';
import { Order } from '../../types';
import {
  TimelineEvent, fetchOrderTimeline, findTimelineEventTime,
  formatDurationBetween, formatOrderDateTime,
} from '../../lib/orderHelpers';

interface Props {
  order: (Order & { shop_name?: string; driver_name?: string | null }) | null;
  onClose: () => void;
}

export default function OrderDetailModalWeb({ order, onClose }: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!order) return;
    setLoading(true);
    fetchOrderTimeline(order.id).then((data) => {
      setTimeline(data);
      setLoading(false);
    });
  }, [order?.id]);

  if (!order) return null;

  const assignedAt = findTimelineEventTime(timeline, 'Πήρε');
  const deliveredAt = findTimelineEventTime(timeline, 'Παραδόθηκε');
  const duration = assignedAt && deliveredAt ? formatDurationBetween(assignedAt, deliveredAt) : null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.street}>{order.street}</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={s.meta}>
          {order.shop_name ?? '—'} &nbsp;|&nbsp; {order.driver_name ?? '—'}
        </p>
        {order.amount != null && <p style={s.amount}>{order.amount.toFixed(2)}€</p>}

        {duration && (
          <div style={s.durationBox}>Χρόνος παράδοσης: {duration}</div>
        )}

        <p style={s.sectionTitle}>Ιστορικό</p>
        {loading ? (
          <p style={{ color: colors.textSecondary, fontSize: 13 }}>Φόρτωση...</p>
        ) : timeline.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: 13 }}>Δεν υπάρχουν καταγεγραμμένα γεγονότα</p>
        ) : (
          timeline.map((t) => (
            <div key={t.id} style={s.eventRow}>
              <span style={s.eventText}>{t.event}</span>
              <span style={s.eventTime}>{formatOrderDateTime(t.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 20, padding: 24, width: 460, maxWidth: '90vw',
    maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  street: { color: colors.textPrimary, fontSize: 17, fontWeight: 700, margin: 0 },
  closeBtn: {
    background: 'transparent', border: 'none', color: colors.textSecondary,
    fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: 4,
  },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 8, marginBottom: 0 },
  amount: { color: '#22C55E', fontSize: 13, fontWeight: 700, marginTop: 4 },
  durationBox: {
    marginTop: 14, background: colors.primaryHover, borderRadius: 10,
    padding: 10, border: `1px solid ${colors.primary}`, color: colors.primary,
    fontWeight: 700, fontSize: 13,
  },
  sectionTitle: { color: colors.textPrimary, fontWeight: 700, fontSize: 14, marginTop: 18, marginBottom: 8 },
  eventRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderTop: `1px solid ${colors.border}`,
  },
  eventText: { color: colors.textPrimary, fontSize: 13 },
  eventTime: { color: colors.textSecondary, fontSize: 12 },
};
