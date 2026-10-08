import type { FastifyInstance } from 'fastify';
import {
  CLIENT_ROLES,
  type ClientInvoicesResponse,
  type InvoicePayRequest,
  type InvoiceResponse,
  type MarkInvoicePaidRequest,
  type OpsInvoicesResponse,
  type PayResponse,
  type RunBillingResponse,
  type VoidInvoiceRequest
} from '@tesseract/shared';
import type { FilterQuery } from 'mongoose';
import { config } from '../config.js';
import { Invoice, type IInvoice } from '../models/Invoice.js';
import { User } from '../models/User.js';
import {
  billablePeriod,
  findInvoiceByToken,
  generateInvoices,
  invoiceUrl,
  markInvoicePaid,
  periodView,
  serializeInvoice,
  startInvoiceCheckout,
  upcomingInvoice,
  voidInvoice
} from '../lib/invoices.js';
import { reconcileInvoice } from '../lib/payments/reconcile.js';
import { openToken, resendInvoice } from '../lib/email/notify.js';
import { requireOrganization, requireUser } from '../lib/request.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { startOfLagosMonth } from '../lib/time.js';

const numberParam = {
  type: 'object',
  required: ['number'],
  properties: { number: { type: 'string', pattern: '^INV-[0-9]{6}-[A-Z0-9]{5}$' } }
} as const;

const notFoundMessage = 'We could not find that invoice.';
const bankDetails = () => config.billing.bankDetails || undefined;

export default async function billingRoutes(app: FastifyInstance) {
  /* ─────────── Public: the private link in the invoice email ─────────── */

  app.get<{ Params: { number: string }; Querystring: { t: string } }>(
    '/invoices/:number',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { params: numberParam, querystring: { type: 'object', required: ['t'], properties: { t: { type: 'string', maxLength: 100 } } } }
    },
    async (req): Promise<InvoiceResponse> => {
      let invoice = await findInvoiceByToken(req.params.number, req.query.t);
      if (!invoice) throw notFound('We could not find that invoice. Use the link from your invoice email.');
      if (await reconcileInvoice(invoice, req.log)) invoice = (await Invoice.findById(invoice._id)) ?? invoice;
      return { invoice: serializeInvoice(invoice), bankDetails: bankDetails() };
    }
  );

  app.post<{ Params: { number: string }; Body: InvoicePayRequest }>(
    '/invoices/:number/pay',
    {
      config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
      schema: { params: numberParam, body: { type: 'object', required: ['token'], properties: { token: { type: 'string', maxLength: 100 } } } }
    },
    async (req): Promise<PayResponse> => {
      const token = req.body.token ?? '';
      const invoice = await findInvoiceByToken(req.params.number, token);
      if (!invoice) throw notFound(notFoundMessage);
      return startInvoiceCheckout(invoice, invoiceUrl(invoice, token));
    }
  );

  /* ─────────── Organisation users ─────────── */

  await app.register(async function clientBilling(client) {
    client.addHook('onRequest', client.authenticate);
    client.addHook('preHandler', client.requireRole(...CLIENT_ROLES));

    client.get('/enterprise/invoices', async (req): Promise<ClientInvoicesResponse> => {
      const organization = requireOrganization(req);
      const [invoices, upcoming] = await Promise.all([
        Invoice.find({ organization, status: { $ne: 'void' } }).sort({ issuedAt: -1 }).limit(36),
        upcomingInvoice(organization)
      ]);
      return {
        invoices: invoices.map(serializeInvoice),
        upcoming,
        outstanding: invoices.filter((i) => i.status === 'open').reduce((sum, i) => sum + i.total, 0)
      };
    });

    client.get<{ Params: { number: string } }>('/enterprise/invoices/:number', { schema: { params: numberParam } }, async (req): Promise<InvoiceResponse> => {
      let invoice = await Invoice.findOne({ number: req.params.number, organization: requireOrganization(req) });
      if (!invoice) throw notFound(notFoundMessage);
      if (await reconcileInvoice(invoice, req.log)) invoice = (await Invoice.findById(invoice._id)) ?? invoice;
      return { invoice: serializeInvoice(invoice), bankDetails: bankDetails() };
    });

    client.post<{ Params: { number: string } }>(
      '/enterprise/invoices/:number/pay',
      { schema: { params: numberParam } },
      async (req): Promise<PayResponse> => {
        const invoice = await Invoice.findOne({ number: req.params.number, organization: requireOrganization(req) });
        if (!invoice) throw notFound(notFoundMessage);
        return startInvoiceCheckout(invoice, `${config.webUrl}/console/billing/${invoice.number}`, requireUser(req).email);
      }
    );
  });

  /* ─────────── Print room ─────────── */

  await app.register(async function opsBilling(ops) {
    ops.addHook('onRequest', ops.authenticate);
    ops.addHook('preHandler', ops.requireRole('operator'));

    ops.get<{ Querystring: { status?: string } }>('/ops/invoices', async (req): Promise<OpsInvoicesResponse> => {
      const now = new Date();
      const filter: FilterQuery<IInvoice> = {};
      const status = req.query.status ?? '';
      if (status === 'overdue') Object.assign(filter, { status: 'open', dueAt: { $lt: now } });
      else if (['open', 'paid', 'void'].includes(status)) filter.status = status;

      const [invoices, open, paidThisMonth] = await Promise.all([
        Invoice.find(filter).sort({ issuedAt: -1 }).limit(200),
        Invoice.find({ status: 'open' }).select('total dueAt'),
        Invoice.aggregate<{ total: number }>([
          { $match: { status: 'paid', paidAt: { $gte: startOfLagosMonth(now) } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ])
      ]);
      return {
        invoices: invoices.map(serializeInvoice),
        totals: {
          outstanding: open.reduce((sum, i) => sum + i.total, 0),
          overdue: open.filter((i) => i.dueAt < now).reduce((sum, i) => sum + i.total, 0),
          paidThisMonth: paidThisMonth[0]?.total ?? 0
        }
      };
    });

    ops.get<{ Params: { number: string } }>('/ops/invoices/:number', { schema: { params: numberParam } }, async (req): Promise<InvoiceResponse> => {
      let invoice = await Invoice.findOne({ number: req.params.number });
      if (!invoice) throw notFound(notFoundMessage);
      if (await reconcileInvoice(invoice, req.log)) invoice = (await Invoice.findById(invoice._id)) ?? invoice;
      return { invoice: serializeInvoice(invoice), bankDetails: bankDetails() };
    });

    // Bills the month just finished now, instead of waiting for the hourly run. Never bills a month twice.
    ops.post('/ops/billing/run', async (req): Promise<RunBillingResponse> => {
      const period = billablePeriod();
      const created = await generateInvoices(period, req.log);
      return { period: periodView(period), created };
    });

    ops.post<{ Params: { number: string }; Body: MarkInvoicePaidRequest }>(
      '/ops/invoices/:number/mark-paid',
      {
        schema: {
          params: numberParam,
          body: {
            type: 'object',
            required: ['method'],
            properties: { method: { type: 'string', enum: ['bank_transfer', 'other'] }, note: { type: 'string', maxLength: 300 } }
          }
        }
      },
      async (req): Promise<InvoiceResponse> => {
        const invoice = await Invoice.findOne({ number: req.params.number });
        if (!invoice) throw notFound(notFoundMessage);
        if (invoice.status !== 'open') throw conflict(invoice.status === 'paid' ? 'This invoice is already paid.' : 'A void invoice cannot be paid.');
        await markInvoicePaid(invoice._id, {
          method: req.body.method,
          provider: null,
          note: req.body.note?.trim(),
          recordedBy: requireUser(req).name
        });
        return { invoice: serializeInvoice((await Invoice.findById(invoice._id)) ?? invoice) };
      }
    );

    ops.post<{ Params: { number: string }; Body: VoidInvoiceRequest }>(
      '/ops/invoices/:number/void',
      {
        schema: {
          params: numberParam,
          body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', maxLength: 300 } } }
        }
      },
      async (req): Promise<InvoiceResponse> => {
        const reason = req.body.reason.trim();
        if (reason.length < 3) throw badRequest('Say why the invoice is being voided.', { reason: 'Say why the invoice is being voided.' });
        const invoice = await Invoice.findOne({ number: req.params.number });
        if (!invoice) throw notFound(notFoundMessage);
        await voidInvoice(invoice, reason);
        return { invoice: serializeInvoice((await Invoice.findById(invoice._id)) ?? invoice) };
      }
    );

    ops.post<{ Params: { number: string } }>('/ops/invoices/:number/resend', { schema: { params: numberParam } }, async (req) => {
      const invoice = await Invoice.findOne({ number: req.params.number }).select('+accessTokenEnc');
      if (!invoice) throw notFound(notFoundMessage);
      if (invoice.status === 'void') throw conflict('A void invoice cannot be sent.');
      const recipients = invoice.billingEmail
        ? [invoice.billingEmail]
        : (await User.find({ organization: invoice.organization, role: 'owner', active: true }).select('email')).map((u) => u.email);
      if (!recipients.length) throw conflict('This organisation has no billing email or owner to send to.');
      await resendInvoice(invoice, recipients, openToken(invoice.accessTokenEnc) ?? undefined);
      return { sent: recipients.length };
    });
  });
}
