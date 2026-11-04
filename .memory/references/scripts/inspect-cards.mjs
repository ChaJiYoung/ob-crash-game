import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000); // 카운트다운 3초 후 카드 등장

  const info = await page.evaluate(() => {
    const eng = window.__engine;
    const targets = eng?.activeTargets || [];

    // Check all HTML elements with yellow background or card-like text
    const yellowElements = Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        return bg.includes('251, 191') || bg.includes('245, 158') || bg.includes('212, 175');
      })
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        text: el.innerText.slice(0, 30),
        rect: el.getBoundingClientRect(),
      }));

    return {
      activeTargets: targets.map((t) => ({
        id: t.id,
        kind: t.kind,
        x: t.x,
        y: t.customBaseY,
        z: t.z,
        weaponSelectKind: t.weaponSelectKind,
        rewardCardKind: t.rewardCardKind,
      })),
      yellowElements,
    };
  });

  console.log('Inspection Result:', JSON.stringify(info, null, 2));
  await browser.close();
}

run().catch(console.error);
