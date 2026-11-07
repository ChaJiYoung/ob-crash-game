// 냉각기 모델, 보스 경고 띠, 똥 포탄 장면만 다시 찍는다(capture-all은 수십 장을 덮어쓴다). 개발 서버가 켜져 있어야 한다.
import { chromium } from 'playwright';
import * as path from 'path';

const screensDir = path.join(process.cwd(), 'docs/screens');
const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
const shot = (name) => page.screenshot({ path: path.join(screensDir, name) });

await page.goto('https://localhost:5173/docs/monster-studio.html', { waitUntil: 'networkidle' });
for (const [kind, name] of [['boss', 'monster-06-boss-dispenser.png'], ['boss-king', 'monster-06b-boss-king.png']]) {
  await page.evaluate((k) => window.showMonster(k), kind);
  await page.waitForTimeout(1000);
  await shot(name);
}

await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('스마트폰 없이 PC'));
  btn?.click();
});
await page.waitForTimeout(1200);
await page.mouse.move(150, 760); // aim away so nothing is shot by accident

await page.evaluate(() => {
  const eng = window.__engine;
  eng.startGame({ withWeaponSelect: false });
  eng.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
  eng.startWave(5);
  eng.activeTargets = [];
  eng.spawnBossEncounter(performance.now());
});
await page.waitForTimeout(500);
await shot('play-boss-warning.png');
await page.waitForTimeout(2500);
await shot('play-wave5-boss-cooler.png');

await page.evaluate(() => {
  const eng = window.__engine;
  eng.startGame({ withWeaponSelect: false });
  eng.activeTargets = [];
  eng.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
  eng.spawnMonsterProjectile(performance.now(), 'boss', { thetaRad: 0.05, radiusM: 7.0 });
});
await page.waitForTimeout(200);
await shot('play-poop-shell.png');
await browser.close();
