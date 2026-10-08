import { Schema, model, type HydratedDocument } from 'mongoose';
import type { EmailStatus } from '@tesseract/shared';
import { transformOutput, uuidId, uuidRef } from './schema.js';

export interface IEmailLog {
  _id: string;
  to: string;
  subject: string;
  template: string;
  order?: string | null;
  orderRef?: string;
  status: EmailStatus;
  provider: string;
  providerId?: string;
  error?: string;
  html: string;
  text: string;
  at: Date;
}

// Every email the platform sends or tries to send, so the print room can see and resend them.
// Kept for 180 days.
const emailLogSchema = new Schema<IEmailLog>(
  {
    _id: uuidId,
    to: { type: String, required: true },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    order: { ...uuidRef('Order'), default: null, index: true },
    orderRef: String,
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    provider: { type: String, required: true },
    providerId: String,
    error: String,
    html: { type: String, select: false },
    text: { type: String, select: false },
    at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 }
  },
  { toJSON: { transform: transformOutput('html', 'text') } }
);

emailLogSchema.index({ at: -1 });

export type EmailLogDocument = HydratedDocument<IEmailLog>;
export const EmailLog = model<IEmailLog>('EmailLog', emailLogSchema);
