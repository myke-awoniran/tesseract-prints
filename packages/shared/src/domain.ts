// Domain rules shared by the API and the web app.
// Anything both sides must agree on (zones, statuses, file limits, pricing) lives here.

/** Uploaded files are erased automatically by MongoDB's TTL monitor after this many seconds. */
export const FILE_TTL_SECONDS = 24 * 60 * 60;

export const MAX_FILE_MB = 50;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const ACCEPTED_FILE_TYPES: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG'
};
export const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

export function isAcceptedFileType(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACCEPTED_FILE_TYPES, mime);
}

/* ─────────── Delivery zones ─────────── */

export type ZoneId = 'central' | 'inner' | 'outer';

export interface Zone {
  id: ZoneId;
  name: string;
  eta: string;
  areas: readonly string[];
}

export const ZONES: readonly Zone[] = [
  {
    id: 'central',
    name: 'Central districts',
    eta: 'Same day',
    areas: ['Maitama', 'Asokoro', 'Wuse', 'Wuse II', 'Garki', 'Central Business District', 'Jabi', 'Utako', 'Wuye']
  },
  {
    id: 'inner',
    name: 'Inner districts',
    eta: 'Same day or next morning',
    areas: ['Gwarinpa', 'Katampe', 'Life Camp', 'Kado', 'Guzape', 'Apo', 'Lokogoma', 'Durumi', 'Jahi', 'Mabushi']
  },
  {
    id: 'outer',
    name: 'Satellite towns',
    eta: 'Next scheduled delivery day',
    areas: ['Kubwa', 'Lugbe', 'Karu', 'Nyanya', 'Bwari', 'Kuje', 'Gwagwalada']
  }
];

export const ALL_AREAS: readonly string[] = ZONES.flatMap((z) => z.areas);

export function zoneForArea(area: string): Zone | null {
  return ZONES.find((z) => z.areas.includes(area)) ?? null;
}

/* ─────────── Print options ─────────── */

export type Colour = 'mono' | 'colour';
export type Sides = 'single' | 'double';

export const PAPER_SIZES = ['A4', 'A3', 'Letter'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const FINISHING = [
  { id: 'none', label: 'No finishing' },
  { id: 'stapled', label: 'Stapled' },
  { id: 'spiral', label: 'Spiral bound' },
  { id: 'comb', label: 'Comb bound' },
  { id: 'hardbound', label: 'Hard bound' }
] as const;
export type FinishingId = (typeof FINISHING)[number]['id'];
export const FINISHING_IDS: readonly FinishingId[] = FINISHING.map((f) => f.id);

export function finishingLabel(id: string): string {
  return FINISHING.find((f) => f.id === id)?.label ?? id;
}

export interface PrintOptions {
  colour: Colour;
  sides: Sides;
  paperSize: PaperSize;
  finishing: FinishingId;
  copies: number;
  pages: number;
}

/* ─────────── Order lifecycle ─────────── */

export const ORDER_STATUSES = [
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'queued', label: 'Received' },
  { id: 'printing', label: 'Printing' },
  { id: 'sealed', label: 'Sealed' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' }
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]['id'];
export const ORDER_STATUS_IDS: readonly OrderStatus[] = ORDER_STATUSES.map((s) => s.id);

/** The forward path an order moves along once it is paid for or invoiced. */
export const FULFILMENT_FLOW: readonly OrderStatus[] = ['queued', 'printing', 'sealed', 'out_for_delivery', 'delivered'];
export const IN_PROGRESS_STATUSES: readonly OrderStatus[] = ['queued', 'printing', 'sealed', 'out_for_delivery'];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUS_IDS as readonly string[]).includes(value);
}

export function statusLabel(id: string): string {
  return ORDER_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export type OrderChannel = 'express' | 'enterprise';
export type PaymentStatus = 'pending' | 'paid' | 'invoiced' | 'failed';

export const ROLES = ['owner', 'admin', 'member', 'operator'] as const;
export type Role = (typeof ROLES)[number];
export const CLIENT_ROLES: readonly Role[] = ['owner', 'admin', 'member'];

/* ─────────── Pricing ─────────── */

export interface Quote {
  currency: 'NGN';
  printing: number;
  finishing: number;
  delivery: number;
  sealing: number;
  /** Added when the order comes to less than the minimum order value. */
  minimumTopUp: number;
  total: number;
  sheets: number;
}

/**
 * Express pricing, in kobo (₦1 = 100 kobo).
 * EXAMPLE VALUES ONLY — set these to your real rates before launch.
 * Prices are never shown on the marketing pages; they appear only at express checkout.
 */
export const PRICING = {
  currency: 'NGN',
  perSideKobo: { mono: 10_000, colour: 30_000 } satisfies Record<Colour, number>,
  finishingPerCopyKobo: { none: 0, stapled: 20_000, spiral: 150_000, comb: 120_000, hardbound: 500_000 } satisfies Record<FinishingId, number>,
  paperMultiplier: { A4: 1, Letter: 1, A3: 2 } satisfies Record<PaperSize, number>,
  deliveryKobo: { central: 300_000, inner: 450_000, outer: 700_000 } satisfies Record<ZoneId, number>,
  sealingKobo: 50_000,
  /** Every order costs at least this much, delivery included (₦5,000). */
  minimumOrderKobo: 500_000
} as const;

export function computeQuote(input: PrintOptions & { zone: ZoneId }): Quote {
  const { pages, copies, colour, sides, finishing, paperSize, zone } = input;
  const printing = Math.round(pages * copies * PRICING.perSideKobo[colour] * PRICING.paperMultiplier[paperSize]);
  const finishingTotal = PRICING.finishingPerCopyKobo[finishing] * copies;
  const delivery = PRICING.deliveryKobo[zone];
  const sealing = PRICING.sealingKobo;
  const sheetsPerCopy = sides === 'double' ? Math.ceil(pages / 2) : pages;
  const subtotal = printing + finishingTotal + delivery + sealing;
  const minimumTopUp = Math.max(0, PRICING.minimumOrderKobo - subtotal);
  return {
    currency: 'NGN',
    printing,
    finishing: finishingTotal,
    delivery,
    sealing,
    minimumTopUp,
    total: subtotal + minimumTopUp,
    sheets: sheetsPerCopy * copies
  };
}

export function formatNaira(kobo: number | null | undefined): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Math.round(Number(kobo ?? 0) / 100)
  );
}

export const DOCUMENT_TYPES = [
  'Bids & tenders',
  'Legal bundles & filings',
  'Board & investor papers',
  'Diplomatic documentation',
  'Regulatory & annual reports',
  'Other'
] as const;
