import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { INVOICE_DUE_DAYS, periodLabel, type InvoicePaymentMethod, type InvoiceView, type PayResponse } from '@tesseract/shared';
import { config, paymentsAreMocked } from '../config.js';
import { Invoice, type InvoiceDocument } from '../models/Invoice.js';
import { Order } from '../models/Order.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { randomToken, safeEqual, sha256 } from './crypto.js';
import { conflict } from './errors.js';
import { DAY, lagosPeriod, periodBounds, periodKey, shiftPeriod, type Period } from './time.js';
import { activeGateway, gatewayLabel, invoiceCharge } from './payments/index.js';
import { notifyInvoiceIssued, notifyInvoicePaid, notifyInvoiceReminder, sealToken } from './email/notify.js';

const NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function invoiceNumber({ year, month }: Period): string {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) suffix += NUMBER_ALPHABET[crypto.randomInt(NUMBER_ALPHABET.length)];
  return `INV-${year}${String(month).padStart(2, '0')}-${suffix}`;
}

/** The month just finished, which is the one billed now. */
export function billablePeriod(now = new Date()): Period {
  return shiftPeriod(lagosPeriod(now), -1);
}

export function periodView(p: Period): { year: number; month: number; label: string } {
  return { ...p, label: periodLabel(p.year, p.month) };
}

/** Orders before BILLING_START were settled outside the app and are never invoiced. */
function billingStartsAt(): Date {
  return periodBounds(config.billing.startMonth).start;
}

/** Account orders that are billable and not yet on an invoice, placed before `before`. */
function unbilledFilter(before: Date, organization?: string) {
  return {
    channel: 'enterprise' as const,
    ...(organization ? { organization } : { organization: { $ne: null } }),
    invoice: null,
    'payment.status': 'invoiced',
    status: { $ne: 'cancelled' as const },
    createdAt: { $gte: billingStartsAt(), $lt: before }
  };
}

/** Where invoices go: the organisation's billing email, or its owners if none is set. */
async function billingRecipients(organization: string, billingEmail: string): Promise<string[]> {
  if (billingEmail) return [billingEmail];
  const owners = await User.find({ organization, role: 'owner', active: true }).select('email');
  return owners.map((u) => u.email).filter(Boolean);
}

export function invoiceUrl(invoice: InvoiceDocument, token: string): string {
  return `${config.webUrl}/invoice/${invoice.number}?t=${encodeURIComponent(token)}`;
}

/**
 * Issues one invoice per organisation for the month's unbilled orders, and emails it.
 * Safe to run any number of times: a month is billed once per organisation.
 */
export async function generateInvoices(period: Period, log?: FastifyBaseLogger): Promise<number> {
  const { start, end } = periodBounds(period);
  if (end <= billingStartsAt()) return 0;

  const organizations = (await Order.distinct('organization', unbilledFilter(end))) as string[];
  let created = 0;
  for (const organization of organizations) {
    const key = `${organization}:${periodKey(period)}`;
    if (await Invoice.exists({ periodKey: key })) continue;

    const org = await Organization.findById(organization);
    if (!org) continue;
    const orders = await Order.find(unbilledFilter(end, organization)).sort({ createdAt: 1 });
    if (!orders.length) continue;

    const recipients = await billingRecipients(organization, org.billingEmail ?? '');
    const token = randomToken();
    const issuedAt = new Date();
    let invoice: InvoiceDocument;
    try {
      invoice = await Invoice.create({
        number: invoiceNumber(period),
        organization,
        organizationName: org.name,
        periodKey: key,
        period,
        periodStart: start,
        periodEnd: end,
        lines: orders.map((o) => ({ order: o._id, ref: o.ref, title: o.title, placedBy: o.customer.name, createdAt: o.createdAt, total: o.quote.total })),
        total: orders.reduce((sum, o) => sum + o.quote.total, 0),
        billingEmail: recipients[0] ?? '',
        issuedAt,
        dueAt: new Date(issuedAt.getTime() + INVOICE_DUE_DAYS * DAY),
        accessTokenHash: sha256(token),
        accessTokenEnc: sealToken(token)
      });
    } catch (err) {
      // Another run billed this organisation for the month first.
      if ((err as { code?: number }).code === 11000) continue;
      throw err;
    }
    await Order.updateMany({ _id: { $in: orders.map((o) => o._id) }, invoice: null }, { $set: { invoice: invoice._id } });
    created += 1;
    log?.info({ number: invoice.number, organization: org.name, total: invoice.total }, 'invoice issued');
    void notifyInvoiceIssued(invoice, token, recipients);
  }
  return created;
}

/** Emails one reminder for each open invoice once it passes its due date. */
export async function sendOverdueReminders(): Promise<number> {
  const due = await Invoice.find({ status: 'open', dueAt: { $lt: new Date() }, remindedAt: null }).select('+accessTokenEnc');
  for (const invoice of due) {
    const claimed = await Invoice.updateOne({ _id: invoice._id, remindedAt: null }, { $set: { remindedAt: new Date() } });
    if (claimed.modifiedCount !== 1) continue;
    void notifyInvoiceReminder(invoice, await billingRecipients(invoice.organization, invoice.billingEmail));
  }
  return due.length;
}

let running = false;

/** Bills the month just finished and chases overdue invoices. Runs hourly; only the 1st usually finds work. */
export async function runBillingCycle(log: FastifyBaseLogger): Promise<void> {
  if (running) return;
  running = true;
  try {
    const created = await generateInvoices(billablePeriod(), log);
    const reminded = await sendOverdueReminders();
    if (created || reminded) log.info({ created, reminded }, 'billing cycle');
  } catch (err) {
    log.error({ err }, 'billing cycle failed');
  } finally {
    running = false;
  }
}

export function startBillingScheduler(log: FastifyBaseLogger): () => void {
  const first = setTimeout(() => void runBillingCycle(log), 15_000);
  const hourly = setInterval(() => void runBillingCycle(log), 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(hourly);
  };
}

/** Marks an invoice paid exactly once, however many confirmations arrive. */
export async function markInvoicePaid(
  invoiceId: string,
  payment: { method: InvoicePaymentMethod; provider?: string | null; reference?: string | null; checkoutId?: string | null; note?: string; recordedBy?: string }
): Promise<boolean> {
  const set: Record<string, unknown> = { status: 'paid', paidAt: new Date(), 'payment.method': payment.method };
  if (payment.provider !== undefined) set['payment.provider'] = payment.provider;
  if (payment.reference) set['payment.reference'] = payment.reference;
  if (payment.checkoutId) set['payment.checkoutId'] = payment.checkoutId;
  if (payment.note) set['payment.note'] = payment.note;
  if (payment.recordedBy) set['payment.recordedBy'] = payment.recordedBy;

  const result = await Invoice.updateOne({ _id: invoiceId, status: 'open' }, { $set: set });
  if (result.modifiedCount !== 1) return false;
  const invoice = await Invoice.findById(invoiceId);
  if (invoice) void notifyInvoicePaid(invoice, await billingRecipients(invoice.organization, invoice.billingEmail));
  return true;
}

/** Voids an invoice and releases its orders, so the month can be billed again. */
export async function voidInvoice(invoice: InvoiceDocument, reason: string): Promise<void> {
  if (invoice.status !== 'open') throw conflict(invoice.status === 'paid' ? 'A paid invoice cannot be voided.' : 'This invoice is already void.');
  const result = await Invoice.updateOne(
    { _id: invoice._id, status: 'open' },
    { $set: { status: 'void', voidedAt: new Date(), voidReason: reason, periodKey: `${invoice.periodKey}:void:${invoice._id}` } }
  );
  if (result.modifiedCount !== 1) throw conflict('This invoice changed while you were working on it. Reload and try again.');
  await Order.updateMany({ invoice: invoice._id }, { $set: { invoice: null } });
}

/** Sends the customer to the active gateway to pay an open invoice. */
export async function startInvoiceCheckout(invoice: InvoiceDocument, cancelUrl: string, payerEmail?: string): Promise<PayResponse> {
  if (invoice.status === 'paid') throw conflict('This invoice has already been paid.');
  if (invoice.status === 'void') throw conflict('This invoice was voided and cannot be paid.');
  // An organisation with no billing email or owner: the receipt goes to whoever pays.
  if (!invoice.billingEmail && payerEmail) invoice.billingEmail = payerEmail;

  const reference = `${invoice.number}-${Date.now().toString(36).toUpperCase()}`;
  const returnUrl = `${config.webUrl}/pay/return`;

  if (paymentsAreMocked) {
    invoice.payment.reference = reference;
    invoice.payment.provider = 'mock';
    await invoice.save();
    return { authorizationUrl: `${returnUrl}?reference=${encodeURIComponent(reference)}&mock=1`, reference, mock: true };
  }

  const checkout = await activeGateway.startCheckout(invoiceCharge(invoice), { reference, returnUrl, cancelUrl });
  invoice.payment.reference = reference;
  invoice.payment.provider = activeGateway.id;
  invoice.payment.checkoutId = checkout.checkoutId;
  await invoice.save();
  return { authorizationUrl: checkout.url, reference, mock: false };
}

export async function findInvoiceByToken(number: string, token: string): Promise<InvoiceDocument | null> {
  if (!number || !token) return null;
  const invoice = await Invoice.findOne({ number: number.toUpperCase() }).select('+accessTokenHash');
  if (!invoice || !safeEqual(invoice.accessTokenHash, sha256(token))) return null;
  return invoice;
}

export function serializeInvoice(invoice: InvoiceDocument): InvoiceView {
  return {
    number: invoice.number,
    organization: { id: invoice.organization, name: invoice.organizationName },
    period: periodView(invoice.period),
    status: invoice.status,
    overdue: invoice.status === 'open' && invoice.dueAt < new Date(),
    total: invoice.total,
    currency: 'NGN',
    billingEmail: invoice.billingEmail,
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: invoice.dueAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString(),
    voidedAt: invoice.voidedAt?.toISOString(),
    voidReason: invoice.voidReason || undefined,
    payment: {
      method: invoice.payment.method ?? undefined,
      provider: gatewayLabel(invoice.payment.provider) ?? undefined,
      note: invoice.payment.note || undefined
    },
    lines: invoice.lines.map((l) => ({ ref: l.ref, title: l.title, placedBy: l.placedBy, createdAt: l.createdAt.toISOString(), total: l.total }))
  };
}

/** What has been ordered so far this month, to show on the next invoice. */
export async function upcomingInvoice(organization: string, now = new Date()) {
  const period = lagosPeriod(now);
  const [row] = await Order.aggregate<{ orders: number; total: number }>([
    { $match: unbilledFilter(periodBounds(period).end, organization) },
    { $group: { _id: null, orders: { $sum: 1 }, total: { $sum: '$quote.total' } } }
  ]);
  return { period: periodView(period), orders: row?.orders ?? 0, total: row?.total ?? 0 };
}
