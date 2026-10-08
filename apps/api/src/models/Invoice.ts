import { Schema, model, type HydratedDocument } from 'mongoose';
import type { InvoicePaymentMethod, InvoiceStatus } from '@tesseract/shared';
import { transformOutput, uuidId, uuidRef } from './schema.js';

/** A snapshot of one order as billed, so the invoice never changes after it is issued. */
export interface InvoiceLine {
  order: string;
  ref: string;
  title: string;
  placedBy: string;
  createdAt: Date;
  total: number;
}

export interface IInvoice {
  _id: string;
  number: string;
  organization: string;
  /** The organisation's name when the invoice was issued. */
  organizationName: string;
  /** `<organization>:<YYYY-MM>` while the invoice stands, so a month is billed once. Freed when voided. */
  periodKey: string;
  period: { year: number; month: number };
  periodStart: Date;
  periodEnd: Date;
  lines: InvoiceLine[];
  /** Kobo. */
  total: number;
  currency: 'NGN';
  status: InvoiceStatus;
  billingEmail: string;
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  emailedAt?: Date;
  remindedAt?: Date;
  payment: {
    method?: InvoicePaymentMethod | null;
    provider?: string | null;
    reference?: string | null;
    checkoutId?: string | null;
    note?: string;
    recordedBy?: string;
  };
  /** Unlocks the public invoice page for whoever receives the email. */
  accessTokenHash?: string;
  accessTokenEnc?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    _id: uuidId,
    number: { type: String, required: true, unique: true },
    organization: { ...uuidRef('Organization'), required: true, index: true },
    organizationName: { type: String, required: true },
    periodKey: { type: String, required: true, unique: true },
    period: {
      year: { type: Number, required: true },
      month: { type: Number, required: true, min: 1, max: 12 }
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    lines: [
      {
        _id: false,
        order: uuidRef('Order'),
        ref: String,
        title: String,
        placedBy: { type: String, default: '' },
        createdAt: Date,
        total: Number
      }
    ],
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['open', 'paid', 'void'], default: 'open', index: true },
    billingEmail: { type: String, trim: true, lowercase: true, default: '' },
    issuedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    paidAt: Date,
    voidedAt: Date,
    voidReason: { type: String, trim: true },
    emailedAt: Date,
    remindedAt: Date,
    payment: {
      method: { type: String, enum: ['online', 'bank_transfer', 'other', null], default: null },
      provider: { type: String, default: null },
      reference: { type: String, default: null, index: true },
      checkoutId: { type: String, default: null, index: true },
      note: { type: String, trim: true, default: '' },
      recordedBy: { type: String, default: '' }
    },
    accessTokenHash: { type: String, select: false },
    accessTokenEnc: { type: String, select: false }
  },
  { timestamps: true, toJSON: { transform: transformOutput('accessTokenHash', 'accessTokenEnc') } }
);

invoiceSchema.index({ organization: 1, issuedAt: -1 });

export type InvoiceDocument = HydratedDocument<IInvoice>;
export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
