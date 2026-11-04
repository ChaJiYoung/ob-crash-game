import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  console.log('Navigating to test mode (SANDBOX)...');
  await page.goto('https://localhost:5173/?mode=test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Spawn reward cards directly via engine in sandbox
  const spawnResult = await page.evaluate(() => {
    const eng = window.__engine;
    if (!eng) return 'No engine found';
    eng.spawnWaveRewardCards(performance.now(), false);
    return {
      activeTargets: eng.activeTargets.length,
      cards: eng.activeTargets.map(t => ({ id: t.id, kind: t.rewardCardKind, x: t.x, y: t.customBaseY, z: t.z }))
    };
  });
  console.log('Spawned Cards:', spawnResult);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.memory/references/scripts/out/sandbox-cards.png' });
  console.log('Saved sandbox-cards.png');

  await browser.close();
}

run().catch(console.error);
