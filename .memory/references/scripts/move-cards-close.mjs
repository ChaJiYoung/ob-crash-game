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

  const startBtn = page.getByRole('button', { name: /마우스/ });
  await startBtn.waitFor({ state: 'visible', timeout: 8000 });
  await startBtn.click();
  await page.waitForTimeout(4000);

  const cardStats = await page.evaluate(() => {
    const map = window.__targetMeshMap;
    const cards = [];
    if (map) {
      map.forEach((mesh, id) => {
        // Move cards right in front of camera
        if (id.includes('weapon_select_revolver')) {
          mesh.position.set(0, 1.65, -0.5); // 2.7m in front of camera (z=2.2)
        } else if (id.includes('weapon_select_shotgun')) {
          mesh.position.set(-1.8, 1.65, -0.5);
        } else if (id.includes('weapon_select_gatling')) {
          mesh.position.set(1.8, 1.65, -0.5);
        }
        cards.push({ id, pos: mesh.position, visible: mesh.visible });
      });
    }
    return cards;
  });

  console.log('Cards moved close:', cardStats);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.memory/references/scripts/out/cards-moved-close.png' });
  console.log('Saved cards-moved-close.png');

  await browser.close();
}

run().catch(console.error);
