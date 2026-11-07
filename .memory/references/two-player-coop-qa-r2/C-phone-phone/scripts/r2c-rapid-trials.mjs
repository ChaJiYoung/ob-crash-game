// R2 C-phone-phone · 5-1 누른 채 연사 판정 (폰 2대, 실제 브라우저 + 가짜 폰 WebSocket)
// 의심 신호 1 재확인: rapidFireHold:true를 1초 유지했을 때 탄약이 여러 발 줄었는지.
// 판정은 snapshot().players[i].ammo 샘플 시계열로만 한다.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const HERE = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/C-phone-phone';
const OUT_JSON = process.env.OUT_JSON || path.join(HERE, 'rapid-trials-results.json');
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const TRIALS = Number(process.env.TRIALS || 3);
const HOLD_MS = Number(process.env.HOLD_MS || 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
// DIAG=1: 5ms 간격 인터벌(연사 처리부)의 생성·정지·틱 횟수만 기록하는 관찰용 래퍼. 게임 코드는 건드리지 않는다.
if (process.env.DIAG === '1') {
  await ctx.addInitScript(() => {
    const ids = new Set();
    const origSet = window.setInterval.bind(window);
    const origClear = window.clearInterval.bind(window);
    window.__r2c = { set5: 0, clear5: 0, tick5: 0, events: [] };
    const push = (e) => { if (window.__r2c.events.length < 400) window.__r2c.events.push(e); };
    window.setInterval = function (cb, ms, ...rest) {
      if (ms === 5) {
        window.__r2c.set5 += 1;
        let id;
        id = origSet(function () { window.__r2c.tick5 += 1; return cb.apply(this, arguments); }, ms, ...rest);
        ids.add(id);
        push(['set5', Math.round(performance.now()), id]);
        return id;
      }
      return origSet(cb, ms, ...rest);
    };
    window.clearInterval = function (id) {
      if (ids.has(id)) { ids.delete(id); window.__r2c.clear5 += 1; push(['clear5', Math.round(performance.now()), id]); }
      return origClear(id);
    };
  });
}
const diag = () => (process.env.DIAG === '1' ? page.evaluate(() => ({ set5: window.__r2c.set5, clear5: window.__r2c.clear5, tick5: window.__r2c.tick5 })) : null);
page.on('pageerror', (e) => { errors.push(`PAGE ERROR: ${e.message}`); log('PAGE ERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(`CONSOLE ERROR: ${m.text()}`); log('CONSOLE ERROR', m.text()); } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const snap = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());

function phone(roomId, slot, nickname) {
  const ws = new WebSocket(WS);
  const deviceId = `r2c_rapid_${slot}_${Date.now()}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  ws.on('message', (raw) => {
    try { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR') { errors.push(`WS ERROR slot${slot}: ${m.code} ${m.message}`); log('WS ERROR', slot, m.code, m.message); } } catch {}
  });
  let last = { aimX: 0, aimY: 0 };
  const frame = (aimX, aimY, extra = {}) => {
    last = { aimX, aimY };
    send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, skillSnapTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  };
  return {
    ws, ready, frame,
    async join() { await ready; send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    async aimHold(aimX, aimY, ms, extra = {}) { const end = Date.now() + ms; while (Date.now() < end) { frame(aimX, aimY, extra); await sleep(30); } },
    async snapFire(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(50); frame(aimX, aimY); },
    last: () => last,
    close() { ws.close(); },
  };
}

const roomId = await page.waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 30000 }).then((h) => h.jsonValue());
log('room', roomId);
await sleep(800);
await page.getByText('📱 모바일').first().click(); await sleep(400);
await page.getByText('📱 모바일').nth(1).click(); await sleep(500);

const p1 = phone(roomId, 1, '블루폰');
const p2 = phone(roomId, 2, '오렌지폰');
await p1.join(); await p2.join(); await sleep(400);
await p1.zero(); await p2.zero(); await sleep(400);
await Promise.all([p1.aimHold(-0.2, 0, 800), p2.aimHold(0.2, 0, 800)]);
await p2.snapFire(0, 0); // 게임 시작 사격
await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]); // 카운트다운
let s = await snap();
// 무기 카드(selection.kind === 'weapon')가 뜰 때까지 기다린다. 카드가 없을 때 쏘면 선택이 안 된다.
let guard = 0;
while (!(s?.selection?.kind === 'weapon') && guard < 120) {
  await Promise.all([p1.aimHold(0, 0.8, 150), p2.aimHold(0, 0.8, 150)]);
  s = await snap();
  guard++;
}
log('weapon select shown', s?.phase, JSON.stringify(s?.selection), 'guard', guard);
const wt = (s.targets || []).filter((t) => t.selectKind === 'weapon');
log('weapon cards', wt.map((t) => `${t.selectValue}@(${t.aimX.toFixed(2)},${t.aimY.toFixed(2)}) owner=${t.ownerIndex}`).join(' | '));
// 1P는 왼쪽(aimX<0)에서 가장 왼쪽 카드, 2P는 오른쪽(aimX>0)에서 가장 오른쪽 카드를 사격
const leftCard = wt.filter((t) => t.aimX < 0).sort((a, b) => a.aimX - b.aimX)[0];
const rightCard = wt.filter((t) => t.aimX > 0).sort((a, b) => b.aimX - a.aimX)[0];
if (!leftCard || !rightCard) throw new Error('weapon cards not found on both sides');
await p1.aimHold(leftCard.aimX, leftCard.aimY, 300); await p1.snapFire(leftCard.aimX, leftCard.aimY);
await p2.aimHold(rightCard.aimX, rightCard.aimY, 300); await p2.snapFire(rightCard.aimX, rightCard.aimY);
// 선택 완료(selection.kind가 사라지고 PLAYING) 까지 대기. 조준은 각자 카드 위에 유지.
for (let i = 0; i < 60; i++) {
  s = await snap();
  if (s?.phase === 'PLAYING' && s?.selection?.kind === null) break;
  await Promise.all([p1.aimHold(leftCard.aimX, leftCard.aimY, 150), p2.aimHold(rightCard.aimX, rightCard.aimY, 150)]);
}
await sleep(500);
s = await snap();
log('combat state', s?.phase, JSON.stringify(s?.selection), 'paused', s?.isPaused, 'weapons', s?.players?.map((p) => `${p.weaponKind}/${p.weaponLevel}`).join(' , '));

// DIAG=1: 전투 화면에서 메인 스레드 여유를 잰다. 입력 없이 1초 동안 5ms 타이머와 rAF가 몇 번 도는지.
let mainThread = null;
if (process.env.DIAG === '1') {
  mainThread = await page.evaluate(() => new Promise((resolve) => {
    let timerTicks = 0; let frames = 0;
    const id = window.setInterval(() => { timerTicks += 1; }, 5);
    const t0 = performance.now();
    const raf = () => { frames += 1; if (performance.now() - t0 < 1000) requestAnimationFrame(raf); else { window.clearInterval(id); resolve({ timer5msPerSec: timerTicks, rafPerSec: frames }); } };
    requestAnimationFrame(raf);
  }));
  log('main thread (combat, idle 1s):', JSON.stringify(mainThread));
  // 같은 1초 동안 조준 프레임(사격 없음, 30ms 간격)을 흘려 보낸 경우
  const measure = page.evaluate(() => new Promise((resolve) => {
    let timerTicks = 0; let frames = 0;
    const id = window.setInterval(() => { timerTicks += 1; }, 5);
    const t0 = performance.now();
    const raf = () => { frames += 1; if (performance.now() - t0 < 1000) requestAnimationFrame(raf); else { window.clearInterval(id); resolve({ timer5msPerSec: timerTicks, rafPerSec: frames }); } };
    requestAnimationFrame(raf);
  }));
  const tStart = Date.now();
  while (Date.now() - tStart < 1000) { p1.frame(0.1, 0.1); await sleep(30); }
  mainThread = { idle: mainThread, withPhoneFrames30ms: await measure };
  log('main thread (combat, phone frames 1s):', JSON.stringify(mainThread.withPhoneFrames30ms));
}

const results = { mainThread, phaseAtTest: s?.phase, selectionAtTest: s?.selection, weapons: s?.players?.map((p) => ({ weaponKind: p.weaponKind, weaponLevel: p.weaponLevel, maxAmmo: p.maxAmmo })), trials: [] };

// 누른 채 연사: rapidFireHold true를 HOLD_MS 동안 30ms 간격으로 보내고, 그 사이 100ms마다 탄약 샘플
async function holdTrial(which, idx) {
  const me = which === 1 ? p1 : p2;
  const other = which === 1 ? p2 : p1;
  const beforeSnap = await snap();
  const before = beforeSnap.players[idx].ammo;
  const samples = [{ t: 0, ammo: before }];
  const diagBefore = await diag();
  const t0 = Date.now();
  let nextSample = 100;
  const end = t0 + HOLD_MS;
  // 대상 플레이어의 조준은 화면 가운데 근처, 상대는 빗나가는 방향
  me.frame(0, 0, { rapidFireHold: true });
  while (Date.now() < end) {
    me.frame(0, 0, { rapidFireHold: true });
    other.frame(-0.9, -0.9);
    await sleep(30);
    if (Date.now() - t0 >= nextSample) {
      const sn = await snap();
      samples.push({ t: Date.now() - t0, ammo: sn.players[idx].ammo });
      nextSample += 100;
    }
  }
  me.frame(0, 0, { rapidFireHold: false });
  await sleep(150);
  const after = (await snap()).players[idx].ammo;
  samples.push({ t: Date.now() - t0, ammo: after, note: 'after fireUp+150ms' });
  const diagAfter = await diag();
  return { which, before, after, spent: before - after, samples, diag: diagBefore ? { before: diagBefore, after: diagAfter } : undefined };
}

for (const [which, idx] of [[1, 0], [2, 1]]) {
  for (let k = 1; k <= TRIALS; k++) {
    // 반사: 탄약 회복 대기 (재장전 최대 대략 2초), 조준 유지
    await Promise.all([p1.aimHold(-0.6, 0.6, 600), p2.aimHold(0.6, -0.6, 600)]);
    const pre = await snap();
    if (pre.phase !== 'PLAYING' || pre.selection.kind !== null || pre.isPaused) {
      log('not in combat before trial — skip', pre.phase, JSON.stringify(pre.selection), pre.isPaused);
      results.trials.push({ which, trial: k, skipped: true, phase: pre.phase, selection: pre.selection });
      continue;
    }
    const r = await holdTrial(which, idx);
    log(`P${which} trial ${k}: before=${r.before} after=${r.after} spent=${r.spent} samples=${r.samples.map((x) => x.ammo).join(',')}`);
    results.trials.push({ which, trial: k, ...r });
    await sleep(1500);
  }
}

const endSnap = await snap();
results.finalPhase = endSnap.phase;
results.errorsCount = errors.length;
results.errors = errors;
if (process.env.DIAG === '1') results.diagEvents = await page.evaluate(() => window.__r2c.events);
fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
log('wrote', OUT_JSON);

p1.close(); p2.close();
await browser.close();
