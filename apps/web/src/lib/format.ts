import type { OrderStatus } from '@tesseract/shared';

export { formatNaira } from '@tesseract/shared';

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | Date | undefined, withTime = true): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(new Date(value));
}

export function formatNumber(n: number | undefined): string {
  return new Intl.NumberFormat('en-NG').format(n ?? 0);
}

export function initials(name = ''): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export function pillClass(status: OrderStatus): string {
  if (status === 'delivered') return 'pill pill--delivered';
  if (status === 'cancelled') return 'pill pill--cancelled';
  if (status === 'awaiting_payment') return 'pill pill--waiting';
  return 'pill pill--active';
}
