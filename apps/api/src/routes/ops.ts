import type { FastifyInstance } from 'fastify';
import { FULFILMENT_FLOW, ORDER_STATUS_IDS, type AccessLogResponse, type OrderResponse, type QueueResponse, type StatusChangeRequest } from '@tesseract/shared';
import { Order } from '../models/Order.js';
import { AccessLog } from '../models/AccessLog.js';
import { advanceStatus, serializeOrder, fileIsAvailable } from '../lib/orders.js';
import { readDecryptedFile } from '../lib/files.js';
import { requireUser } from '../lib/request.js';
import { gone, notFound } from '../lib/errors.js';

// Print-room endpoints for Tesseract Prints operators.
export default async function opsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.addHook('preHandler', app.requireRole('operator'));

  app.get('/ops/queue', async (): Promise<QueueResponse> => {
    const orders = await Order.find({ status: { $in: FULFILMENT_FLOW.slice(0, -1) } }).sort({ createdAt: 1 }).limit(200);
    return { items: orders.map((o) => serializeOrder(o, { internal: true })) };
  });

  app.get<{ Params: { ref: string } }>('/ops/orders/:ref/file', async (req, reply) => {
    const order = await Order.findOne({ ref: req.params.ref });
    if (!order) throw notFound();
    if (!fileIsAvailable(order)) throw gone('This document has been erased and can no longer be printed.');
    const file = await readDecryptedFile(order.file.id);
    if (!file) throw gone('This document has expired and been erased.');

    await AccessLog.create({ order: order._id, user: requireUser(req)._id, action: 'file_downloaded', detail: file.name, ip: req.ip });

    const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
    return reply
      .header('Content-Type', file.mime)
      .header('Content-Disposition', `attachment; filename="${safeName}"`)
      .header('Cache-Control', 'no-store')
      .send(file.buffer);
  });

  app.post<{ Params: { ref: string }; Body: StatusChangeRequest }>(
    '/ops/orders/:ref/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: [...ORDER_STATUS_IDS] },
            note: { type: 'string', maxLength: 300 },
            handoverCode: { type: 'string', maxLength: 10 }
          }
        }
      }
    },
    async (req): Promise<OrderResponse> => {
      const order = await Order.findOne({ ref: req.params.ref });
      if (!order) throw notFound();
      await advanceStatus(order, req.body.status, {
        user: requireUser(req),
        note: req.body.note ?? '',
        code: req.body.handoverCode ?? '',
        ip: req.ip
      });
      return { order: serializeOrder(order, { internal: true }) };
    }
  );

  app.get<{ Params: { ref: string } }>('/ops/orders/:ref/log', async (req): Promise<AccessLogResponse> => {
    const order = await Order.findOne({ ref: req.params.ref });
    if (!order) throw notFound();
    const entries = await AccessLog.find({ order: order._id })
      .sort({ at: -1 })
      .populate<{ user: { name: string } | null }>('user', 'name');
    return {
      entries: entries.map((e) => ({ action: e.action, detail: e.detail, at: e.at.toISOString(), by: e.user?.name ?? 'System' }))
    };
  });
}
