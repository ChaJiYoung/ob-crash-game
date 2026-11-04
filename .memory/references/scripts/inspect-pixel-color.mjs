import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000);

  // Check WebGL canvas pixels around center
  const pixelInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;

    // Read pixel at center (width/2, height/2)
    const pixels = new Uint8Array(4 * 9); // 3x3 area
    const cx = Math.floor(canvas.width / 2);
    const cy = Math.floor(canvas.height / 2);
    gl.readPixels(cx - 1, cy - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      centerPixels: Array.from(pixels),
    };
  });

  console.log('Pixel Info at screen center:', pixelInfo);
  await browser.close();
}

run().catch(console.error);
