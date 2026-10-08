// Decides who hears about what. Called after an order changes; never throws.
import { config } from '../../config.js';
import { Order, type OrderDocument } from '../../models/Order.js';
import { Organization } from '../../models/Organization.js';
import { decryptBuffer, encryptBuffer } from '../crypto.js';
import { sendEmail } from './mailer.js';
import { templates, type ConsultationEmailData, type OrderEmailData } from './templates.js';

/** Encrypts the customer's tracking token so later emails can include their private link. */
export function sealToken(token: string): string {
  const { iv, authTag, ciphertext } = encryptBuffer(Buffer.from(token, 'utf8'), config.fileKey);
  return [iv, authTag, ciphertext].map((b) => b.toString('base64url')).join('.');
}

function openToken(sealed: string | undefined): string | null {
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
    channel: order.channel,
    pages: order.options.pages,
    copies: order.options.copies,
    colour: order.options.colour,
    sides: order.options.sides,
    paperSize: order.options.paperSize,
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
