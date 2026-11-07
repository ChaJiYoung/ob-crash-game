// R2 C-phone-phone · C-07 세부(혼자 계속하기 뒤 일시정지 해제 시점) · C-08(나감 상태 카드 라운드 자동 선택) · C-09(나감 뒤 재접속)
// 전투 진입을 확인한 뒤에만 진행. 판정 근거는 snapshot 시계열과 캡처.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const HERE = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/C-phone-phone';
const OUT_JSON = process.env.OUT_JSON || path.join(HERE, 'away-cardround-results.json');
const SHOOT_LIMIT_MS = Number(process.env.SHOOT_LIMIT_MS || 540000);
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);

const errors = [];
const pageErrors = [];
const out = { timeline: [], steps: {} };
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
page.on('pageerror', (e) => { pageErrors.push(e.message); errors.push(`PAGE ERROR: ${e.message}`); log('PAGE ERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(`CONSOLE ERROR: ${m.text()}`); log('CONSOLE ERROR', m.text().slice(0, 200)); } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const snap = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
const bodyText = () => page.evaluate(() => document.body.innerText);
const shot = async (name) => { await page.screenshot({ path: path.join(HERE, `${name}.png`) }); log('shot', name); };

function phone(roomId, slot, nickname) {
  const deviceId = `r2c_away_${slot}_${Date.now()}`;
  let ws = null;
  const open = () => {
    ws = new WebSocket(WS);
    ws.on('message', (raw) => { try { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR') { errors.push(`WS ERROR slot${slot}: ${m.code} ${m.message}`); log('WS ERROR', slot, m.code, m.message); } } catch {} });
    return new Promise((res) => ws.on('open', res));
  };
  const send = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
  const frame = (aimX, aimY, extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, skillSnapTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  return {
    frame,
    async join() { await open(); send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    close() { if (ws) ws.close(); ws = null; },
    async reconnect({ zero = true } = {}) { await open(); send({ type: 'DEVICE_CHECK', roomId, deviceId, slot }); await sleep(400); if (zero) { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true }); await sleep(400); } },
    async zeroResume() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true }); await sleep(400); },
    async hold(aimX, aimY, ms, extra = {}) { const e = Date.now() + ms; while (Date.now() < e) { frame(aimX, aimY, extra); await sleep(30); } },
    async snapFire(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(50); frame(aimX, aimY); },
  };
}

// ---- 셋업: 로비 → 시작 → 무기 선택 → 전투 ----
const roomId = await page.waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 90000 }).then((h) => h.jsonValue());
log('room', roomId);
await sleep(800);
await page.getByText('📱 모바일').first().click(); await sleep(400);
await page.getByText('📱 모바일').nth(1).click(); await sleep(500);
const p1 = phone(roomId, 1, '블루폰');
const p2 = phone(roomId, 2, '오렌지폰');
await p1.join(); await p2.join(); await sleep(400);
await p1.zero(); await p2.zero(); await sleep(400);
await Promise.all([p1.hold(-0.2, 0, 800), p2.hold(0.2, 0, 800)]);
await p2.snapFire(0, 0);
let s = null;
for (let i = 0; i < 200; i++) {
  await Promise.all([p1.hold(0, 0.8, 150), p2.hold(0, 0.8, 150)]);
  s = await snap();
  if (s?.selection?.kind === 'weapon') break;
}
const wt = (s.targets || []).filter((t) => t.selectKind === 'weapon');
const leftCard = wt.filter((t) => t.aimX < 0).sort((a, b) => a.aimX - b.aimX)[0];
const rightCard = wt.filter((t) => t.aimX > 0).sort((a, b) => b.aimX - a.aimX)[0];
await p1.hold(leftCard.aimX, leftCard.aimY, 300); await p1.snapFire(leftCard.aimX, leftCard.aimY);
await p2.hold(rightCard.aimX, rightCard.aimY, 300); await p2.snapFire(rightCard.aimX, rightCard.aimY);
for (let i = 0; i < 80; i++) {
  s = await snap();
  if (s?.phase === 'PLAYING' && s?.selection?.kind === null) break;
  await Promise.all([p1.hold(leftCard.aimX, leftCard.aimY, 150), p2.hold(rightCard.aimX, rightCard.aimY, 150)]);
}
s = await snap();
out.steps.combatEntered = { phase: s.phase, selection: s.selection, isPaused: s.isPaused, weapons: s.players.map((p) => `${p.weaponKind}/${p.weaponLevel}`) };
log('combat', JSON.stringify(out.steps.combatEntered));
if (s.phase !== 'PLAYING' || s.selection.kind !== null) throw new Error('combat not reached');
await p1.hold(-0.1, 0.05, 600); await p2.hold(0.1, 0.05, 600);

// ---- C-07 세부: 2P 끊김 → 혼자 계속하기 → 일시정지 해제 시점 시계열 ----
p2.close();
await page.locator('text=혼자 계속하기').first().waitFor({ timeout: 40000 }).catch(() => log('alone button not seen in 40s'));
const beforeAlone = await snap();
await page.getByText('혼자 계속하기').first().click();
const clickedAt = Date.now();
out.steps.C07 = { isPausedBeforeClick: beforeAlone.isPaused, p2AwayBeforeClick: beforeAlone.players[1].isAway, timeline: [] };
for (let i = 0; i < 40; i++) {
  await p1.hold(-0.1, 0.05, 250); // 1P 조준 유지, 사격 없음
  const sn = await snap();
  const txt = await bodyText();
  const row = {
    tSec: +((Date.now() - clickedAt) / 1000).toFixed(1),
    isPaused: sn.isPaused, p2Away: sn.players[1].isAway, phase: sn.phase,
    resumeMsg: txt.includes('게임 재개'), graceText: /재접속 대기 중/.test(txt),
    countdownNumber: (txt.match(/\b([123])\b/) || [])[1] ?? null,
  };
  out.timeline.push(row);
  if (!sn.isPaused && i > 4) break;
}
const lastRow = out.timeline[out.timeline.length - 1];
out.steps.C07.unpausedAtSec = lastRow.isPaused ? null : lastRow.tSec;
log('C-07 timeline last', JSON.stringify(lastRow), 'unpausedAtSec', out.steps.C07.unpausedAtSec);
await shot('C-07-2p-away-after-alone-click');

// ---- C-08: 나감 상태에서 카드 라운드 → 2P 몫 자동 선택 (1P가 웨이브 클리어까지 사격) ----
out.steps.C08 = { progress: [], cardRoundSeen: false };
const tShoot = Date.now();
let lastLog = 0;
while (Date.now() - tShoot < SHOOT_LIMIT_MS) {
  s = await snap();
  if (s.phase !== 'PLAYING') { out.steps.C08.stoppedPhase = s.phase; break; }
  if (s.selection.kind !== null) { out.steps.C08.cardRoundSeen = true; break; }
  const live = (s.targets || []).filter((t) => t.landed && !t.isItem && !t.selectKind);
  const tg = live.sort((a, b) => a.radiusM - b.radiusM)[0];
  if (tg) await p1.snapFire(tg.aimX, tg.aimY); else await p1.snapFire(0, 0);
  await sleep(120);
  if (Date.now() - lastLog > 20000) {
    lastLog = Date.now();
    const pr = (await bodyText()).match(/WAVE 진행도\s*\n\s*(\d+)\s*\/\s*(\d+)/);
    out.steps.C08.progress.push({ tSec: Math.round((Date.now() - tShoot) / 1000), wave: s.wave, progress: pr ? `${pr[1]}/${pr[2]}` : null, p1Score: s.players[0].score, p2Away: s.players[1].isAway, isPaused: s.isPaused });
    log('C-08 progress', JSON.stringify(out.steps.C08.progress.at(-1)));
  }
}
s = await snap();
out.steps.C08.elapsedSec = Math.round((Date.now() - tShoot) / 1000);
out.steps.C08.selectionAtStop = s.selection;
if (out.steps.C08.cardRoundSeen) {
  await sleep(600);
  s = await snap();
  out.steps.C08.selectionAfterShown = s.selection;
  out.steps.C08.p2AwayDuringCardRound = s.players[1].isAway;
  await shot('C-08-away-card-round');
  const cardTargets = (s.targets || []).filter((t) => t.selectKind === 'card');
  out.steps.C08.cardTargets = cardTargets.map((t) => ({ value: t.selectValue, aimX: +t.aimX.toFixed(2), aimY: +t.aimY.toFixed(2), owner: t.ownerIndex }));
  const mine = cardTargets.filter((t) => t.ownerIndex === 0 || t.ownerIndex === null);
  const pick = mine[0] || cardTargets[0];
  if (pick) {
    await p1.hold(pick.aimX, pick.aimY, 300);
    await p1.snapFire(pick.aimX, pick.aimY);
  }
  const tPick = Date.now();
  let after = null;
  for (let i = 0; i < 40; i++) {
    await p1.hold(pick ? pick.aimX : 0, pick ? pick.aimY : 0, 200);
    after = await snap();
    if (after.selection.kind === null) break;
  }
  out.steps.C08.afterPick = { selection: after?.selection, phase: after?.phase, waitedSec: Math.round((Date.now() - tPick) / 1000), p2Away: after?.players[1].isAway, isPaused: after?.isPaused };
  await shot('C-08-after-1p-pick');
}

// ---- C-09: 나감 뒤 2P 재접속 → 영점 없이 복귀? 십자선·총 복귀 ----
s = await snap();
out.steps.C09 = { awayBefore: s.players[1].isAway };
await p2.reconnect({ zero: false });
await sleep(1500);
s = await snap();
out.steps.C09.awayAfterReconnectNoZero = s.players[1].isAway;
if (s.players[1].isAway) { await p2.zeroResume(); await sleep(800); s = await snap(); out.steps.C09.awayAfterZeroResume = s.players[1].isAway; }
await p1.hold(-0.2, 0.1, 1000); await p2.hold(0.2, 0.1, 1000);
s = await snap();
out.steps.C09.final = { isAway: s.players[1].isAway, phase: s.phase, isPaused: s.isPaused };
await shot('C-09-reconnect-after-away');

const txtEnd = await bodyText();
out.steps.final = { phase: s.phase, isPaused: s.isPaused, p1: s.players[0].score, wave: s.wave, lives: s.lives, pausedMenuText: txtEnd.includes('재접속') };
out.pageErrorsCount = pageErrors.length;
out.errorsCount = errors.length;
out.errors = errors;
fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
log('wrote', OUT_JSON, 'errors', errors.length);
p1.close(); p2.close();
await browser.close();
