import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { Role } from '@tesseract/shared';
import { User } from '../models/User.js';

export default fp<{ secret: string }>(async function authPlugin(app, opts) {
  await app.register(jwt, { secret: opts.secret, sign: { expiresIn: '8h' } });

  app.decorateRequest('currentUser', null);

  app.decorate('authenticate', async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Your session has ended. Sign in again.' });
    }
    const user = await User.findById(req.user.sub);
    if (!user || !user.active) {
      return reply.code(401).send({ error: 'This account is no longer active.' });
    }
    req.currentUser = user;
  });

  app.decorate('requireRole', function requireRole(...roles: Role[]) {
    return async function roleGuard(req: FastifyRequest, reply: FastifyReply) {
      if (!req.currentUser || !roles.includes(req.currentUser.role)) {
        return reply.code(403).send({ error: 'Your account does not have access to this area.' });
      }
    };
  });
});
