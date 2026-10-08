import type { FastifyInstance } from 'fastify';
import type { VerifyPaymentResponse } from '@tesseract/shared';
import { config, paymentsAreMocked } from '../config.js';
import { Order } from '../models/Order.js';
import { Invoice } from '../models/Invoice.js';
import { markPaid } from '../lib/orders.js';
import { markInvoicePaid } from '../lib/invoices.js';
import { attemptOf, gatewayForOrder, invoiceCharge, orderCharge } from '../lib/payments/index.js';
import {
  evaluateSession,
  getCheckoutSession,
  isValidWebhookSignature as isValidBachsSignature,
  type BachsCheckoutSession,
  type BachsEvent
} from '../lib/payments/bachs.js';
import { amountMatches, isValidWebhookSignature as isValidPaystackSignature, type PaystackTransaction } from '../lib/payments/paystack.js';
import { badRequest, notFound } from '../lib/errors.js';

interface PaystackWebhookBody {
  event?: string;
  data?: PaystackTransaction;
}

const BACHS_PAID_EVENTS = new Set(['collection.succeeded', 'checkout.completed']);

/**
 * Confirms a Bachs checkout from the session itself. The session names what it paid for in metadata,
 * so a checkout opened before a later retry still counts.
 */
async function confirmBachsSession(session: BachsCheckoutSession): Promise<VerifyPaymentResponse | null> {
  const meta = session.metadata ?? {};

  if (typeof meta.invoice_number === 'string') {
    const invoice = await Invoice.findOne({ number: meta.invoice_number });
    if (!invoice) return null;
    if (invoice.status === 'paid') return { ref: invoice.number, kind: 'invoice', paid: true };
    const check = evaluateSession(invoiceCharge(invoice), session);
    if (check.paid) {
      await markInvoicePaid(invoice._id, { method: 'online', provider: 'bachs', reference: session.reference, checkoutId: session.checkout_id });
    }
    return { ref: invoice.number, kind: 'invoice', paid: check.paid, gatewayStatus: check.paid ? undefined : check.status };
  }

  const ref = typeof meta.order_ref === 'string' ? meta.order_ref : null;
  const order = ref ? await Order.findOne({ ref }) : await Order.findOne({ 'payment.checkoutId': session.checkout_id });
  if (!order) return null;
  if (order.payment.status === 'paid') return { ref: order.ref, kind: 'order', paid: true };
  const check = evaluateSession(orderCharge(order), session);
  if (check.paid) await markPaid(order._id, 'bachs');
  return { ref: order.ref, kind: 'order', paid: check.paid, gatewayStatus: check.paid ? undefined : check.status };
}

/** Confirms whatever a gateway reference paid for: an express order or an invoice. */
async function confirmByReference(reference: string): Promise<VerifyPaymentResponse | null> {
  const order = await Order.findOne({ 'payment.reference': reference });
  if (order) {
    if (order.payment.status === 'paid') return { ref: order.ref, kind: 'order', paid: true };
    if (order.payment.provider === 'mock') {
      if (!paymentsAreMocked) return { ref: order.ref, kind: 'order', paid: false, gatewayStatus: 'unknown' };
      await markPaid(order._id, 'mock');
      return { ref: order.ref, kind: 'order', paid: true, mock: true };
    }
    const gateway = gatewayForOrder(order.payment.provider);
    if (!gateway?.configured) return { ref: order.ref, kind: 'order', paid: false, gatewayStatus: 'unknown' };
    const check = await gateway.checkPayment(orderCharge(order), attemptOf(order.payment));
    if (!check.paid) return { ref: order.ref, kind: 'order', paid: false, gatewayStatus: check.status };
    await markPaid(order._id, gateway.id);
    return { ref: order.ref, kind: 'order', paid: true };
  }

  const invoice = await Invoice.findOne({ 'payment.reference': reference });
  if (!invoice) return null;
  if (invoice.status === 'paid') return { ref: invoice.number, kind: 'invoice', paid: true };
  if (invoice.status === 'void') return { ref: invoice.number, kind: 'invoice', paid: false, gatewayStatus: 'void' };
  if (invoice.payment.provider === 'mock') {
    if (!paymentsAreMocked) return { ref: invoice.number, kind: 'invoice', paid: false, gatewayStatus: 'unknown' };
    await markInvoicePaid(invoice._id, { method: 'online', provider: 'mock', reference });
    return { ref: invoice.number, kind: 'invoice', paid: true, mock: true };
  }
  const gateway = gatewayForOrder(invoice.payment.provider);
  if (!gateway?.configured) return { ref: invoice.number, kind: 'invoice', paid: false, gatewayStatus: 'unknown' };
  const attempt = attemptOf(invoice.payment);
  const check = await gateway.checkPayment(invoiceCharge(invoice), attempt);
  if (!check.paid) return { ref: invoice.number, kind: 'invoice', paid: false, gatewayStatus: check.status };
  await markInvoicePaid(invoice._id, { method: 'online', provider: gateway.id, ...attempt });
  return { ref: invoice.number, kind: 'invoice', paid: true };
}

export default async function paymentRoutes(app: FastifyInstance) {
  // Called by the web app when the customer returns from the payment page.
  // Bachs returns with ?checkout_id=, Paystack and the mock with ?reference=.
  app.get<{ Querystring: { reference?: string; checkout_id?: string } }>(
    '/payments/verify',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            reference: { type: 'string', maxLength: 60 },
            checkout_id: { type: 'string', pattern: '^chk_[A-Za-z0-9_-]{1,80}$' }
          }
        }
      }
    },
    async (req): Promise<VerifyPaymentResponse> => {
      const { reference, checkout_id: checkoutId } = req.query;

      if (checkoutId) {
        const known = await Order.findOne({ 'payment.checkoutId': checkoutId });
        if (known?.payment.status === 'paid') return { ref: known.ref, kind: 'order', paid: true };
        const knownInvoice = await Invoice.findOne({ 'payment.checkoutId': checkoutId });
        if (knownInvoice?.status === 'paid') return { ref: knownInvoice.number, kind: 'invoice', paid: true };
        if (!config.payments.bachs.secretKey) throw notFound('We could not find a payment with that reference.');
        const result = await confirmBachsSession(await getCheckoutSession(checkoutId));
        if (!result) throw notFound('We could not find a payment with that reference.');
        return result;
      }

      if (!reference) throw badRequest('A payment reference is required.');
      const result = await confirmByReference(reference);
      if (!result) throw notFound('We could not find a payment with that reference.');
      return result;
    }
  );

  // Webhooks, in their own scope so the raw body is kept for the signature checks.
  // Both stay registered whichever gateway is active, so switching never strands a payment in flight.
  await app.register(async function webhookScope(scope) {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      const raw = body as Buffer;
      req.rawBody = raw;
      try {
        done(null, JSON.parse(raw.toString('utf8')));
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        error.statusCode = 400;
        done(error, undefined);
      }
    });

    scope.post<{ Body: BachsEvent }>('/payments/bachs/webhook', { config: { rateLimit: false } }, async (req, reply) => {
      if (!isValidBachsSignature(req.rawBody, req.headers)) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }
      const { id, type, data } = req.body ?? {};
      if (type && BACHS_PAID_EVENTS.has(type) && data?.checkout_id && config.payments.bachs.secretKey) {
        // Re-read the session rather than trusting the event body. A failure here returns 5xx so Bachs retries;
        // a session Bachs doesn't know (e.g. a dashboard test event) is acknowledged and ignored.
        const session = await getCheckoutSession(data.checkout_id).catch((err: { statusCode?: number }) => {
          if (err.statusCode === 404) return null;
          throw err;
        });
        const result = session ? await confirmBachsSession(session) : null;
        req.log.info({ event: id, type, checkoutId: data.checkout_id, kind: result?.kind, ref: result?.ref, paid: result?.paid }, 'bachs webhook');
      }
      return reply.code(200).send({ received: true });
    });

    scope.post<{ Body: PaystackWebhookBody }>('/payments/paystack/webhook', { config: { rateLimit: false } }, async (req, reply) => {
      if (!config.payments.paystack.secretKey || !isValidPaystackSignature(req.rawBody, req.headers['x-paystack-signature'])) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }
      const { event, data } = req.body ?? {};
      if (event === 'charge.success' && data?.reference) {
        const order = await Order.findOne({ 'payment.reference': data.reference });
        if (order && amountMatches(order.quote.total, data)) await markPaid(order._id, 'paystack');
        const invoice = order ? null : await Invoice.findOne({ 'payment.reference': data.reference });
        if (invoice && amountMatches(invoice.total, data)) {
          await markInvoicePaid(invoice._id, { method: 'online', provider: 'paystack', reference: data.reference });
        }
      }
      return reply.code(200).send({ received: true });
    });
  });
}
