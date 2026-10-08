import type { FastifyInstance } from 'fastify';
import {
  ALL_AREAS,
  CLIENT_ROLES,
  FINISHING_IDS,
  IN_PROGRESS_STATUSES,
  ORDER_STATUSES,
  isOrderStatus,
  type AddTeamMemberRequest,
  type AddTeamMemberResponse,
  type ChangePasswordRequest,
  type OrderResponse,
  type OrdersPageResponse,
  type SettingsResponse,
  type StatsResponse,
  type TeamResponse,
  type UpdateOrganizationRequest,
  type UpdateOrganizationResponse
} from '@tesseract/shared';
import type { FilterQuery } from 'mongoose';
import { Order, type IOrder } from '../models/Order.js';
import { Organization, toOrganizationView } from '../models/Organization.js';
import { User } from '../models/User.js';
import { createOrder, readMultipart, serializeOrder } from '../lib/orders.js';
import { requireOrganization, requireUser } from '../lib/request.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

function monthStart(offset = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TotalsRow {
  total: number;
  thisMonth: number;
  inProgress: number;
  delivered: number;
  pagesThisMonth: number;
  invoicedThisMonth: number;
}

interface MonthlyRow {
  _id: { y: number; m: number };
  orders: number;
  pages: number;
}

export default async function enterpriseRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.addHook('preHandler', app.requireRole(...CLIENT_ROLES));
  const adminsOnly = { preHandler: app.requireRole('owner', 'admin') };

  app.get('/enterprise/stats', async (req): Promise<StatsResponse> => {
    const org = requireOrganization(req);
    const since = monthStart(-5);
    const thisMonth = monthStart(0);

    const [totals, monthly, byStatus, recent] = await Promise.all([
      Order.aggregate<TotalsRow>([
        { $match: { organization: org } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            thisMonth: { $sum: { $cond: [{ $gte: ['$createdAt', thisMonth] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $in: ['$status', IN_PROGRESS_STATUSES] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            pagesThisMonth: {
              $sum: { $cond: [{ $gte: ['$createdAt', thisMonth] }, { $multiply: ['$options.pages', '$options.copies'] }, 0] }
            },
            invoicedThisMonth: { $sum: { $cond: [{ $gte: ['$createdAt', thisMonth] }, '$quote.total', 0] } }
          }
        }
      ]),
      Order.aggregate<MonthlyRow>([
        { $match: { organization: org, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            orders: { $sum: 1 },
            pages: { $sum: { $multiply: ['$options.pages', '$options.copies'] } }
          }
        }
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: { organization: org } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Order.find({ organization: org }).sort({ createdAt: -1 }).limit(6)
    ]);

    const series = [];
    for (let i = -5; i <= 0; i += 1) {
      const d = monthStart(i);
      const hit = monthly.find((m) => m._id.y === d.getFullYear() && m._id.m === d.getMonth() + 1);
      series.push({ month: d.toLocaleString('en-GB', { month: 'short' }), orders: hit?.orders ?? 0, pages: hit?.pages ?? 0 });
    }

    const t = totals[0];
    return {
      totals: {
        total: t?.total ?? 0,
        thisMonth: t?.thisMonth ?? 0,
        inProgress: t?.inProgress ?? 0,
        delivered: t?.delivered ?? 0,
        pagesThisMonth: t?.pagesThisMonth ?? 0,
        invoicedThisMonth: t?.invoicedThisMonth ?? 0
      },
      series,
      byStatus: ORDER_STATUSES.filter((s) => s.id !== 'awaiting_payment').map((s) => ({
        status: s.id,
        label: s.label,
        count: byStatus.find((b) => b._id === s.id)?.count ?? 0
      })),
      recent: recent.map((o) => serializeOrder(o))
    };
  });

  app.get<{ Querystring: { status?: string; q?: string; page: number } }>(
    '/enterprise/orders',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', maxLength: 30 },
            q: { type: 'string', maxLength: 80 },
            page: { type: 'integer', minimum: 1, default: 1 }
          }
        }
      }
    },
    async (req): Promise<OrdersPageResponse> => {
      const filter: FilterQuery<IOrder> = { organization: requireOrganization(req) };
      const { status, q, page } = req.query;
      if (status === 'active') filter.status = { $in: IN_PROGRESS_STATUSES };
      else if (isOrderStatus(status)) filter.status = status;
      if (q) {
        const rx = new RegExp(escapeRegExp(q), 'i');
        filter.$or = [{ ref: rx }, { title: rx }, { 'delivery.recipientName': rx }];
      }
      const limit = 20;
      const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Order.countDocuments(filter)
      ]);
      return { items: items.map((o) => serializeOrder(o)), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
    }
  );

  app.get<{ Params: { ref: string } }>('/enterprise/orders/:ref', async (req): Promise<OrderResponse> => {
    const order = await Order.findOne({ ref: req.params.ref, organization: requireOrganization(req) }).select('+handoverCode');
    if (!order) throw notFound('That order is not in your organisation’s records.');
    return { order: serializeOrder(order, { includeHandover: true }) };
  });

  app.post('/enterprise/orders', { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const user = requireUser(req);
    const org = await Organization.findById(requireOrganization(req));
    if (!org) throw notFound('Your organisation could not be found.');
    const { fields, upload } = await readMultipart(req);
    const d = org.defaultDelivery;
    const p = org.preferences;
    const merged = {
      name: user.name,
      email: user.email,
      phone: fields.phone || d?.phone,
      recipientName: fields.recipientName,
      recipientPhone: fields.recipientPhone || fields.phone,
      address: fields.address,
      area: fields.area,
      instructions: fields.instructions,
      title: fields.title,
      colour: fields.colour || p?.defaultColour,
      sides: fields.sides || 'double',
      paperSize: fields.paperSize || 'A4',
      paperType: fields.paperType || 'standard',
      finishing: fields.finishing || p?.defaultFinishing || 'none',
      copies: fields.copies || '1',
      pages: fields.pages
    };
    const { order } = await createOrder({ fields: merged, upload, channel: 'enterprise', organization: org._id, user });
    const withCode = await Order.findById(order._id).select('+handoverCode');
    const body: OrderResponse = { order: serializeOrder(withCode ?? order, { includeHandover: true }) };
    return reply.code(201).send(body);
  });

  app.get('/enterprise/settings', async (req): Promise<SettingsResponse> => {
    const org = await Organization.findById(requireOrganization(req));
    if (!org) throw notFound('Your organisation could not be found.');
    return { user: requireUser(req).toPublic(), organization: toOrganizationView(org) };
  });

  app.patch<{ Body: UpdateOrganizationRequest }>(
    '/enterprise/settings/organization',
    {
      ...adminsOnly,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 160 },
            billingEmail: { type: 'string', maxLength: 160 },
            defaultDelivery: {
              type: 'object',
              additionalProperties: false,
              properties: {
                recipientName: { type: 'string', maxLength: 120 },
                phone: { type: 'string', maxLength: 24 },
                address: { type: 'string', maxLength: 400 },
                area: { type: 'string', maxLength: 80 }
              }
            },
            preferences: {
              type: 'object',
              additionalProperties: false,
              properties: {
                notifyOnDispatch: { type: 'boolean' },
                notifyOnDelivery: { type: 'boolean' },
                defaultFinishing: { type: 'string', enum: [...FINISHING_IDS] },
                defaultColour: { type: 'string', enum: ['mono', 'colour'] }
              }
            }
          }
        }
      }
    },
    async (req): Promise<UpdateOrganizationResponse> => {
      const body = req.body;
      if (body.defaultDelivery?.area && !ALL_AREAS.includes(body.defaultDelivery.area)) {
        throw badRequest('Choose a delivery area from the list.', { area: 'Choose a delivery area from the list.' });
      }
      const set: Record<string, unknown> = {};
      if (body.name) set.name = body.name;
      if (body.billingEmail !== undefined) set.billingEmail = body.billingEmail;
      for (const [k, v] of Object.entries(body.defaultDelivery ?? {})) set[`defaultDelivery.${k}`] = v;
      for (const [k, v] of Object.entries(body.preferences ?? {})) set[`preferences.${k}`] = v;
      const org = await Organization.findByIdAndUpdate(requireOrganization(req), { $set: set }, { new: true, runValidators: true });
      if (!org) throw notFound('Your organisation could not be found.');
      return { organization: toOrganizationView(org) };
    }
  );

  app.patch<{ Body: { name: string } }>(
    '/enterprise/settings/profile',
    { schema: { body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 120 } } } } },
    async (req) => {
      const user = requireUser(req);
      user.name = req.body.name.trim();
      await user.save();
      return { user: user.toPublic() };
    }
  );

  app.post<{ Body: ChangePasswordRequest }>(
    '/enterprise/settings/password',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', maxLength: 200 },
            newPassword: { type: 'string', minLength: 10, maxLength: 200 }
          }
        }
      }
    },
    async (req) => {
      const user = await User.findById(requireUser(req)._id).select('+passwordHash');
      if (!user || !(await user.verifyPassword(req.body.currentPassword))) {
        throw badRequest('Your current password is incorrect.', { currentPassword: 'Your current password is incorrect.' });
      }
      await user.setPassword(req.body.newPassword);
      await user.save();
      return { ok: true };
    }
  );

  app.get('/enterprise/team', async (req): Promise<TeamResponse> => {
    const users = await User.find({ organization: requireOrganization(req) }).sort({ createdAt: 1 });
    return { members: users.map((u) => ({ ...u.toPublic(), active: u.active })) };
  });

  app.post<{ Body: AddTeamMemberRequest }>(
    '/enterprise/team',
    {
      ...adminsOnly,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'role', 'password'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 120 },
            email: { type: 'string', format: 'email', maxLength: 160 },
            role: { type: 'string', enum: ['admin', 'member'] },
            password: { type: 'string', minLength: 10, maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      if (await User.exists({ email })) throw conflict('Someone with that email already has an account.');
      const user = new User({ name: req.body.name, email, role: req.body.role, organization: requireOrganization(req) });
      await user.setPassword(req.body.password);
      await user.save();
      const body: AddTeamMemberResponse = { member: { ...user.toPublic(), active: true } };
      return reply.code(201).send(body);
    }
  );
}
