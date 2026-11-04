import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000);

  const debugReport = await page.evaluate(() => {
    const scene = window.__scene;
    const camera = window.__camera;
    const map = window.__targetMeshMap;

    // 1. Hide the entire stage (brewery bar, floor, counter, walls)
    const stage = scene?.getObjectByName('BreweryStage3D');
    if (stage) stage.visible = false;

    // 2. Hide tap gun
    const gun = camera?.children.find(c => c.name === 'DraftTapGun3D');
    if (gun) gun.visible = false;

    const cards = [];
    if (map) {
      map.forEach((m, id) => {
        cards.push({
          id,
          pos: m.position,
          rot: m.rotation,
          scale: m.scale,
          visible: m.visible,
          childCount: m.children.length,
          firstChildName: m.children[0]?.name,
          grandChildren: m.children[0]?.children.map(c => ({
            name: c.name,
            geo: c.geometry?.type,
            mat: c.material?.type,
            color: c.material?.color?.getHexString ? c.material.color.getHexString() : null,
            visible: c.visible,
          })),
        });
      });
    }

    return {
      cardsCount: cards.length,
      cards,
      stageHidden: stage ? !stage.visible : false,
      gunHidden: gun ? !gun.visible : false,
    };
  });

  console.log('Debug Report:', JSON.stringify(debugReport, null, 2));

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.memory/references/scripts/out/debug-no-stage-no-gun.png' });
  console.log('Saved debug screenshot: .memory/references/scripts/out/debug-no-stage-no-gun.png');

  await browser.close();
}

run().catch(console.error);
