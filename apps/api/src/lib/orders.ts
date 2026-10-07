import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { PDFDocument } from 'pdf-lib';
import {
  FILE_TTL_SECONDS,
  FINISHING_IDS,
  PAPER_SIZES,
  FULFILMENT_FLOW,
  computeQuote,
  isAcceptedFileType,
  statusLabel,
  zoneForArea,
  type Colour,
  type FinishingId,
  type OrderChannel,
  type OrderStatus,
  type OrderView,
  type PaperSize,
  type Sides
} from '@tesseract/shared';
import { Order, type IOrder, type OrderDocument } from '../models/Order.js';
import { AccessLog, type IAccessLog } from '../models/AccessLog.js';
import type { UserDocument } from '../models/User.js';
import { storeEncryptedFile, destroyFile } from './files.js';
import { orderRef, randomToken, sha256, handoverCode, safeEqual } from './crypto.js';
import { HttpError, badRequest, conflict } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export type Fields = Record<string, string | undefined>;

export interface Upload {
  name: string;
  mime: string;
  buffer: Buffer;
}

/** Reads every part of a multipart request: text fields plus at most one file. */
export async function readMultipart(req: FastifyRequest): Promise<{ fields: Fields; upload: Upload | null }> {
  const fields: Fields = {};
  let upload: Upload | null = null;
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (!upload && part.filename) upload = { name: part.filename, mime: part.mimetype, buffer };
    } else {
      fields[part.fieldname] = typeof part.value === 'string' ? part.value.trim() : '';
    }
  }
  return { fields, upload };
}

function str(v: string | undefined, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

function int(v: string | undefined): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : Number.NaN;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export interface OrderFields {
  title: string;
  name: string;
  email: string;
  phone: string;
  recipientName: string;
  address: string;
  area: string;
  instructions: string;
  colour: Colour;
  sides: Sides;
  paperSize: PaperSize;
  finishing: FinishingId;
  copies: number;
  pages: number;
}

export function validateOrderFields(fields: Fields): { value: OrderFields; errors: null } | { value: null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const colour = oneOf(fields.colour, ['mono', 'colour'] as const);
  const sides = oneOf(fields.sides, ['single', 'double'] as const);
  const paperSize = oneOf(fields.paperSize, PAPER_SIZES);
  const finishing = oneOf(fields.finishing, FINISHING_IDS);
  const copies = int(fields.copies);
  const pages = int(fields.pages);
  const name = str(fields.name, 120);
  const email = str(fields.email, 160).toLowerCase();
  const phone = str(fields.phone, 24);
  const address = str(fields.address, 400);
  const area = str(fields.area, 80);

  if (!name) errors.name = 'Enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number.';
  if (address.length < 6) errors.address = 'Enter the full delivery address.';
  if (!zoneForArea(area)) errors.area = 'Choose a delivery area from the list.';
  if (!colour) errors.colour = 'Choose black and white or colour.';
  if (!sides) errors.sides = 'Choose single- or double-sided.';
  if (!paperSize) errors.paperSize = 'Choose a paper size.';
  if (!finishing) errors.finishing = 'Choose a finishing option.';
  if (!(copies >= 1 && copies <= 500)) errors.copies = 'Copies must be between 1 and 500.';
  if (!Number.isNaN(pages) && !(pages >= 1 && pages <= 5000)) errors.pages = 'Pages must be between 1 and 5,000.';

  if (Object.keys(errors).length || !colour || !sides || !paperSize || !finishing) {
    return { value: null, errors };
  }
  return {
    errors: null,
    value: {
      title: str(fields.title, 140),
      name,
      email,
      phone,
      recipientName: str(fields.recipientName || fields.name, 120),
      address,
      area,
      instructions: str(fields.instructions, 500),
      colour,
      sides,
      paperSize,
      finishing,
      copies,
      pages
    }
  };
}

async function countPdfPages(buffer: Buffer): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}

/**
 * Validates an upload, encrypts the file, prices the job and creates the order.
 * Express orders wait for payment; enterprise orders are invoiced and go straight to the queue.
 */
export async function createOrder(input: {
  fields: Fields;
  upload: Upload | null;
  channel: OrderChannel;
  organization?: Types.ObjectId | null;
  user?: UserDocument | null;
}): Promise<{ order: OrderDocument; accessToken: string }> {
  const { fields, upload, channel, organization = null, user = null } = input;
  if (!upload) throw badRequest('Attach the document you want printed.', { file: 'Attach a document.' });
  if (!isAcceptedFileType(upload.mime)) {
    throw new HttpError(415, 'This file type is not supported. Upload a PDF, Word document, PNG or JPEG.');
  }
  if (upload.buffer.length === 0) throw badRequest('The file is empty.', { file: 'The file is empty.' });

  const result = validateOrderFields(fields);
  if (result.errors) throw badRequest('Some details need attention.', result.errors);
  const value = result.value;

  let pages = value.pages;
  if (upload.mime === 'application/pdf') pages = (await countPdfPages(upload.buffer)) ?? pages;
  if (!(pages >= 1)) throw badRequest('Enter the number of pages.', { pages: 'Enter the number of pages.' });

  const zone = zoneForArea(value.area);
  if (!zone) throw badRequest('Choose a delivery area from the list.', { area: 'Choose a delivery area from the list.' });

  const options = {
    colour: value.colour,
    sides: value.sides,
    paperSize: value.paperSize,
    finishing: value.finishing,
    copies: value.copies,
    pages
  };
  const quote = computeQuote({ ...options, zone: zone.id });

  const orderId = new Types.ObjectId();
  const stored = await storeEncryptedFile({ orderId, name: upload.name, mime: upload.mime, buffer: upload.buffer });
  const fileExpiresAt = new Date(stored.createdAt.getTime() + FILE_TTL_SECONDS * 1000);

  const isEnterprise = channel === 'enterprise';
  const firstStatus: OrderStatus = isEnterprise ? 'queued' : 'awaiting_payment';
  const accessToken = randomToken();

  const base: Omit<IOrder, 'ref' | 'createdAt' | 'updatedAt'> & { _id: Types.ObjectId } = {
    _id: orderId,
    channel,
    organization,
    createdBy: user?._id ?? null,
    title: value.title || upload.name,
    customer: { name: value.name, email: value.email, phone: value.phone },
    delivery: {
      recipientName: value.recipientName || value.name,
      address: value.address,
      area: value.area,
      zone: zone.id,
      instructions: value.instructions
    },
    options,
    quote,
    payment: isEnterprise ? { status: 'invoiced', provider: 'invoice' } : { status: 'pending' },
    status: firstStatus,
    timeline: [{ status: firstStatus, at: new Date(), note: isEnterprise && user ? `Placed by ${user.name}` : '' }],
    file: { id: stored._id, name: upload.name, mime: upload.mime, size: upload.buffer.length },
    fileExpiresAt,
    accessTokenHash: sha256(accessToken),
    handoverCode: isEnterprise ? handoverCode() : undefined
  };

  for (let attempt = 0; ; attempt += 1) {
    try {
      const order = await Order.create({ ...base, ref: orderRef() });
      return { order, accessToken };
    } catch (err) {
      const duplicate = (err as { code?: number }).code === 11000;
      if (duplicate && attempt < 3) continue;
      await destroyFile(stored._id);
      throw err;
    }
  }
}

export async function findOrderByToken(ref: string, token: string, extraSelect = ''): Promise<OrderDocument | null> {
  if (!ref || !token) return null;
  const order = await Order.findOne({ ref: ref.toUpperCase() }).select(`+accessTokenHash ${extraSelect}`.trim());
  if (!order || !safeEqual(order.accessTokenHash, sha256(token))) return null;
  return order;
}

/** Marks an express order paid exactly once, even if the webhook and the return page race. */
export async function markPaid(orderId: Types.ObjectId, provider: string): Promise<void> {
  await Order.updateOne(
    { _id: orderId, 'payment.status': { $ne: 'paid' }, status: 'awaiting_payment' },
    {
      $set: {
        'payment.status': 'paid',
        'payment.provider': provider,
        'payment.paidAt': new Date(),
        status: 'queued',
        handoverCode: handoverCode()
      },
      $push: { timeline: { status: 'queued', note: 'Payment confirmed', at: new Date() } }
    }
  );
}

/** Moves an order forward through fulfilment. Delivery requires the recipient's handover code. */
export async function advanceStatus(
  order: OrderDocument,
  next: OrderStatus,
  ctx: { user?: UserDocument | null; note?: string; code?: string; ip?: string } = {}
): Promise<OrderDocument> {
  const { user = null, note = '', code = '', ip = '' } = ctx;
  const current = order.status;
  if (current === 'delivered' || current === 'cancelled') {
    throw conflict(`This order is already ${statusLabel(current).toLowerCase()}.`);
  }
  if (current === 'awaiting_payment' && next !== 'cancelled') throw conflict('This order has not been paid for yet.');

  if (next !== 'cancelled') {
    const from = FULFILMENT_FLOW.indexOf(current);
    const to = FULFILMENT_FLOW.indexOf(next);
    if (to === -1 || to <= from) {
      throw badRequest(`An order that is ${statusLabel(current).toLowerCase()} cannot move to ${statusLabel(next).toLowerCase()}.`);
    }
  }

  if (next === 'delivered') {
    const withCode = await Order.findById(order._id).select('+handoverCode');
    if (!code || !safeEqual(withCode?.handoverCode, code.trim())) {
      throw badRequest('That handover code does not match. Ask the recipient for the 6-digit code on their tracking page.');
    }
  }

  order.status = next;
  order.timeline.push({ status: next, note, at: new Date() });
  if (next === 'delivered') order.deliveredAt = new Date();

  const logs: Omit<IAccessLog, 'at'>[] = [
    { order: order._id, user: user?._id ?? null, action: 'status_changed', detail: `${current} → ${next}`, ip }
  ];
  if ((next === 'delivered' || next === 'cancelled') && order.file?.id && !order.fileDeletedAt) {
    await destroyFile(order.file.id);
    order.fileDeletedAt = new Date();
    logs.push({ order: order._id, user: user?._id ?? null, action: 'file_erased', detail: `Erased on ${next}`, ip });
  }

  await order.save();
  await AccessLog.insertMany(logs);
  return order;
}

export function fileIsAvailable(order: OrderDocument): boolean {
  return Boolean(order.file?.id) && !order.fileDeletedAt && Boolean(order.fileExpiresAt && order.fileExpiresAt > new Date());
}

export function serializeOrder(
  order: OrderDocument,
  { includeHandover = false, internal = false }: { includeHandover?: boolean; internal?: boolean } = {}
): OrderView {
  const view: OrderView = {
    ref: order.ref,
    channel: order.channel,
    title: order.title,
    status: order.status,
    statusLabel: statusLabel(order.status),
    timeline: order.timeline.map((t) => ({ status: t.status, label: statusLabel(t.status), at: t.at.toISOString(), note: t.note })),
    options: {
      colour: order.options.colour,
      sides: order.options.sides,
      paperSize: order.options.paperSize,
      finishing: order.options.finishing,
      copies: order.options.copies,
      pages: order.options.pages
    },
    quote: {
      currency: 'NGN',
      printing: order.quote.printing,
      finishing: order.quote.finishing,
      delivery: order.quote.delivery,
      sealing: order.quote.sealing,
      total: order.quote.total,
      sheets: order.quote.sheets
    },
    payment: { status: order.payment.status, paidAt: order.payment.paidAt?.toISOString() },
    delivery: {
      recipientName: order.delivery.recipientName,
      area: order.delivery.area,
      zone: order.delivery.zone,
      address: internal || order.channel === 'enterprise' ? order.delivery.address : undefined,
      instructions: internal ? order.delivery.instructions : undefined
    },
    file: {
      name: order.file?.name,
      size: order.file?.size,
      available: fileIsAvailable(order),
      expiresAt: order.fileExpiresAt?.toISOString(),
      erasedAt: order.fileDeletedAt?.toISOString()
    },
    createdAt: order.createdAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString()
  };
  if (internal) view.customer = { name: order.customer.name, email: order.customer.email, phone: order.customer.phone };
  if (includeHandover && order.handoverCode && order.status !== 'delivered' && order.status !== 'cancelled') {
    view.handoverCode = order.handoverCode;
  }
  return view;
}
