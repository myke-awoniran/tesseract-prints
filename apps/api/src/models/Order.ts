import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  FINISHING_IDS,
  ORDER_STATUS_IDS,
  PAPER_SIZES,
  type OrderChannel,
  type OrderStatus,
  type PaymentStatus,
  type PrintOptions,
  type Quote,
  type ZoneId
} from '@tesseract/shared';
import { transformOutput, uuidId, uuidRef } from './schema.js';

export interface TimelineEntry {
  status: OrderStatus;
  at: Date;
  note: string;
}

export interface DeliveryUpdate {
  _id: string;
  at: Date;
  message: string;
  by: string;
}

export interface Dispatch {
  riderName: string;
  riderPhone: string;
  eta?: Date | null;
  assignedAt: Date;
}

export interface IOrder {
  _id: string;
  ref: string;
  channel: OrderChannel;
  organization: string | null;
  createdBy: string | null;
  title: string;
  customer: { name: string; email: string; phone: string };
  delivery: { recipientName: string; address: string; area: string; zone: ZoneId; instructions: string };
  options: PrintOptions;
  quote: Quote;
  payment: { status: PaymentStatus; provider?: string | null; reference?: string | null; paidAt?: Date };
  status: OrderStatus;
  timeline: TimelineEntry[];
  file: { id?: string; name?: string; mime?: string; size?: number };
  fileExpiresAt?: Date;
  fileDeletedAt?: Date;
  handoverCode?: string;
  accessTokenHash?: string;
  /** The customer's tracking token, encrypted, so later emails can carry their private tracking link. */
  accessTokenEnc?: string;
  dispatch?: Dispatch | null;
  updates: DeliveryUpdate[];
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    _id: uuidId,
    ref: { type: String, required: true, unique: true },
    channel: { type: String, enum: ['express', 'enterprise'], required: true },
    organization: { ...uuidRef('Organization'), default: null },
    createdBy: { ...uuidRef('User'), default: null },
    title: { type: String, trim: true, default: '' },

    customer: {
      name: { type: String, trim: true, required: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true, required: true }
    },
    delivery: {
      recipientName: { type: String, trim: true, required: true },
      address: { type: String, trim: true, required: true },
      area: { type: String, trim: true, required: true },
      zone: { type: String, enum: ['central', 'inner', 'outer'], required: true },
      instructions: { type: String, trim: true, default: '' }
    },
    options: {
      colour: { type: String, enum: ['mono', 'colour'], required: true },
      sides: { type: String, enum: ['single', 'double'], required: true },
      paperSize: { type: String, enum: PAPER_SIZES, required: true },
      finishing: { type: String, enum: FINISHING_IDS, required: true },
      copies: { type: Number, min: 1, required: true },
      pages: { type: Number, min: 1, required: true }
    },
    quote: {
      currency: { type: String, default: 'NGN' },
      printing: Number,
      finishing: Number,
      delivery: Number,
      sealing: Number,
      minimumTopUp: { type: Number, default: 0 },
      total: Number,
      sheets: Number
    },
    payment: {
      status: { type: String, enum: ['pending', 'paid', 'invoiced', 'failed'], default: 'pending' },
      provider: { type: String, default: null },
      reference: { type: String, default: null, index: true },
      paidAt: Date
    },
    status: { type: String, enum: ORDER_STATUS_IDS, required: true, index: true },
    timeline: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUS_IDS },
        at: { type: Date, default: Date.now },
        note: { type: String, default: '' }
      }
    ],
    file: {
      id: uuidRef('StoredFile'),
      name: String,
      mime: String,
      size: Number
    },
    fileExpiresAt: Date,
    fileDeletedAt: Date,
    handoverCode: { type: String, select: false },
    accessTokenHash: { type: String, select: false },
    accessTokenEnc: { type: String, select: false },
    dispatch: {
      type: {
        _id: false,
        riderName: { type: String, trim: true, required: true },
        riderPhone: { type: String, trim: true, required: true },
        eta: { type: Date, default: null },
        assignedAt: { type: Date, default: Date.now }
      },
      default: null
    },
    updates: [
      {
        _id: uuidId,
        at: { type: Date, default: Date.now },
        message: { type: String, trim: true, required: true },
        by: { type: String, default: '' }
      }
    ],
    deliveredAt: Date
  },
  { timestamps: true, toJSON: { transform: transformOutput('accessTokenHash', 'accessTokenEnc', 'handoverCode') } }
);

orderSchema.index({ organization: 1, createdAt: -1 });

export type OrderDocument = HydratedDocument<IOrder>;
export const Order = model<IOrder>('Order', orderSchema);
