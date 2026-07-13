/**
 * Κοινές βοηθητικές συναρτήσεις για παραγγελίες.
 * Χρησιμοποιούνται τόσο σε mobile (native) όσο και στο web dashboard.
 */
import { supabase } from './supabase';

/** Προσθέτει γεγονός στο ιστορικό παραγγελίας */
export async function addOrderTimeline(orderId: string, event: string): Promise<void> {
  await supabase.from('order_timeline').insert({ order_id: orderId, event });
}

/** Μορφοποιεί ημερομηνία + ώρα (π.χ. "03/07 14:35") από ISO string */
export function formatOrderDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface TimelineEvent {
  id: string;
  order_id: string;
  event: string;
  created_at: string;
}

/** Φέρνει το ιστορικό γεγονότων μιας παραγγελίας, από το παλιότερο στο πιο πρόσφατο. */
export async function fetchOrderTimeline(orderId: string): Promise<TimelineEvent[]> {
  const { data } = await supabase
    .from('order_timeline')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return (data as TimelineEvent[]) ?? [];
}

/** Βρίσκει το πρώτο γεγονός του timeline του οποίου το κείμενο περιέχει το `match`. */
export function findTimelineEventTime(timeline: TimelineEvent[], match: string): string | null {
  return timeline.find((t) => t.event.includes(match))?.created_at ?? null;
}

/** Μορφοποιεί διάρκεια σε λεπτά/ώρες (π.χ. "18 λεπτά" ή "1ω 12λ") ανάμεσα σε δύο ISO ώρες. */
export function formatDurationBetween(startIso: string, endIso: string): string {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return `${mins} λεπτά`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}ω` : `${h}ω ${m}λ`;
}

const EXPORT_PAGE_SIZE = 1000;

/**
 * Φέρνει ΟΛΕΣ τις γραμμές που ταιριάζουν σε ένα φίλτρο, σελιδοποιημένα.
 * Χρησιμοποιείται για εξαγωγές (CSV) όπου η οθόνη δείχνει μόνο ένα κομμάτι
 * (π.χ. τελευταίες 300) αλλά η εξαγωγή πρέπει να είναι πλήρης — αλλιώς το
 * αρχείο θα έλειπε δεδομένα χωρίς καμία προειδοποίηση στον χρήστη.
 */
export async function fetchAllPaginated<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  while (true) {
    const from = page * EXPORT_PAGE_SIZE;
    const to = from + EXPORT_PAGE_SIZE - 1;
    const { data } = await buildQuery(from, to);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < EXPORT_PAGE_SIZE) break;
    page++;
  }
  return all;
}
