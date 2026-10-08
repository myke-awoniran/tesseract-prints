import type { FastifyInstance } from 'fastify';
import type { CreateExpressOrderResponse, PayRequest, PayResponse } from '@tesseract/shared';
import { config, paymentsAreMocked } from '../config.js';
import { createOrder, readMultipart, findOrderByToken, serializeOrder } from '../lib/orders.js';
import { activeGateway, orderCharge } from '../lib/payments/index.js';
import { conflict, notFound } from '../lib/errors.js';

// Express printing: no account needed. The customer keeps a private access token
// that unlocks payment and tracking for their order.
export default async function expressRoutes(app: FastifyInstance) {
  app.post('/express/orders', { config: { rateLimit: { max: 15, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { fields, upload } = await readMultipart(req);
    const { order, accessToken } = await createOrder({ fields, upload, channel: 'express' });
    req.log.info({ ref: order.ref }, 'express order created');
    const body: CreateExpressOrderResponse = { order: serializeOrder(order), accessToken };
    return reply.code(201).send(body);
  });

  app.post<{ Params: { ref: string }; Body: PayRequest }>(
    '/express/orders/:ref/pay',
    {
      schema: {
        params: { type: 'object', required: ['ref'], properties: { ref: { type: 'string', maxLength: 20 } } },
        body: { type: 'object', required: ['token'], properties: { token: { type: 'string', maxLength: 100 } } }
      }
    },
    async (req): Promise<PayResponse> => {
      const order = await findOrderByToken(req.params.ref, req.body.token);
      if (!order) throw notFound('We could not find that order. Check the reference and try again.');
      if (order.status !== 'awaiting_payment') throw conflict('This order has already been paid for.');

      const reference = `${order.ref}-${Date.now().toString(36).toUpperCase()}`;
      const returnUrl = `${config.webUrl}/pay/return`;

      if (paymentsAreMocked) {
        // Development only: config.ts refuses to start in production without a payment key.
        order.payment.reference = reference;
        order.payment.provider = 'mock';
        await order.save();
        return { authorizationUrl: `${returnUrl}?reference=${encodeURIComponent(reference)}&mock=1`, reference, mock: true };
      }

      const checkout = await activeGateway.startCheckout(orderCharge(order), {
        reference,
        returnUrl,
        cancelUrl: `${returnUrl}?reference=${encodeURIComponent(reference)}&cancelled=1`
      });
      order.payment.reference = reference;
      order.payment.provider = activeGateway.id;
      order.payment.checkoutId = checkout.checkoutId;
      await order.save();
      req.log.info({ ref: order.ref, provider: activeGateway.id, reference }, 'checkout started');
      return { authorizationUrl: checkout.url, reference, mock: false };
    }
  );
}
