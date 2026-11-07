// R2 C-phone-phone · C-01(로비 두 폰 준비) · 5-3(로비 경계 1440x900/1024x768) · 5-2(총구 조준 3조합, 2인) · 난이도 메모(몬스터 maxHp, 2인 vs 1인)
// MODE=coop : 폰 2대. 로비 캡처, 경계, 전투 진입 후 총구 조합 캡처, maxHp 샘플
// MODE=solo : 폰 1대(1P). 전투 진입 후 maxHp 샘플만(난이도 비교용)
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const MODE = process.env.MODE || 'coop';
const HERE = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/C-phone-phone';
const OUT_JSON = path.join(HERE, MODE === 'coop' ? 'lobby-aim-results.json' : 'solo-hp-results.json');
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);
const errors = []; const pageErrors = [];
const out = { mode: MODE, steps: {} };

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
page.on('pageerror', (e) => { pageErrors.push(e.message); errors.push(`PAGE ERROR: ${e.message}`); log('PAGE ERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(`CONSOLE ERROR: ${m.text()}`); log('CONSOLE ERROR', m.text().slice(0, 200)); } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
const snap = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
const shot = async (name) => { await page.screenshot({ path: path.join(HERE, `${name}.png`) }); log('shot', name); };

// 화면 밖 요소 검사(5-3)
const boundaryJs = () => {
  const vw = window.innerWidth; const vh = window.innerHeight; const out = [];
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], div, span, p, h1, h2, h3'))) {
    const txt = (el.innerText || '').trim();
    if (!txt || txt.length > 60) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) out.push({ text: txt.slice(0, 40), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
  }
  return { vw, vh, offscreenCount: out.length, offscreen: out.slice(0, 25) };
};

function phone(roomId, slot, nickname) {
  const deviceId = `r2c_lobby_${slot}_${Date.now()}`;
  let ws = null;
  const open = () => { ws = new WebSocket(WS); ws.on('message', (raw) => { try { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR') { errors.push(`WS ERROR slot${slot}: ${m.code} ${m.message}`); log('WS ERROR', slot, m.code, m.message); } } catch {} }); return new Promise((res) => ws.on('open', res)); };
  const send = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
  const frame = (aimX, aimY, extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, skillSnapTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  return {
    frame,
    async join() { await open(); send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    async hold(aimX, aimY, ms, extra = {}) { const e = Date.now() + ms; while (Date.now() < e) { frame(aimX, aimY, extra); await sleep(30); } },
    async snapFire(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(50); frame(aimX, aimY); },
    close() { if (ws) ws.close(); },
  };
}

const roomId = await page.waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 90000 }).then((h) => h.jsonValue());
log('room', roomId);
await sleep(800);
await page.getByText('📱 모바일').first().click(); await sleep(400);
if (MODE === 'coop') { await page.getByText('📱 모바일').nth(1).click(); await sleep(500); }
const p1 = phone(roomId, 1, '블루폰');
const p2 = MODE === 'coop' ? phone(roomId, 2, '오렌지폰') : null;
await p1.join(); if (p2) await p2.join(); await sleep(400);
await p1.zero(); if (p2) await p2.zero(); await sleep(500);
if (p2) await Promise.all([p1.hold(-0.2, 0, 800), p2.hold(0.2, 0, 800)]); else await p1.hold(-0.2, 0, 800);
if (MODE === 'coop') {
  out.steps.lobbyBoundary1440 = await page.evaluate(boundaryJs);
  await shot('C-01-lobby-both-phones-ready');
  await page.setViewportSize({ width: 1024, height: 768 }); await sleep(1000);
  out.steps.lobbyBoundary1024 = await page.evaluate(boundaryJs);
  await shot('C-5-3-lobby-1024x768');
  await page.setViewportSize({ width: 1440, height: 900 }); await sleep(800);
}
// 시작 사격 (1P 또는 2P 중 가운데 사격 — 두 폰 모두 준비된 상태)
await (p2 || p1).snapFire(0, 0);
let s = null;
for (let i = 0; i < 200; i++) {
  if (p2) await Promise.all([p1.hold(0, 0.8, 150), p2.hold(0, 0.8, 150)]); else await p1.hold(0, 0.8, 150);
  s = await snap();
  if (s?.selection?.kind === 'weapon') break;
}
const wt = (s.targets || []).filter((t) => t.selectKind === 'weapon');
const leftCard = wt.filter((t) => t.aimX < 0).sort((a, b) => a.aimX - b.aimX)[0];
const rightCard = wt.filter((t) => t.aimX > 0).sort((a, b) => b.aimX - a.aimX)[0];
if (p2) {
  await p1.hold(leftCard.aimX, leftCard.aimY, 300); await p1.snapFire(leftCard.aimX, leftCard.aimY);
  await p2.hold(rightCard.aimX, rightCard.aimY, 300); await p2.snapFire(rightCard.aimX, rightCard.aimY);
} else {
  const c = wt.filter((t) => t.ownerIndex === 0 || t.ownerIndex === null)[0] || wt[0];
  await p1.hold(c.aimX, c.aimY, 300); await p1.snapFire(c.aimX, c.aimY);
}
for (let i = 0; i < 80; i++) {
  s = await snap();
  if (s?.phase === 'PLAYING' && s?.selection?.kind === null) break;
  if (p2) await Promise.all([p1.hold(leftCard.aimX, leftCard.aimY, 150), p2.hold(rightCard.aimX, rightCard.aimY, 150)]);
  else await p1.hold(0, 0, 150);
}
s = await snap();
out.steps.combat = { phase: s.phase, selection: s.selection, weapons: s.players.map((p) => `${p.weaponKind}/${p.weaponLevel}`) };
log('combat', JSON.stringify(out.steps.combat));
if (s.phase !== 'PLAYING' || s.selection.kind !== null) throw new Error('combat not reached');

// 난이도 메모: 몬스터 maxHp 샘플(종류별 최대 maxHp, 같은 종류 중복 제거)
const hpByKind = {};
for (let i = 0; i < 6; i++) {
  const sn = await snap();
  for (const t of sn.targets || []) {
    const key = `${t.kind}${t.isGuarding ? '(guard)' : ''}${t.isItem ? '(item)' : ''}`;
    if (!hpByKind[key]) hpByKind[key] = new Set();
    hpByKind[key].add(t.maxHp);
  }
  await sleep(300);
}
out.steps.maxHpByKind = Object.fromEntries(Object.entries(hpByKind).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
out.steps.targetCountSample = (await snap()).targets.length;
log('maxHp', JSON.stringify(out.steps.maxHpByKind));

if (p2) {
  // 5-2 총구 조합 3가지 (두 총 축과 십자선 판정은 캡처로)
  await Promise.all([p1.hold(-0.7, 0.4, 1800), p2.hold(0.7, -0.3, 1800)]);
  await shot('C-5-2-aim-opposite');
  await Promise.all([p1.hold(0.6, 0.0, 1800), p2.hold(-0.6, 0.0, 1800)]);
  await shot('C-5-2-aim-cross');
  await Promise.all([p1.hold(0, 0, 1800), p2.hold(0, 0, 1800)]);
  await shot('C-5-2-aim-center');
  out.steps.aimCombos = 'captured: opposite (1P -0.7,0.4 / 2P 0.7,-0.3), cross (1P 0.6,0 / 2P -0.6,0), center (0,0 / 0,0)';
  const s2 = await snap();
  out.steps.afterAim = { phase: s2.phase, isPaused: s2.isPaused };
}

out.pageErrorsCount = pageErrors.length; out.errorsCount = errors.length; out.errors = errors;
fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
log('wrote', OUT_JSON, 'errors', errors.length);
p1.close(); if (p2) p2.close();
await browser.close();
