import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(2000);

  const cardDetails = await page.evaluate(() => {
    const map = window.__targetMeshMap;
    const camera = window.__camera;
    const results = [];
    if (map) {
      map.forEach((mesh, id) => {
        // Project center to screen NDC
        const v = mesh.position.clone();
        v.project(camera);
        const inner = mesh.children[0];
        results.push({
          id,
          pos: mesh.position,
          ndc: { x: v.x, y: v.y, z: v.z },
          innerChildrenCount: inner?.children.length,
          innerChildren: inner?.children.map(c => ({
            name: c.name,
            geometry: c.geometry?.type,
            material: c.material?.type,
            visible: c.visible,
            color: c.material?.color?.getHexString(),
            opacity: c.material?.opacity,
            map: !!c.material?.map,
          }))
        });
      });
    }
    return results;
  });

  console.log('Card details:', JSON.stringify(cardDetails, null, 2));

  await browser.close();
}

run().catch(console.error);
