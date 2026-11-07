import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import os from 'node:os';

export const URL = 'https://127.0.0.1:5224/';
export const VW = 1440;
export const VH = 900;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const toScreenX = (aimX) => Math.round(((Math.max(-1, Math.min(1, aimX)) * 0.94 + 1) / 2) * VW);
export const toScreenY = (aimY) => Math.round(((1 - Math.max(-1, Math.min(1, aimY)) * 0.84) / 2) * VH);

export async function launch(viewport = { width: VW, height: VH }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=metal', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  return { browser, page, pageErrors, consoleErrors };
}

export async function snap(page) {
  return page.evaluate(() => window.__BEER_DEBUG__?.snapshot() ?? null);
}

export async function measureRaf1s(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      let count = 0;
      const start = performance.now();
      function step() {
        count++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(step);
        } else {
          resolve(count);
        }
      }
      requestAnimationFrame(step);
    });
  });
}

export function getSystemLoad() {
  return {
    uptime: Math.round(os.uptime()),
    loadavg: os.loadavg().map((x) => Number(x.toFixed(2))),
  };
}

export async function enterCombat(page, { nickname, weapon = 'shotgun', shot }) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1500);

  // 1P 마우스 선택
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('마우스'));
    b?.click();
  });
  await sleep(800);

  // 닉네임 입력
  const input = page.locator('input[placeholder="닉네임 입력"]');
  if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill(nickname);
    await sleep(200);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.trim() === '확인');
      b?.click();
    });
    await sleep(800);
  }

  if (shot) await shot('01-lobby-ready');

  // 게임 시작 클릭
  await page.locator('[data-shootable="start"]').click();
  await sleep(1500);

  let picked = null;
  for (let i = 0; i < 80; i++) {
    const s = await snap(page);
    if (s?.selection?.kind === 'weapon') {
      const t =
        s.targets.find((x) => x.selectKind === 'weapon' && x.selectValue === weapon) ||
        s.targets.find((x) => x.selectKind === 'weapon');
      if (t) {
        if (shot) await shot('02-weapon-select');
        await page.mouse.move(toScreenX(t.aimX), toScreenY(t.aimY));
        await sleep(100);
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        picked = t.selectValue;
        await sleep(600);
      }
    } else if (s?.phase === 'PLAYING' && !s?.selection?.kind) {
      break;
    }
    await sleep(250);
  }

  return picked;
}
