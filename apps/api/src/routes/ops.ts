import type { FastifyInstance } from 'fastify';
import {
  IN_PROGRESS_STATUSES,
  ORDER_STATUS_IDS,
  ZONES,
  isOrderStatus,
  statusLabel,
  type AccessLogEntryView,
  type AccessLogResponse,
  type ClientsResponse,
  type DeliveryUpdateRequest,
  type DispatchRequest,
  type EmailsResponse,
  type EmailTemplatesResponse,
  type EmailView,
  type OpsOrderResponse,
  type OpsOverviewResponse,
  type OrderResponse,
  type OrdersPageResponse,
  type QueueResponse,
  type StatusChangeRequest
} from '@tesseract/shared';
import { config } from '../config.js';
import { Order, type OrderDocument } from '../models/Order.js';
import { AccessLog } from '../models/AccessLog.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { EmailLog, type EmailLogDocument } from '../models/EmailLog.js';
import { advanceStatus, serializeOrder, fileIsAvailable, assignDispatch, addDeliveryUpdate } from '../lib/orders.js';
import { readDecryptedFile } from '../lib/files.js';
import { publishOrder } from '../lib/realtime.js';
import { requireUser } from '../lib/request.js';
import { DAY, LAGOS_OFFSET_MS, startOfLagosDay, startOfLagosMonth } from '../lib/time.js';
import { badRequest, gone, notFound } from '../lib/errors.js';
import { emailProvider, resendEmail, sendEmail } from '../lib/email/mailer.js';
import { TEMPLATE_INFO, sampleEmail, type TemplateId } from '../lib/email/templates.js';

/** Orders that count as business: paid express orders and invoiced account orders, not cancelled. */
const BILLABLE = { 'payment.status': { $in: ['paid', 'invoiced'] }, status: { $ne: 'cancelled' } };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function emailView(e: EmailLogDocument): EmailView {
  return {
    id: e._id,
    to: e.to,
    subject: e.subject,
    template: e.template,
    orderRef: e.orderRef,
    status: e.status,
    error: e.error,
    provider: e.provider,
    at: e.at.toISOString()
  };
}

async function logEntries(filter: Record<string, unknown>, limit: number): Promise<AccessLogEntryView[]> {
  const entries = await AccessLog.find(filter)
    .sort({ at: -1 })
    .limit(limit)
    .populate<{ user: { name: string } | null }>('user', 'name')
    .populate<{ order: { ref: string } | null }>('order', 'ref');
  return entries.map((e) => ({ action: e.action, detail: e.detail, at: e.at.toISOString(), by: e.user?.name ?? 'System', ref: e.order?.ref }));
}

async function findByRef(ref: string): Promise<OrderDocument> {
  const order = await Order.findOne({ ref: ref.toUpperCase() });
  if (!order) throw notFound('There is no order with that reference.');
  return order;
}

// Print-room endpoints for Tesseract Prints operators.
export default async function opsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.addHook('preHandler', app.requireRole('operator'));

  /* ─────────── Overview ─────────── */

  app.get('/ops/overview', async (): Promise<OpsOverviewResponse> => {
    const now = new Date();
    const today = startOfLagosDay(now);
    const month = startOfLagosMonth(now);
    const fortnight = new Date(today.getTime() - 13 * DAY);

    const [pipelineAgg, todayAgg, monthAgg, turnaroundAgg, seriesAgg, zoneAgg, awaitingPayment, deliveredToday, alertsSource, activity] = await Promise.all([
      Order.aggregate<{ _id: string; count: number }>([{ $match: { status: { $in: [...IN_PROGRESS_STATUSES] } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate<{ received: number; revenue: number; pages: number }>([
        { $match: { ...BILLABLE, createdAt: { $gte: today } } },
        { $group: { _id: null, received: { $sum: 1 }, revenue: { $sum: '$quote.total' }, pages: { $sum: { $multiply: ['$options.pages', '$options.copies'] } } } }
      ]),
      Order.aggregate<{ orders: number; revenue: number; pages: number; expressRevenue: number; invoiced: number }>([
        { $match: { ...BILLABLE, createdAt: { $gte: month } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$quote.total' },
            pages: { $sum: { $multiply: ['$options.pages', '$options.copies'] } },
            expressRevenue: { $sum: { $cond: [{ $eq: ['$channel', 'express'] }, '$quote.total', 0] } },
            invoiced: { $sum: { $cond: [{ $eq: ['$channel', 'enterprise'] }, '$quote.total', 0] } }
          }
        }
      ]),
      Order.aggregate<{ hours: number }>([
        { $match: { status: 'delivered', deliveredAt: { $gte: new Date(now.getTime() - 30 * DAY) } } },
        { $group: { _id: null, hours: { $avg: { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 3_600_000] } } } }
      ]),
      Order.aggregate<{ _id: string; orders: number; revenue: number }>([
        { $match: { ...BILLABLE, createdAt: { $gte: fortnight } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Lagos' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$quote.total' }
          }
        }
      ]),
      Order.aggregate<{ _id: string; orders: number }>([{ $match: { ...BILLABLE, createdAt: { $gte: month } } }, { $group: { _id: '$delivery.zone', orders: { $sum: 1 } } }]),
      Order.countDocuments({ status: 'awaiting_payment', createdAt: { $gte: new Date(now.getTime() - DAY) } }),
      Order.countDocuments({ status: 'delivered', deliveredAt: { $gte: today } }),
      Order.find({ status: { $in: [...IN_PROGRESS_STATUSES] } })
        .select('ref title status createdAt fileExpiresAt fileDeletedAt dispatch timeline')
        .sort({ createdAt: 1 })
        .limit(300),
      logEntries({}, 14)
    ]);

    const alerts: OpsOverviewResponse['alerts'] = [];
    for (const o of alertsSource) {
      const paidAt = o.timeline.find((t) => t.status === 'queued')?.at ?? o.createdAt;
      const ageH = (now.getTime() - paidAt.getTime()) / 3_600_000;
      const expiresInH = o.fileExpiresAt && !o.fileDeletedAt ? (o.fileExpiresAt.getTime() - now.getTime()) / 3_600_000 : null;
      if (o.status === 'queued' && expiresInH !== null && expiresInH < 4) {
        alerts.push({
          kind: 'expiring',
          ref: o.ref,
          title: o.title,
          detail: expiresInH <= 0 ? 'File has expired before printing' : `File erased in ${Math.max(1, Math.round(expiresInH * 60))} min. Print it now.`
        });
      } else if (o.status === 'sealed' && !o.dispatch) {
        alerts.push({ kind: 'unassigned', ref: o.ref, title: o.title, detail: 'Sealed and waiting for a rider' });
      } else if (ageH > 24 && o.status !== 'out_for_delivery') {
        alerts.push({ kind: 'overdue', ref: o.ref, title: o.title, detail: `${statusLabel(o.status)} for ${Math.round(ageH)} hours` });
      }
    }
    const rank = { expiring: 0, overdue: 1, unassigned: 2 } as const;
    alerts.sort((a, b) => rank[a.kind] - rank[b.kind]);

    const series: OpsOverviewResponse['series'] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(today.getTime() - i * DAY + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
      const hit = seriesAgg.find((s) => s._id === day);
      series.push({ day, orders: hit?.orders ?? 0, revenue: hit?.revenue ?? 0 });
    }

    const m = monthAgg[0];
    return {
      pipeline: IN_PROGRESS_STATUSES.map((status) => ({ status, label: statusLabel(status), count: pipelineAgg.find((p) => p._id === status)?.count ?? 0 })),
      today: { received: todayAgg[0]?.received ?? 0, delivered: deliveredToday, revenue: todayAgg[0]?.revenue ?? 0, pages: todayAgg[0]?.pages ?? 0 },
      month: { orders: m?.orders ?? 0, revenue: m?.revenue ?? 0, pages: m?.pages ?? 0, expressRevenue: m?.expressRevenue ?? 0, invoiced: m?.invoiced ?? 0 },
      turnaroundHours: turnaroundAgg[0] ? Math.round(turnaroundAgg[0].hours * 10) / 10 : null,
      awaitingPayment,
      alerts: alerts.slice(0, 12),
      series,
      byZone: ZONES.map((z) => ({ zone: z.id, label: z.name, orders: zoneAgg.find((a) => a._id === z.id)?.orders ?? 0 })),
      activity
    };
  });

  /* ─────────── Work lists ─────────── */

  app.get('/ops/queue', async (): Promise<QueueResponse> => {
    const orders = await Order.find({ status: { $in: ['queued', 'printing'] } }).sort({ createdAt: 1 }).limit(200);
    return { items: orders.map((o) => serializeOrder(o, { internal: true })) };
  });

  app.get('/ops/deliveries', async (): Promise<QueueResponse> => {
    const orders = await Order.find({ status: { $in: ['sealed', 'out_for_delivery'] } }).sort({ createdAt: 1 }).limit(200);
    return { items: orders.map((o) => serializeOrder(o, { internal: true })) };
  });

  app.get<{ Querystring: { status?: string; channel?: string; q?: string; page?: string } }>('/ops/orders', async (req): Promise<OrdersPageResponse> => {
    const limit = 25;
    const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
    const filter: Record<string, unknown> = {};
    if (req.query.status === 'active') filter.status = { $in: [...IN_PROGRESS_STATUSES] };
    else if (req.query.status && isOrderStatus(req.query.status)) filter.status = req.query.status;
    if (req.query.channel === 'express' || req.query.channel === 'enterprise') filter.channel = req.query.channel;
    const q = (req.query.q ?? '').trim().slice(0, 80);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ ref: re }, { title: re }, { 'customer.name': re }, { 'customer.email': re }, { 'customer.phone': re }, { 'delivery.recipientName': re }, { 'delivery.area': re }];
    }
    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(filter)
    ]);
    return { items: items.map((o) => serializeOrder(o, { internal: true })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  });

  /* ─────────── One order ─────────── */

  app.get<{ Params: { ref: string } }>('/ops/orders/:ref', async (req): Promise<OpsOrderResponse> => {
    const order = await findByRef(req.params.ref);
    const [log, emails] = await Promise.all([logEntries({ order: order._id }, 100), EmailLog.find({ order: order._id }).sort({ at: -1 }).limit(50)]);
    return { order: serializeOrder(order, { internal: true }), log, emails: emails.map(emailView) };
  });

  app.get<{ Params: { ref: string } }>('/ops/orders/:ref/file', async (req, reply) => {
    const order = await findByRef(req.params.ref);
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
            handoverCode: { type: 'string', maxLength: 10 },
            rider: {
              type: 'object',
              required: ['name', 'phone'],
              properties: { name: { type: 'string', maxLength: 80 }, phone: { type: 'string', maxLength: 24 } }
            },
            eta: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req): Promise<OrderResponse> => {
      const order = await findByRef(req.params.ref);
      await advanceStatus(order, req.body.status, {
        user: requireUser(req),
        note: req.body.note ?? '',
        code: req.body.handoverCode ?? '',
        ip: req.ip,
        rider: req.body.rider,
        eta: req.body.eta
      });
      return { order: serializeOrder(order, { internal: true }) };
    }
  );

  app.post<{ Params: { ref: string }; Body: DispatchRequest }>(
    '/ops/orders/:ref/dispatch',
    {
      schema: {
        body: {
          type: 'object',
          required: ['riderName', 'riderPhone'],
          properties: {
            riderName: { type: 'string', maxLength: 80 },
            riderPhone: { type: 'string', maxLength: 24 },
            eta: { type: ['string', 'null'], maxLength: 40 }
          }
        }
      }
    },
    async (req): Promise<OrderResponse> => {
      const order = await findByRef(req.params.ref);
      if (!['queued', 'printing', 'sealed', 'out_for_delivery'].includes(order.status)) throw badRequest('Riders can only be assigned to orders in progress.');
      assignDispatch(order, { name: req.body.riderName, phone: req.body.riderPhone }, req.body.eta);
      await order.save();
      await AccessLog.create({ order: order._id, user: requireUser(req)._id, action: 'rider_assigned', detail: `${order.dispatch?.riderName} (${order.dispatch?.riderPhone})`, ip: req.ip });
      void publishOrder(order, 'dispatch');
      return { order: serializeOrder(order, { internal: true }) };
    }
  );

  app.post<{ Params: { ref: string }; Body: DeliveryUpdateRequest }>(
    '/ops/orders/:ref/updates',
    {
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string', maxLength: 600 }, notify: { type: 'boolean' } }
        }
      }
    },
    async (req): Promise<OrderResponse> => {
      const order = await findByRef(req.params.ref);
      await addDeliveryUpdate(order, req.body.message, { user: requireUser(req), notify: req.body.notify ?? true, ip: req.ip });
      return { order: serializeOrder(order, { internal: true }) };
    }
  );

  app.get<{ Params: { ref: string } }>('/ops/orders/:ref/log', async (req): Promise<AccessLogResponse> => {
    const order = await findByRef(req.params.ref);
    return { entries: await logEntries({ order: order._id }, 200) };
  });

  /* ─────────── Clients ─────────── */

  app.get('/ops/clients', async (): Promise<ClientsResponse> => {
    const month = startOfLagosMonth();
    const [orgs, orderAgg, memberAgg, expressAgg] = await Promise.all([
      Organization.find().sort({ name: 1 }),
      Order.aggregate<{ _id: string; orders: number; inProgress: number; spend: number; spendThisMonth: number; lastOrderAt: Date }>([
        { $match: { channel: 'enterprise', organization: { $ne: null } } },
        {
          $group: {
            _id: '$organization',
            orders: { $sum: 1 },
            inProgress: { $sum: { $cond: [{ $in: ['$status', [...IN_PROGRESS_STATUSES]] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$quote.total', 0] } },
            spendThisMonth: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'cancelled'] }, { $gte: ['$createdAt', month] }] }, '$quote.total', 0] } },
            lastOrderAt: { $max: '$createdAt' }
          }
        }
      ]),
      User.aggregate<{ _id: string; members: number }>([{ $match: { organization: { $ne: null } } }, { $group: { _id: '$organization', members: { $sum: 1 } } }]),
      Order.aggregate<{ customers: string[]; orders: number; revenue: number }>([
        { $match: { channel: 'express', 'payment.status': 'paid', status: { $ne: 'cancelled' } } },
        { $group: { _id: null, customers: { $addToSet: '$customer.email' }, orders: { $sum: 1 }, revenue: { $sum: '$quote.total' } } }
      ])
    ]);
    return {
      clients: orgs
        .map((org) => {
          const a = orderAgg.find((x) => x._id === org._id);
          return {
            id: org._id,
            name: org.name,
            billingEmail: org.billingEmail ?? '',
            members: memberAgg.find((x) => x._id === org._id)?.members ?? 0,
            orders: a?.orders ?? 0,
            inProgress: a?.inProgress ?? 0,
            spend: a?.spend ?? 0,
            spendThisMonth: a?.spendThisMonth ?? 0,
            lastOrderAt: a?.lastOrderAt?.toISOString()
          };
        })
        .sort((x, y) => y.spend - x.spend),
      express: { customers: expressAgg[0]?.customers.length ?? 0, orders: expressAgg[0]?.orders ?? 0, revenue: expressAgg[0]?.revenue ?? 0 }
    };
  });

  /* ─────────── Email ─────────── */

  app.get<{ Querystring: { page?: string; status?: string } }>('/ops/emails', async (req): Promise<EmailsResponse> => {
    const limit = 30;
    const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
    const filter = ['sent', 'failed', 'skipped'].includes(req.query.status ?? '') ? { status: req.query.status } : {};
    const [items, total] = await Promise.all([
      EmailLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit),
      EmailLog.countDocuments(filter)
    ]);
    return { items: items.map(emailView), total, page, pages: Math.max(1, Math.ceil(total / limit)), provider: emailProvider };
  });

  app.get('/ops/emails/templates', async (): Promise<EmailTemplatesResponse> => ({ templates: TEMPLATE_INFO }));

  app.get<{ Params: { id: string } }>('/ops/emails/templates/:id', async (req) => {
    const info = TEMPLATE_INFO.find((t) => t.id === req.params.id);
    if (!info) throw notFound('There is no template with that name.');
    const email = sampleEmail(info.id, config.webUrl);
    return { subject: email.subject, html: email.html, text: email.text };
  });

  app.post<{ Body: { to: string; template: string } }>(
    '/ops/emails/test',
    {
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['to', 'template'],
          properties: { to: { type: 'string', format: 'email', maxLength: 160 }, template: { type: 'string', maxLength: 40 } }
        }
      }
    },
    async (req): Promise<{ email: EmailView | null }> => {
      const info = TEMPLATE_INFO.find((t) => t.id === req.body.template);
      if (!info) throw notFound('There is no template with that name.');
      const sample = sampleEmail(info.id as TemplateId, config.webUrl);
      const sent = await sendEmail({ to: req.body.to, template: info.id, email: { ...sample, subject: `[Test] ${sample.subject}` } });
      return { email: sent ? emailView(sent) : null };
    }
  );

  app.get<{ Params: { id: string } }>('/ops/emails/:id', async (req) => {
    const email = await EmailLog.findById(req.params.id).select('+html +text');
    if (!email) throw notFound('That email could not be found.');
    return { email: emailView(email), html: email.html, text: email.text };
  });

  app.post<{ Params: { id: string } }>('/ops/emails/:id/resend', async (req): Promise<{ email: EmailView }> => {
    const sent = await resendEmail(req.params.id);
    if (!sent) throw notFound('That email could not be found.');
    if (sent.order) {
      await AccessLog.create({ order: sent.order, user: requireUser(req)._id, action: 'email_resent', detail: `${sent.subject} → ${sent.to}`, ip: req.ip });
    }
    return { email: emailView(sent) };
  });
}
