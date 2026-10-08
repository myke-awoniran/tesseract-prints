// Decides who hears about what. Called after an order or invoice changes; never throws.
import { periodLabel } from '@tesseract/shared';
import { config } from '../../config.js';
import { Order, type OrderDocument } from '../../models/Order.js';
import { Organization } from '../../models/Organization.js';
import { Invoice, type InvoiceDocument } from '../../models/Invoice.js';
import { decryptBuffer, encryptBuffer } from '../crypto.js';
import { sendEmail } from './mailer.js';
import { templates, type ConsultationEmailData, type InvoiceEmailData, type OrderEmailData } from './templates.js';

/** Encrypts the customer's tracking token so later emails can include their private link. */
export function sealToken(token: string): string {
  const { iv, authTag, ciphertext } = encryptBuffer(Buffer.from(token, 'utf8'), config.fileKey);
  return [iv, authTag, ciphertext].map((b) => b.toString('base64url')).join('.');
}

export function openToken(sealed: string | undefined): string | null {
  if (!sealed) return null;
  try {
    const [iv, authTag, ciphertext] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
    return decryptBuffer({ iv, authTag, ciphertext }, config.fileKey).toString('utf8');
  } catch {
    return null;
  }
}

/** Reloads the order with the private fields the emails need. */
async function withSecrets(order: OrderDocument): Promise<OrderDocument> {
  return (await Order.findById(order._id).select('+handoverCode +accessTokenEnc')) ?? order;
}

function trackUrl(order: OrderDocument): string {
  if (order.channel === 'enterprise') return `${config.webUrl}/console/orders/${order.ref}`;
  const token = openToken(order.accessTokenEnc);
  return token ? `${config.webUrl}/track/${order.ref}?t=${encodeURIComponent(token)}` : `${config.webUrl}/express`;
}

function toEmailData(order: OrderDocument): OrderEmailData {
  return {
    ref: order.ref,
    title: order.title,
    customerName: order.customer.name,
    recipientName: order.delivery.recipientName,
    area: order.delivery.area,
    address: order.delivery.address,
    recipientPhone: order.delivery.phone || undefined,
    directions: order.delivery.instructions || undefined,
    channel: order.channel,
    pages: order.options.pages,
    copies: order.options.copies,
    colour: order.options.colour,
    sides: order.options.sides,
    paperSize: order.options.paperSize,
    paperType: order.options.paperType ?? 'standard',
    finishing: order.options.finishing,
    quote: { ...order.quote, minimumTopUp: order.quote.minimumTopUp ?? 0 },
    paid: order.payment.status === 'paid',
    handoverCode: order.status === 'delivered' || order.status === 'cancelled' ? undefined : order.handoverCode,
    trackUrl: trackUrl(order),
    rider: order.dispatch ? { name: order.dispatch.riderName, phone: order.dispatch.riderPhone, eta: order.dispatch.eta } : undefined
  };
}

/** Account orders respect the organisation's notification settings. */
async function orgAllows(order: OrderDocument, pref: 'notifyOnDispatch' | 'notifyOnDelivery'): Promise<boolean> {
  if (order.channel !== 'enterprise' || !order.organization) return true;
  const org = await Organization.findById(order.organization).select('preferences');
  return org?.preferences?.[pref] ?? true;
}

const ref = (o: OrderDocument) => ({ _id: o._id, ref: o.ref });

async function safely(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.warn('notification failed', (err as Error).message);
  }
}

/** The order is paid (express) or placed (account): confirm to the customer and alert the print room. */
export function notifyOrderConfirmed(order: OrderDocument): Promise<void> {
  return safely(async () => {
    const o = await withSecrets(order);
    const data = toEmailData(o);
    await sendEmail({ to: o.customer.email, template: 'order_confirmed', email: templates.order_confirmed(data), order: ref(o) });
    if (config.email.opsAddress) {
      await sendEmail({
        to: config.email.opsAddress,
        template: 'ops_new_order',
        email: templates.ops_new_order({ ...data, consoleUrl: `${config.webUrl}/console/ops/orders/${o.ref}` }),
        order: ref(o)
      });
    }
  });
}

export function notifyStatusChanged(order: OrderDocument, reason = ''): Promise<void> {
  return safely(async () => {
    const o = await withSecrets(order);
    if (o.status === 'out_for_delivery' && (await orgAllows(o, 'notifyOnDispatch'))) {
      await sendEmail({ to: o.customer.email, template: 'out_for_delivery', email: templates.out_for_delivery(toEmailData(o)), order: ref(o) });
    } else if (o.status === 'delivered' && (await orgAllows(o, 'notifyOnDelivery'))) {
      await sendEmail({
        to: o.customer.email,
        template: 'delivered',
        email: templates.delivered({ ...toEmailData(o), deliveredAt: o.deliveredAt ?? new Date() }),
        order: ref(o)
      });
    } else if (o.status === 'cancelled') {
      await sendEmail({ to: o.customer.email, template: 'cancelled', email: templates.cancelled({ ...toEmailData(o), reason }), order: ref(o) });
    }
  });
}

export function notifyDeliveryUpdate(order: OrderDocument, message: string): Promise<void> {
  return safely(async () => {
    const o = await withSecrets(order);
    await sendEmail({ to: o.customer.email, template: 'delivery_update', email: templates.delivery_update({ ...toEmailData(o), message }), order: ref(o) });
  });
}

export function notifyConsultation(c: Omit<ConsultationEmailData, 'webUrl'>): Promise<void> {
  return safely(async () => {
    const data = { ...c, webUrl: config.webUrl };
    await sendEmail({ to: c.email, template: 'consultation_received', email: templates.consultation_received(data) });
    if (config.email.opsAddress) {
      await sendEmail({ to: config.email.opsAddress, template: 'ops_consultation', email: templates.ops_consultation(data) });
    }
  });
}

/* ─────────── Invoices ─────────── */

const METHOD_LABEL: Record<string, string> = { bank_transfer: 'bank transfer', other: 'direct payment' };

function invoiceEmailData(invoice: InvoiceDocument, payUrl: string): InvoiceEmailData {
  return {
    number: invoice.number,
    organizationName: invoice.organizationName,
    periodLabel: periodLabel(invoice.period.year, invoice.period.month),
    total: invoice.total,
    orders: invoice.lines.length,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    payUrl,
    bankDetails: config.billing.bankDetails,
    lines: invoice.lines.map((l) => ({ ref: l.ref, title: l.title, total: l.total })),
    paidAt: invoice.paidAt,
    methodLabel: invoice.payment.method === 'online' ? undefined : METHOD_LABEL[invoice.payment.method ?? '']
  };
}

/** The private invoice link, or the console's billing page if the token can't be recovered. */
async function invoiceLink(invoice: InvoiceDocument, token?: string): Promise<string> {
  const open = token ?? openToken((await Invoice.findById(invoice._id).select('+accessTokenEnc'))?.accessTokenEnc);
  return open ? `${config.webUrl}/invoice/${invoice.number}?t=${encodeURIComponent(open)}` : `${config.webUrl}/console/billing/${invoice.number}`;
}

async function sendInvoiceEmail(template: 'invoice_issued' | 'invoice_reminder' | 'invoice_paid', invoice: InvoiceDocument, recipients: string[], token?: string) {
  if (!recipients.length) {
    console.warn(`invoice ${invoice.number}: no billing email or owner to send ${template} to`);
    return;
  }
  const data = invoiceEmailData(invoice, await invoiceLink(invoice, token));
  for (const to of recipients) await sendEmail({ to, template, email: templates[template](data) });
  if (template === 'invoice_issued') await Invoice.updateOne({ _id: invoice._id }, { $set: { emailedAt: new Date() } });
}

export function notifyInvoiceIssued(invoice: InvoiceDocument, token: string, recipients: string[]): Promise<void> {
  return safely(() => sendInvoiceEmail('invoice_issued', invoice, recipients, token));
}

export function notifyInvoiceReminder(invoice: InvoiceDocument, recipients: string[]): Promise<void> {
  return safely(() => sendInvoiceEmail('invoice_reminder', invoice, recipients));
}

export function notifyInvoicePaid(invoice: InvoiceDocument, recipients: string[]): Promise<void> {
  return safely(() => sendInvoiceEmail('invoice_paid', invoice, recipients));
}

/** Sends the invoice again, e.g. after the billing email changes. */
export function resendInvoice(invoice: InvoiceDocument, recipients: string[], token?: string): Promise<void> {
  return safely(() => sendInvoiceEmail(invoice.status === 'paid' ? 'invoice_paid' : 'invoice_issued', invoice, recipients, token));
}
