import type { FastifyInstance } from 'fastify';
import type { OrderResponse } from '@tesseract/shared';
import { findOrderByToken, serializeOrder } from '../lib/orders.js';
import { notFound } from '../lib/errors.js';

export default async function trackRoutes(app: FastifyInstance) {
  app.get<{ Params: { ref: string }; Querystring: { t: string } }>(
    '/track/:ref',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        params: { type: 'object', required: ['ref'], properties: { ref: { type: 'string', maxLength: 20 } } },
        querystring: { type: 'object', required: ['t'], properties: { t: { type: 'string', maxLength: 100 } } }
      }
    },
    async (req): Promise<OrderResponse> => {
      const order = await findOrderByToken(req.params.ref, req.query.t, '+handoverCode');
      if (!order) throw notFound('We could not find that order. Use the tracking link from your confirmation.');
      return { order: serializeOrder(order, { includeHandover: true }) };
    }
  );
}
