// A-1-05 보류 확정: 마우스 1인, 스킬 재고가 생겼을 때 HUD 안내 문구("우클릭")가 나오는지 값으로 확인.
import { launch, newPage, sleep, log, snap, saveJson, normToScreen, shot, collected } from './lib-a.mjs';
const browser = await launch();
const { page } = await newPage(browser, { tag: 'skill-hint' });
await page.getByText('🖱 마우스').first().click({ timeout: 60000 }); await sleep(500);
await page.getByPlaceholder('닉네임 입력').fill('테스터A'); await sleep(200);
await page.getByText('확인', { exact: true }).click(); await sleep(800);
await page.locator('[data-shootable="start"]').click(); await sleep(900);
for (let i = 0; i < 30; i++) {
  const s = await snap(page);
  if (s.selection.kind === 'weapon') {
    const w = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
    const q = normToScreen(w.aimX, w.aimY); await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(800); continue;
  }
  break;
}
const rows = [];
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  const s = await snap(page);
  const txt = await page.evaluate(() => document.body.innerText);
  const hint = (txt.match(/우클릭[^\n]{0,8}/g) || []);
  const cd = (txt.match(/쿨다운[^\n]{0,10}/g) || []);
  rows.push({ t: Date.now() - t0, stock: s.players[0].skillStock, hint, cd, phase: s.phase, paused: s.isPaused });
  if (s.players[0].skillStock > 0) { await shot(page, 'A-1-05-skill-ready-hud'); break; }
  // 봇 사격으로 표적을 처치해 스킬 재고 확보
  const tg = s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
  if (tg) { const q = normToScreen(tg.aimX, tg.aimY); await page.mouse.move(q.x, q.y, { steps: 2 }); await page.mouse.down(); await sleep(70); await page.mouse.up(); }
  await sleep(300);
}
const stockReady = rows.find((r) => r.stock > 0);
saveJson('qa-a-skill-hint-values.json', { rows: rows.slice(-6), stockReadyRow: stockReady ?? null, errors: { pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors } });
await browser.close();
log('DONE skill hint', stockReady ?? 'no stock in 4 min');
