import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';
import { StoredFile, type StoredFileDocument } from '../models/StoredFile.js';
import { FileChunk } from '../models/FileChunk.js';

const CHUNK_BYTES = 8 * 1024 * 1024;

export interface DecryptedFile {
  buffer: Buffer;
  name: string;
  mime: string;
  size: number;
}

/** Encrypts a document with AES-256-GCM and stores it in chunks that expire after 24 hours. */
export async function storeEncryptedFile(input: {
  orderId: string;
  name: string;
  mime: string;
  buffer: Buffer;
}): Promise<StoredFileDocument> {
  const { iv, authTag, ciphertext } = encryptBuffer(input.buffer, config.fileKey);
  const chunkCount = Math.max(1, Math.ceil(ciphertext.length / CHUNK_BYTES));
  const createdAt = new Date();
  const fileId = randomUUID();

  const chunks = Array.from({ length: chunkCount }, (_, n) => ({
    file: fileId,
    n,
    data: ciphertext.subarray(n * CHUNK_BYTES, (n + 1) * CHUNK_BYTES),
    createdAt
  }));

  try {
    await FileChunk.insertMany(chunks, { ordered: true });
    return await StoredFile.create({
      _id: fileId,
      order: input.orderId,
      name: input.name,
      mime: input.mime,
      size: input.buffer.length,
      iv,
      authTag,
      chunkCount,
      createdAt
    });
  } catch (err) {
    await FileChunk.deleteMany({ file: fileId });
    throw err;
  }
}

/** Returns the decrypted document, or null when it has expired or been erased. */
export async function readDecryptedFile(fileId: string | undefined): Promise<DecryptedFile | null> {
  if (!fileId) return null;
  const file = await StoredFile.findById(fileId);
  if (!file) return null;
  const chunks = await FileChunk.find({ file: file._id }).sort({ n: 1 });
  if (chunks.length !== file.chunkCount) return null;
  const ciphertext = Buffer.concat(chunks.map((c) => c.data));
  const buffer = decryptBuffer({ ciphertext, iv: file.iv, authTag: file.authTag }, config.fileKey);
  return { buffer, name: file.name, mime: file.mime, size: file.size };
}

/** Erases a document immediately (on delivery or cancellation, ahead of the TTL). */
export async function destroyFile(fileId: string | undefined): Promise<void> {
  if (!fileId) return;
  await Promise.all([FileChunk.deleteMany({ file: fileId }), StoredFile.deleteOne({ _id: fileId })]);
}
