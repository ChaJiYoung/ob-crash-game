// QA-D 공통 헬퍼: 브라우저(Playwright 마우스) 쪽 1인 판 진입·좌표 변환·스냅샷 읽기.
// 좌표 변환은 src/pc/aimMapping.ts의 viewportRatioToAim 역변환을 따른다:
//   마우스 normX = aimX*0.94, normY = aimY*0.84 (CSS 뷰포트 기준, −1..1)
//   screenX = (normX+1)/2*W, screenY = (1-normY)/2*H
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';

export const URL = 'https://127.0.0.1:5204/';
// QA_VW/QA_VH로 1024×768 등 다른 뷰포트 실행 가능(기본 1440×900)
export const VW = Number(process.env.QA_VW || 1440);
export const VH = Number(process.env.QA_VH || 900);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const toScreenX = (aimX) => Math.round(((Math.max(-1, Math.min(1, aimX)) * 0.94 + 1) / 2) * VW);
export const toScreenY = (aimY) => Math.round(((1 - Math.max(-1, Math.min(1, aimY)) * 0.84) / 2) * VH);

// 화면 밖으로 나간(잘린) 보이는 텍스트 요소를 집계한다(5-3 경계 판정용).
export async function overflowScan(page) {
  return page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight, out = [];
    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      if (el.tagName === 'CANVAS' || el.closest('canvas')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const txt = (el.innerText || '').trim();
      if (!txt || el.children.length > 0 && Array.from(el.children).some((c) => (c.innerText || '').trim() === txt)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1;
      if (over) out.push({ text: txt.slice(0, 40), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], scrollable: el.scrollHeight > el.clientHeight + 2 });
    }
    return { W, H, count: out.length, items: out.slice(0, 25) };
  });
}

export async function launch(viewport = { width: VW, height: VH }) {
  const browser = await chromium.launch({
    headless: true,
    // 체크리스트의 --use-gl=swiftshader는 이 머신(부하 50+)에서 0.3fps까지 떨어져 측정 불가.
    // --use-angle=metal(하드웨어 GL)로 바꿔 같은 부하에서 약 40fps를 얻었다(QA-D 보고서 참고).
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

// 로비(1P 마우스) → 닉네임 → 게임 시작 → 무기 카드(weapon) 클릭 → PLAYING 대기
export async function enterCombat(page, { nickname, weapon = 'shotgun', shot }) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1500);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('마우스'));
    b?.click();
  });
  await sleep(800);
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
  if (shot) await shot('lobby-ready');
  await page.locator('[data-shootable="start"]').click();
  await sleep(1500);

  let picked = null;
  // 주의: 무기 선택 중에도 phase는 PLAYING이므로 selection으로 먼저 판단한다.
  for (let i = 0; i < 80; i++) {
    const s = await snap(page);
    if (s?.selection?.kind === 'weapon') {
      const t =
        s.targets.find((x) => x.selectKind === 'weapon' && x.selectValue === weapon) ||
        s.targets.find((x) => x.selectKind === 'weapon');
      if (t) {
        if (shot) await shot('weapon-select');
        await page.mouse.move(toScreenX(t.aimX), toScreenY(t.aimY));
        await sleep(100);
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        picked = t.selectValue;
        await sleep(600);
      }
    }
    else if (s?.phase === 'PLAYING' && !s?.selection?.kind) break;
    await sleep(250);
  }
  return picked;
}
