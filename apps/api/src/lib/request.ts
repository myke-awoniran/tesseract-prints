import type { FastifyRequest } from 'fastify';
import type { UserDocument } from '../models/User.js';
import { HttpError, unauthorized } from './errors.js';

/** The signed-in user. Only call from routes guarded by `app.authenticate`. */
export function requireUser(req: FastifyRequest): UserDocument {
  if (!req.currentUser) throw unauthorized();
  return req.currentUser;
}

/** The signed-in user's organisation id, for client routes. */
export function requireOrganization(req: FastifyRequest): string {
  const user = requireUser(req);
  if (!user.organization) throw new HttpError(403, 'Your account is not linked to an organisation.');
  return user.organization;
}
