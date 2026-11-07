// 의심 신호 1 프로브: 브라우저 마우스 1초 홀드 시 탄약 변화와 메인 스레드 상태를 페이지 안에서 샘플링한다.
// 왕복 지연(Playwright evaluate)에 흔들리지 않도록 샘플은 페이지 setInterval이 기록하고, 홀드 구간은 페이지 시각으로 자른다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, enterCombat, snap, sleep, toScreenX, toScreenY } from './lib-d.mjs';

const OUT = path.resolve(import.meta.dirname, '..');
const WEAPON = process.argv[2] || 'shotgun';
const { browser, page, pageErrors, consoleErrors } = await launch();

const picked = await enterCombat(page, { nickname: `PROBE-${WEAPON}`, weapon: WEAPON, shot: null });
let s = await snap(page);
const tgt = s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
const mx = tgt ? toScreenX(tgt.aimX) : 720;
const my = tgt ? toScreenY(tgt.aimY) : 450;
await page.mouse.move(mx, my);
await sleep(300);

// 페이지 안 샘플러: rAF 프레임 수, 50ms마다 탄약·발사 상태
await page.evaluate(() => {
  window.__qa = { raf: 0, samples: [] };
  const loop = () => { window.__qa.raf += 1; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__qa.iv = setInterval(() => {
    const s = window.__BEER_DEBUG__?.snapshot();
    if (!s) return;
    const p = s.players[0];
    window.__qa.samples.push({ t: performance.now(), ammo: p.ammo, reloading: p.isReloading, score: p.score, phase: s.phase, sel: s.selection.kind });
  }, 50);
});

const before = (await snap(page)).players[0].ammo;
const t0 = await page.evaluate(() => { window.__qa.raf0 = window.__qa.raf; return performance.now(); });
await page.mouse.down();
await sleep(1000);
await page.mouse.up();
const t1 = await page.evaluate(() => performance.now());
await sleep(400);
const data = await page.evaluate(() => {
  clearInterval(window.__qa.iv);
  return { raf: window.__qa.raf, raf0: window.__qa.raf0, samples: window.__qa.samples };
});
const win = data.samples.filter((x) => x.t >= t0 - 60 && x.t <= t1 + 400);
let drops = 0;
for (let i = 1; i < win.length; i++) if (win[i].ammo < win[i - 1].ammo) drops += win[i - 1].ammo - win[i].ammo;
const after = win.length ? win[win.length - 1].ammo : null;
const frames = data.raf - data.raf0;
const holdSec = ((t1 - t0) / 1000).toFixed(2);
const result = {
  weapon: WEAPON,
  picked,
  aimTarget: tgt ? { id: tgt.id, kind: tgt.kind, aimX: tgt.aimX, aimY: tgt.aimY } : null,
  mouse: { x: mx, y: my },
  holdSec: Number(holdSec),
  framesDuringHold: frames,
  fpsDuringHold: Number((frames / ((t1 - t0) / 1000)).toFixed(1)),
  ammoBefore: before,
  ammoAfter: after,
  ammoDrops: drops,
  ammoTrace: win.map((x) => `${Math.round(x.t - t0)}:${x.ammo}${x.reloading ? 'R' : ''}`),
  pageErrors,
  consoleErrors,
};
fs.writeFileSync(path.join(OUT, `probe-rapid-hold-${WEAPON}.json`), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(OUT, `probe-${WEAPON}-after-hold.png`) });
console.log(JSON.stringify({ picked, holdSec, fps: result.fpsDuringHold, ammoDrops: drops, trace: result.ammoTrace, pageErrors, consoleErrors: consoleErrors.length }, null, 1));
await browser.close();
