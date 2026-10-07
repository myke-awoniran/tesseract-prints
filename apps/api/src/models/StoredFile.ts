import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { FILE_TTL_SECONDS } from '@tesseract/shared';

export interface IStoredFile {
  order: Types.ObjectId;
  name: string;
  mime: string;
  size: number;
  iv: Buffer;
  authTag: Buffer;
  chunkCount: number;
  createdAt: Date;
}

// Metadata for an encrypted upload. The `expires` option creates a TTL index:
// MongoDB deletes the document automatically 24 hours after `createdAt`.
const storedFileSchema = new Schema<IStoredFile>({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  name: { type: String, required: true },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  iv: { type: Buffer, required: true },
  authTag: { type: Buffer, required: true },
  chunkCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: FILE_TTL_SECONDS }
});

export type StoredFileDocument = HydratedDocument<IStoredFile>;
export const StoredFile = model<IStoredFile>('StoredFile', storedFileSchema);
