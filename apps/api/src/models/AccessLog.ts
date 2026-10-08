import { Schema, model } from 'mongoose';
import { transformOutput, uuidId, uuidRef } from './schema.js';

export type AccessAction = 'file_downloaded' | 'status_changed' | 'file_erased' | 'update_posted' | 'rider_assigned' | 'email_resent';

export interface IAccessLog {
  _id: string;
  order: string;
  user?: string | null;
  action: AccessAction;
  detail: string;
  ip?: string;
  at: Date;
}

// Permanent record of who touched an order's document and when.
const accessLogSchema = new Schema<IAccessLog>(
  {
    _id: uuidId,
    order: { ...uuidRef('Order'), required: true, index: true },
    user: { ...uuidRef('User'), default: null },
    action: { type: String, enum: ['file_downloaded', 'status_changed', 'file_erased', 'update_posted', 'rider_assigned', 'email_resent'], required: true },
    detail: { type: String, default: '' },
    ip: String,
    at: { type: Date, default: Date.now, index: true }
  },
  { toJSON: { transform: transformOutput() } }
);

export const AccessLog = model<IAccessLog>('AccessLog', accessLogSchema);
