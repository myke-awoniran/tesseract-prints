// Live updates over Socket.IO. Operators share the `ops` room, client users their organisation's room,
// and a tracking page joins its order's room after proving the private tracking token.
// Every push is best-effort: a failed emit never fails the request that caused it.
//
// Rooms live in this process's memory. Running more than one API instance needs a shared adapter
// (e.g. @socket.io/redis-adapter) so an event raised on one instance reaches sockets on the others.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import {
  REALTIME_PATH,
  formatNaira,
  statusLabel,
  type ClientToServerEvents,
  type InvoiceEvent,
  type LiveNotice,
  type NoticeTone,
  type Role,
  type ServerToClientEvents
} from '@tesseract/shared';
import { Order, type OrderDocument } from '../models/Order.js';
import { User } from '../models/User.js';
import { findOrderByToken, serializeOrder } from './orders.js';

interface SocketData {
  userId?: string;
  role?: Role;
  organization?: string | null;
  /** Track-join attempts on this connection, capped to stop token guessing. */
  joins: number;
}

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const MAX_TRACK_JOINS = 20;
const REF_RE = /^TP-[A-Z0-9]{4,12}$/;

let io: RealtimeServer | null = null;

const opsRoom = 'ops';
const orgRoom = (id: string) => `org:${id}`;
const orderRoom = (ref: string) => `order:${ref}`;

export function attachRealtime(app: FastifyInstance, origins: string[]): void {
  const server: RealtimeServer = new Server(app.server, {
    path: REALTIME_PATH,
    serveClient: false,
    cors: { origin: origins },
    // The console sends a bearer token; nothing here relies on cookies.
    cookie: false
  });

  // Signed-in users are identified from their console token. Anyone else may connect,
  // but can only follow an order whose tracking token they hold.
  server.use(async (socket, next) => {
    socket.data.joins = 0;
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token) {
      try {
        const payload = app.jwt.verify<{ sub: string; role: Role }>(token);
        const user = await User.findById(payload.sub).select('role organization active');
        if (user?.active) {
          socket.data.userId = user._id;
          socket.data.role = user.role;
          socket.data.organization = user.organization ?? null;
        }
      } catch {
        // Expired or forged token: carry on as an anonymous socket.
      }
    }
    next();
  });

  server.on('connection', (socket) => {
    const { role, organization } = socket.data;
    if (role === 'operator') void socket.join(opsRoom);
    else if (role && organization) void socket.join(orgRoom(organization));

    socket.on('track:join', async (input, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        socket.data.joins += 1;
        if (socket.data.joins > MAX_TRACK_JOINS) return reply({ ok: false, error: 'Too many attempts. Reload the page.' });
        const ref = String(input?.ref ?? '').toUpperCase();
        const token = String(input?.token ?? '');
        if (!REF_RE.test(ref) || !token || token.length > 100) return reply({ ok: false, error: 'Invalid tracking link.' });
        const order = await findOrderByToken(ref, token);
        if (!order) return reply({ ok: false, error: 'Invalid tracking link.' });
        await socket.join(orderRoom(ref));
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: 'Could not follow this order.' });
      }
    });

    socket.on('track:leave', (input) => {
      const ref = String(input?.ref ?? '').toUpperCase();
      if (REF_RE.test(ref)) void socket.leave(orderRoom(ref));
    });
  });

  // Close open sockets first, or long-lived connections would hold the server open on shutdown.
  app.addHook('preClose', (done) => {
    server.local.disconnectSockets(true);
    io = null;
    done();
  });

  io = server;
}

function notice(tone: NoticeTone, title: string, body: string, ref?: string, link?: string): LiveNotice {
  return { id: randomUUID(), tone, title, body, ref, link, at: new Date().toISOString() };
}

export type OrderEvent = 'created' | 'paid' | 'status' | 'dispatch' | 'update';

/** What each audience should be told about, beyond the order itself. */
function noticesFor(order: OrderDocument, event: OrderEvent): { ops?: LiveNotice; org?: LiveNotice } {
  const ref = order.ref;
  const where = `${order.delivery.recipientName}, ${order.delivery.area}`;
  const opsLink = `/console/ops/orders/${ref}`;
  const orgLink = `/console/orders/${ref}`;

  if (event === 'paid') {
    return { ops: notice('success', `New paid order ${ref}`, `${order.title} · ${where} · ${formatNaira(order.quote.total)}`, ref, opsLink) };
  }
  if (event === 'created' && order.channel === 'enterprise') {
    return {
      ops: notice('success', `New account order ${ref}`, `${order.title} · ${where}`, ref, opsLink),
      org: notice('info', `Order ${ref} placed`, `${order.title} is in the print room queue.`, ref, orgLink)
    };
  }
  if (event === 'status') {
    const label = statusLabel(order.status);
    if (order.status === 'out_for_delivery') {
      const rider = order.dispatch ? ` with ${order.dispatch.riderName}` : '';
      return { org: notice('info', `${ref} is on its way`, `${order.title} left the print room${rider}.`, ref, orgLink) };
    }
    if (order.status === 'delivered') {
      return {
        ops: notice('success', `${ref} delivered`, `Handed to ${where}.`, ref, opsLink),
        org: notice('success', `${ref} delivered`, `${order.title} was handed to ${order.delivery.recipientName}.`, ref, orgLink)
      };
    }
    if (order.status === 'cancelled') {
      return {
        ops: notice('warning', `${ref} cancelled`, order.title, ref, opsLink),
        org: notice('warning', `${ref} cancelled`, `${order.title} was cancelled.`, ref, orgLink)
      };
    }
    return { org: notice('info', `${ref}: ${label}`, order.title, ref, orgLink) };
  }
  if (event === 'update') {
    const latest = order.updates[order.updates.length - 1];
    return latest ? { org: notice('info', `Update on ${ref}`, latest.message, ref, orgLink) } : {};
  }
  return {};
}

/** Pushes an order's new state to everyone entitled to see it. Never throws. */
export async function publishOrder(order: OrderDocument, event: OrderEvent): Promise<void> {
  const server = io;
  if (!server) return;
  try {
    const full = (await Order.findById(order._id).select('+handoverCode')) ?? order;
    const notices = noticesFor(full, event);

    server.to(opsRoom).emit('order', { order: serializeOrder(full, { internal: true }) });
    if (notices.ops) server.to(opsRoom).emit('notify', notices.ops);

    if (full.organization) {
      server.to(orgRoom(full.organization)).emit('order', { order: serializeOrder(full, { includeHandover: true }) });
      if (notices.org) server.to(orgRoom(full.organization)).emit('notify', notices.org);
    }

    server.to(orderRoom(full.ref)).emit('order', { order: serializeOrder(full, { includeHandover: true }) });
  } catch (err) {
    console.warn('realtime publish failed', (err as Error).message);
  }
}

/** Tells the print room and the invoice's organisation that an invoice changed. Never throws. */
export function publishInvoice(invoice: InvoiceEvent & { organization: string; organizationName: string; total: number }, kind: 'issued' | 'paid' | 'void'): void {
  const server = io;
  if (!server) return;
  try {
    const payload: InvoiceEvent = { number: invoice.number, status: invoice.status };
    server.to(opsRoom).emit('invoice', payload);
    server.to(orgRoom(invoice.organization)).emit('invoice', payload);
    if (kind === 'paid') {
      server.to(opsRoom).emit('notify', notice('success', `Invoice ${invoice.number} paid`, `${invoice.organizationName} · ${formatNaira(invoice.total)}`, invoice.number, `/console/ops/invoices/${invoice.number}`));
      server.to(orgRoom(invoice.organization)).emit('notify', notice('success', `Invoice ${invoice.number} paid`, `Thank you. ${formatNaira(invoice.total)} received.`, invoice.number, `/console/billing/${invoice.number}`));
    } else if (kind === 'issued') {
      server.to(orgRoom(invoice.organization)).emit('notify', notice('info', `New invoice ${invoice.number}`, `${formatNaira(invoice.total)} for last month’s orders.`, invoice.number, `/console/billing/${invoice.number}`));
    }
  } catch (err) {
    console.warn('realtime publish failed', (err as Error).message);
  }
}
