import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { buildApp } from './app.js';

const app = await buildApp(config);

try {
  await connectDb({ info: (msg) => app.log.info(msg) });
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await disconnectDb();
    process.exit(0);
  });
}
