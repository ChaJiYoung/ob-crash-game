import { spawn } from 'child_process';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function waitPort(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`https://localhost:${port}`);
      if (res.ok || res.status === 404 || res.status === 200) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Port ${port} did not respond within ${timeoutMs}ms`);
}

async function main() {
  console.log('Starting server and dev...');
  const serverProc = spawn('npm', ['run', 'server'], { cwd: rootDir, stdio: 'inherit' });
  const devProc = spawn('npm', ['run', 'dev'], { cwd: rootDir, stdio: 'inherit' });

  const cleanup = () => {
    try { serverProc.kill('SIGTERM'); } catch {}
    try { devProc.kill('SIGTERM'); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  try {
    await waitPort(5173, 15000);
    console.log('Vite dev server is ready.');

    const browser = await chromium.launch();

    // 1. 1440x900
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      await page.goto('https://localhost:5173');
      await page.waitForSelector('[data-testid="qr-pairing-modal-container"]', { timeout: 10000 });
      // wait for QR rendering & animation
      await page.waitForTimeout(1500);

      const box = await page.locator('[data-testid="qr-pairing-modal-container"]').boundingBox();
      console.log('1440x900 modal box:', box);
      if (!box || box.y + box.height > 900) {
        throw new Error(`Modal overflowed in 1440x900! bottom = ${box ? box.y + box.height : 'null'}`);
      }

      const outPath = path.resolve(rootDir, '.memory/references/two-player-coop-screens/T04-lobby-1440.png');
      await page.screenshot({ path: outPath });
      console.log('Captured 1440x900 to:', outPath);
      await context.close();
    }

    // 2. 1024x768
    {
      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      await page.goto('https://localhost:5173');
      await page.waitForSelector('[data-testid="qr-pairing-modal-container"]', { timeout: 10000 });
      await page.waitForTimeout(1500);

      const box = await page.locator('[data-testid="qr-pairing-modal-container"]').boundingBox();
      console.log('1024x768 modal box:', box);
      if (!box || box.y + box.height > 768) {
        throw new Error(`Modal overflowed in 1024x768! bottom = ${box ? box.y + box.height : 'null'}`);
      }

      const outPath = path.resolve(rootDir, '.memory/references/two-player-coop-screens/T04-lobby-1024.png');
      await page.screenshot({ path: outPath });
      console.log('Captured 1024x768 to:', outPath);
      await context.close();
    }

    await browser.close();
    console.log('All captures successful!');
  } finally {
    cleanup();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
