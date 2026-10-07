import type { preHandlerAsyncHookHandler, onRequestAsyncHookHandler } from 'fastify';
import type { Role } from '@tesseract/shared';
import type { UserDocument } from '../models/User.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Verifies the bearer token and loads the active user onto `request.currentUser`. */
    authenticate: onRequestAsyncHookHandler;
    /** Rejects requests whose user does not hold one of the given roles. */
    requireRole: (...roles: Role[]) => preHandlerAsyncHookHandler;
  }
  interface FastifyRequest {
    currentUser: UserDocument | null;
    rawBody?: Buffer;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}
