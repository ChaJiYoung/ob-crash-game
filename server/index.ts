import { createBeerCrusherServer } from './wsServer';
import { readConnectionGuardEnv } from './ConnectionGuard';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

async function start() {
  const guardEnv = readConnectionGuardEnv(process.env);
  const instance = await createBeerCrusherServer({
    port: PORT,
    maxConnPerIp: guardEnv.maxPerIp,
    maxConnTotal: guardEnv.maxTotal,
    allowedOrigin: guardEnv.allowedOrigin,
    trustProxy: guardEnv.trustProxy,
  });
  console.log(`[BeerCrusherServer] WebSocket & HTTP server running on http://localhost:${instance.port}`);
  console.log(
    `[BeerCrusherServer] guard: perIp=${guardEnv.maxPerIp ?? 60} total=${guardEnv.maxTotal ?? 300} origin=${guardEnv.allowedOrigin ?? '(any)'} trustProxy=${guardEnv.trustProxy}`
  );

  const shutdown = async () => {
    console.log('[BeerCrusherServer] Shutting down...');
    await instance.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[BeerCrusherServer] Startup error:', err);
  process.exit(1);
});
