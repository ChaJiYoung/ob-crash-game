import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000);

  const rotInfo = await page.evaluate(() => {
    const map = window.__targetMeshMap;
    const camera = window.__camera;
    const results = [];
    if (map) {
      map.forEach((mesh, id) => {
        results.push({
          id,
          pos: mesh.position,
          rot: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
          scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
          innerScale: { x: mesh.children[0]?.scale.x, y: mesh.children[0]?.scale.y, z: mesh.children[0]?.scale.z },
          innerRot: { x: mesh.children[0]?.rotation.x, y: mesh.children[0]?.rotation.y, z: mesh.children[0]?.rotation.z },
          visible: mesh.visible,
          parent: mesh.parent?.type,
        });
      });
    }
    return { cameraPos: camera.position, cameraRot: camera.rotation, results };
  });

  console.log('Rotation & Scale Info:', JSON.stringify(rotInfo, null, 2));
  await browser.close();
}

run().catch(console.error);
