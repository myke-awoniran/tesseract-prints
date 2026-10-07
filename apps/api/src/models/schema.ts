import { randomUUID } from 'node:crypto';

/** Every collection uses a UUID string as its `_id` instead of an ObjectId. */
export const uuidId = { type: String, default: () => randomUUID() };

/** Reference to another collection's UUID `_id`. */
export function uuidRef(ref: string) {
  return { type: String, ref };
}

type Output = Record<string, unknown>;

/**
 * Shapes what leaves the API: `_id` becomes `id`, `__v` is dropped, and any listed
 * secret fields are removed even if a query selected them.
 */
export function transformOutput(...hidden: string[]) {
  return (_doc: unknown, ret: Output): Output => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    for (const field of hidden) delete ret[field];
    return ret;
  };
}
