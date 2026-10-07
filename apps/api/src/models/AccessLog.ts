import { Schema, model, type Types } from 'mongoose';

export type AccessAction = 'file_downloaded' | 'status_changed' | 'file_erased';

export interface IAccessLog {
  order: Types.ObjectId;
  user?: Types.ObjectId | null;
  action: AccessAction;
  detail: string;
  ip?: string;
  at: Date;
}

// Permanent record of who touched an order's document and when.
const accessLogSchema = new Schema<IAccessLog>({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, enum: ['file_downloaded', 'status_changed', 'file_erased'], required: true },
  detail: { type: String, default: '' },
  ip: String,
  at: { type: Date, default: Date.now }
});

export const AccessLog = model<IAccessLog>('AccessLog', accessLogSchema);
