import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { MAX_FILE_BYTES, MAX_FILE_MB, type ApiErrorBody } from '@tesseract/shared';
import type { AppConfig } from './config.js';
import { HttpError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import consultationRoutes from './routes/consultations.js';
import expressRoutes from './routes/express.js';
import paymentRoutes from './routes/payments.js';
import trackRoutes from './routes/track.js';
import authRoutes from './routes/auth.js';
import enterpriseRoutes from './routes/enterprise.js';
import opsRoutes from './routes/ops.js';
import { setMailLogger } from './lib/email/mailer.js';

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.authorization'] },
    trustProxy: true,
    bodyLimit: 1024 * 1024
  });
  setMailLogger(app.log);

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } });
  await app.register(cors, { origin: config.corsOrigins });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 40, fieldSize: 4096 } });
  await app.register(authPlugin, { secret: config.jwtSecret });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if ('code' in err && err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ error: `Files can be up to ${MAX_FILE_MB} MB.` } satisfies ApiErrorBody);
    }
    if ('validation' in err && err.validation) {
      return reply
        .code(400)
        .send({ error: 'Some details need attention.', details: err.validation.map((v) => v.message ?? '') } satisfies ApiErrorBody);
    }
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    const body: ApiErrorBody = {
      error: status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : err.message,
      details: err instanceof HttpError ? err.details : undefined
    };
    return reply.code(status).send(body);
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(consultationRoutes);
      await api.register(expressRoutes);
      await api.register(paymentRoutes);
      await api.register(trackRoutes);
      await api.register(authRoutes);
      await api.register(enterpriseRoutes);
      await api.register(opsRoutes);
    },
    { prefix: '/api' }
  );

  const dist = config.webDist ? path.resolve(process.cwd(), config.webDist) : null;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    await app.register(fastifyStatic, { root: dist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.code(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
