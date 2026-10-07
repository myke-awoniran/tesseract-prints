import type { FastifyInstance } from 'fastify';
import type { VerifyPaymentResponse } from '@tesseract/shared';
import { paymentsAreMocked } from '../config.js';
import { Order, type OrderDocument } from '../models/Order.js';
import { markPaid } from '../lib/orders.js';
import { verifyTransaction, isValidWebhookSignature, type PaystackTransaction } from '../lib/paystack.js';
import { notFound } from '../lib/errors.js';

function amountMatches(order: OrderDocument, data: PaystackTransaction | undefined): boolean {
  return data?.status === 'success' && Number(data.amount) === order.quote.total && data.currency === 'NGN';
}

interface WebhookBody {
  event?: string;
  data?: PaystackTransaction;
}

export default async function paymentRoutes(app: FastifyInstance) {
  // Called by the web app when the customer returns from the payment page.
  app.get<{ Querystring: { reference: string } }>(
    '/payments/verify',
    {
      schema: {
        querystring: { type: 'object', required: ['reference'], properties: { reference: { type: 'string', maxLength: 60 } } }
      }
    },
    async (req): Promise<VerifyPaymentResponse> => {
      const order = await Order.findOne({ 'payment.reference': req.query.reference });
      if (!order) throw notFound('We could not find a payment with that reference.');

      if (order.payment.status === 'paid') return { ref: order.ref, paid: true };

      if (paymentsAreMocked) {
        await markPaid(order._id, 'mock');
        return { ref: order.ref, paid: true, mock: true };
      }

      const data = await verifyTransaction(req.query.reference);
      if (!amountMatches(order, data)) return { ref: order.ref, paid: false, gatewayStatus: data?.status ?? 'unknown' };
      await markPaid(order._id, 'paystack');
      return { ref: order.ref, paid: true };
    }
  );

  // Paystack webhook, in its own scope so the raw body is kept for the signature check.
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

    scope.post<{ Body: WebhookBody }>('/payments/paystack/webhook', { config: { rateLimit: false } }, async (req, reply) => {
      if (paymentsAreMocked || !isValidWebhookSignature(req.rawBody, req.headers['x-paystack-signature'])) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }
      const { event, data } = req.body ?? {};
      if (event === 'charge.success' && data?.reference) {
        const order = await Order.findOne({ 'payment.reference': data.reference });
        if (order && amountMatches(order, data)) await markPaid(order._id, 'paystack');
      }
      return reply.code(200).send({ received: true });
    });
  });
}
