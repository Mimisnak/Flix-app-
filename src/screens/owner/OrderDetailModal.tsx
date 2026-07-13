import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Order } from '../../types';
import { Colors } from '../../constants/colors';
import {
  TimelineEvent, fetchOrderTimeline, findTimelineEventTime,
  formatDurationBetween, formatOrderDateTime,
} from '../../lib/orderHelpers';

interface Props {
  order: Order | null;
  onClose: () => void;
}

export default function OrderDetailModal({ order, onClose }: Props) {
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.street}>{order.street}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.meta}>
            🏬 {(order as any).shops?.name ?? '—'}  |  🛵 {(order as any).drivers?.name ?? '—'}
          </Text>
          {order.amount != null && <Text style={styles.amount}>💵 {order.amount.toFixed(2)}€</Text>}

          {duration && (
            <View style={styles.durationBox}>
              <Text style={styles.durationText}>⏱ Χρόνος παράδοσης: {duration}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Ιστορικό</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
          ) : timeline.length === 0 ? (
            <Text style={styles.empty}>Δεν υπάρχουν καταγεγραμμένα γεγονότα</Text>
          ) : (
            timeline.map((t) => (
              <View key={t.id} style={styles.eventRow}>
                <Text style={styles.eventText}>{t.event}</Text>
                <Text style={styles.eventTime}>{formatOrderDateTime(t.created_at)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    width: '88%', maxHeight: '80%', borderWidth: 1, borderColor: Colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  street: { fontSize: 17, fontWeight: 'bold', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  closeBtn: { padding: 4 },
  closeText: { color: Colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
  amount: { color: Colors.success, fontSize: 13, fontWeight: '700', marginTop: 4 },
  durationBox: {
    marginTop: 14, backgroundColor: Colors.primaryHover, borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: Colors.primary,
  },
  durationText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 14, marginTop: 18, marginBottom: 8 },
  empty: { color: Colors.textSecondary, fontSize: 13 },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  eventText: { color: Colors.textPrimary, fontSize: 13, flex: 1, marginRight: 8 },
  eventTime: { color: Colors.textSecondary, fontSize: 12 },
});
