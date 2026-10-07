import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    ok: true,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  }));
}
