import type { FastifyInstance } from 'fastify';
import type { Types } from 'mongoose';
import type { LoginRequest, LoginResponse, OrganizationSummary, SessionResponse } from '@tesseract/shared';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { requireUser } from '../lib/request.js';

const INVALID = 'That email and password combination is not recognised.';

async function organizationSummary(id: Types.ObjectId | null): Promise<OrganizationSummary | null> {
  if (!id) return null;
  const org = await Organization.findById(id);
  return org ? { id: org._id.toString(), name: org.name } : null;
}

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginRequest }>(
    '/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string', maxLength: 160 }, password: { type: 'string', maxLength: 200 } }
        }
      }
    },
    async (req, reply) => {
      const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+passwordHash');
      if (!user || !user.active || !(await user.verifyPassword(req.body.password))) {
        return reply.code(401).send({ error: INVALID });
      }
      user.lastLoginAt = new Date();
      await user.save();
      const token = app.jwt.sign({ sub: user._id.toString(), role: user.role });
      const body: LoginResponse = { token, user: user.toPublic(), organization: await organizationSummary(user.organization) };
      return body;
    }
  );

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req): Promise<SessionResponse> => {
    const user = requireUser(req);
    return { user: user.toPublic(), organization: await organizationSummary(user.organization) };
  });
}
