const STATUS_LABELS: Record<string, string> = {
  pending: 'Αναμονή',
  assigned: 'Σε διαδρομή',
  delivered: 'Παραδόθηκε',
  cancelled: 'Ακυρώθηκε',
};

const CSV_BOM = String.fromCharCode(0xfeff);

interface CsvOrder {
  created_at: string;
  street: string;
  customer_name?: string | null;
  phone?: string | null;
  amount?: number | null;
  status: string;
  cancel_reason?: string | null;
  shop_name?: string | null;
  driver_name?: string | null;
}

function escapeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV string (UTF-8 BOM so Greek text renders correctly in Excel). */
export function ordersToCsv(orders: CsvOrder[]): string {
  const headers = [
    'Ημερομηνία', 'Ώρα', 'Κατάστημα', 'Διεύθυνση', 'Πελάτης',
    'Τηλέφωνο', 'Ποσό', 'Οδηγός', 'Κατάσταση', 'Αιτία Ακύρωσης',
  ];

  const rows = orders.map((o) => {
    const d = new Date(o.created_at);
    return [
      d.toLocaleDateString('el-GR'),
      d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
      o.shop_name ?? '',
      o.street,
      o.customer_name ?? '',
      o.phone ?? '',
      o.amount != null ? o.amount.toFixed(2) : '',
      o.driver_name ?? '',
      STATUS_LABELS[o.status] ?? o.status,
      o.cancel_reason ?? '',
    ].map(escapeCsvCell).join(',');
  });

  return CSV_BOM + [headers.join(','), ...rows].join('\n');
}
