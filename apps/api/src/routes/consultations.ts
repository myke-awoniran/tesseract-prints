import type { FastifyInstance } from 'fastify';
import type { ConsultationRequest } from '@tesseract/shared';
import { Consultation } from '../models/Consultation.js';

export default async function consultationRoutes(app: FastifyInstance) {
  app.post<{ Body: ConsultationRequest }>(
    '/consultations',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['name', 'institution', 'email'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 120 },
            institution: { type: 'string', minLength: 2, maxLength: 160 },
            email: { type: 'string', format: 'email', maxLength: 160 },
            phone: { type: 'string', maxLength: 24 },
            documentType: { type: 'string', maxLength: 80 },
            message: { type: 'string', maxLength: 2000 }
          }
        }
      }
    },
    async (req, reply) => {
      await Consultation.create(req.body);
      return reply.code(201).send({ ok: true });
    }
  );
}
