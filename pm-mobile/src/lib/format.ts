// Date/number formatting. All times are shown in WIB (Asia/Jakarta, UTC+7, no DST)
// regardless of the device timezone, matching the server and the printed form.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

function toWib(input: string | Date): Date | null {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** "05 Okt 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = toWib(iso);
  if (!d) return '-';
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "05 Okt 2026 08:15" */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = toWib(iso);
  if (!d) return '-';
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}`;
}

/** Serialises an instant as ISO-8601 with the +07:00 offset required by the API. */
export function toApiDateTime(date: Date): string {
  const d = new Date(date.getTime() + WIB_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}:00+07:00`;
}

/** Minutes between two instants (floored, never negative). */
export function minutesBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const diff = Math.floor((end.getTime() - start.getTime()) / 60000);
  return diff >= 0 ? diff : null;
}

/** 95 → "1 jam 35 menit" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '-';
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} menit`;
  if (rest === 0) return `${h} jam`;
  return `${h} jam ${rest} menit`;
}

/** Relative time for notification lists ("5 menit lalu"), falls back to a date. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatDateTime(iso);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Parses a user-typed decimal that may use a comma ("1,5"). */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Converts a WO number to a safe file name: "WO/IT/X/2026/0001" → "WO-IT-X-2026-0001". */
export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** 1500000 → "Rp 1.500.000" */
export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '-';
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}Rp ${grouped}${dec && dec !== '00' ? `,${dec}` : ''}`;
}

/** Keeps digits only ("1.500.000" → "1500000"). */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/** "1500000" → "1.500.000" (no Intl dependency). */
export function groupThousands(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
