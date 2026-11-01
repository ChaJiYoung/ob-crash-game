import { createBeerCrusherServer } from './wsServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

async function start() {
  const instance = await createBeerCrusherServer({ port: PORT });
  console.log(`[BeerCrusherServer] WebSocket & HTTP server running on http://localhost:${instance.port}`);

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
