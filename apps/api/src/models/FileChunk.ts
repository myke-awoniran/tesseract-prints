import { Schema, model, type Types } from 'mongoose';
import { FILE_TTL_SECONDS } from '@tesseract/shared';

export interface IFileChunk {
  file: Types.ObjectId;
  n: number;
  data: Buffer;
  createdAt: Date;
}

// Encrypted file bytes, split into chunks below MongoDB's 16 MB document limit.
// Chunks carry their own TTL index so the bytes expire on the same 24-hour schedule as the metadata.
const fileChunkSchema = new Schema<IFileChunk>({
  file: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
  n: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, expires: FILE_TTL_SECONDS }
});

fileChunkSchema.index({ file: 1, n: 1 }, { unique: true });

export const FileChunk = model<IFileChunk>('FileChunk', fileChunkSchema);
