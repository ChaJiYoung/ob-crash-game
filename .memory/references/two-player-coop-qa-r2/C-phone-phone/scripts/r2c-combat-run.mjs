// R2 C-phone-phone · C-04 ~ C-10 (전투 중 끊김·재접속·나감·동시 끊김), 5-3 경계, 5-4 마우스 이동
// 무기 카드가 실제로 선택되어 PLAYING + selection.kind === null 인 것을 확인한 뒤에만 끊김을 시작한다.
// 판정 근거: snapshot() 값 + 화면 텍스트 + 캡처. 콘솔 에러·pageerror 전부 기록.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const HERE = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/C-phone-phone';
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);

const errors = [];
const pageErrors = [];
const steps = {};
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => { pageErrors.push(e.message); errors.push(`PAGE ERROR: ${e.message}`); log('PAGE ERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(`CONSOLE ERROR: ${m.text()}`); log('CONSOLE ERROR', m.text().slice(0, 200)); } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const snap = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
const bodyText = () => page.evaluate(() => document.body.innerText);
const shot = async (name) => { await page.screenshot({ path: path.join(HERE, `${name}.png`) }); log('shot', name); };

function phone(roomId, slot, nickname) {
  const deviceId = `r2c_combat_${slot}_${Date.now()}`;
  let ws = null;
  const open = () => {
    ws = new WebSocket(WS);
    ws.on('message', (raw) => { try { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR') { errors.push(`WS ERROR slot${slot}: ${m.code} ${m.message}`); log('WS ERROR', slot, m.code, m.message); } } catch {} });
    return new Promise((res) => ws.on('open', res));
  };
  const send = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
  const frame = (aimX, aimY, extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, skillSnapTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  return {
    frame, send,
    get open() { return ws && ws.readyState === 1; },
    async join() { await open(); send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    // 끊김: 소켓 close
    close() { if (ws) ws.close(); ws = null; },
    // 재접속: 새 소켓 + DEVICE_CHECK. zero=true면 CALIBRATE_ZERO(resume:true)까지 보낸다.
    async reconnect({ zero = true } = {}) { await open(); send({ type: 'DEVICE_CHECK', roomId, deviceId, slot }); await sleep(400); if (zero) { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true }); await sleep(400); } },
    // 같은 소켓으로 영점(resume) 재전송
    async zeroResume() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true }); await sleep(400); },
    async hold(aimX, aimY, ms, extra = {}) { const e = Date.now() + ms; while (Date.now() < e) { frame(aimX, aimY, extra); await sleep(30); } },
    async snapFire(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(50); frame(aimX, aimY); },
  };
}

// ---- 1. 로비 → 시작 → 무기 선택 → 전투 ----
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
await p2.snapFire(0, 0); // 로비 시작 사격
// 카운트다운: 카드가 뜰 때까지 조준만 유지
let s = null;
for (let i = 0; i < 200; i++) {
  await Promise.all([p1.hold(0, 0.8, 150), p2.hold(0, 0.8, 150)]);
  s = await snap();
  if (s?.selection?.kind === 'weapon') break;
}
log('weapon select shown', s?.phase, JSON.stringify(s?.selection));
const wt = (s.targets || []).filter((t) => t.selectKind === 'weapon');
const leftCard = wt.filter((t) => t.aimX < 0).sort((a, b) => a.aimX - b.aimX)[0];
const rightCard = wt.filter((t) => t.aimX > 0).sort((a, b) => b.aimX - a.aimX)[0];
steps.weaponCards = wt.map((t) => ({ kind: t.selectValue, aimX: +t.aimX.toFixed(2), aimY: +t.aimY.toFixed(2), owner: t.ownerIndex }));
await p1.hold(leftCard.aimX, leftCard.aimY, 300); await p1.snapFire(leftCard.aimX, leftCard.aimY);
await shot('C-03-weapon-select-after-1p-pick');
await p2.hold(rightCard.aimX, rightCard.aimY, 300); await p2.snapFire(rightCard.aimX, rightCard.aimY);
for (let i = 0; i < 80; i++) {
  s = await snap();
  if (s?.phase === 'PLAYING' && s?.selection?.kind === null) break;
  await Promise.all([p1.hold(leftCard.aimX, leftCard.aimY, 150), p2.hold(rightCard.aimX, rightCard.aimY, 150)]);
}
s = await snap();
steps.combatEntered = { phase: s.phase, selection: s.selection, isPaused: s.isPaused, weapons: s.players.map((p) => `${p.weaponKind}/${p.weaponLevel}`) };
log('combat entered', JSON.stringify(steps.combatEntered));
if (s.phase !== 'PLAYING' || s.selection.kind !== null) throw new Error('combat not reached');

// ---- C-04: 전투 HUD (두 패널 모두 스킬 안내) ----
await p1.hold(-0.3, 0.1, 800); await p2.hold(0.3, 0.1, 800);
const hud = await bodyText();
steps.C04 = { has위로휙Count: (hud.match(/위로 휙!/g) || []).length, hasBadge1P: hud.includes('1P'), hasBadge2P: hud.includes('2P') };
await shot('C-04-combat-hud-two-phones');

// ---- C-05: 2P 끊김 (전투 중) → 일시정지 + 재접속 대기 카운트다운 ----
p2.close();
log('C-05: 2P socket closed during PLAYING');
await page.locator('text=2P 재접속 대기 중').first().waitFor({ timeout: 15000 }).catch(() => log('C-05 text not found in 15s'));
const readGrace = async () => page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const find = (t) => btns.find((b) => b.innerText.includes(t));
  const resume = find('재개') || find('이어하기');
  const alone = find('혼자 계속하기');
  const m = document.body.innerText.match(/2P 재접속 대기 중\s*·\s*(\d+)초/);
  return {
    countdownSec: m ? Number(m[1]) : null,
    resumeText: resume ? resume.innerText : null,
    resumeDisabled: resume ? (resume.disabled || getComputedStyle(resume).cursor === 'not-allowed' || resume.getAttribute('aria-disabled') === 'true') : null,
    hasAloneBtn: !!alone,
    snippet: document.body.innerText.slice(0, 220),
  };
});
await sleep(1000);
const g1 = await readGrace();
await sleep(3000);
const g2 = await readGrace();
const s5 = await snap();
steps.C05 = { grace1: g1, grace2: g2, phase: s5.phase, isPaused: s5.isPaused, p2Away: s5.players[1].isAway };
log('C-05 grace', JSON.stringify({ c1: g1.countdownSec, c2: g2.countdownSec, resumeDisabled: g2.resumeDisabled, alone: g2.hasAloneBtn, paused: s5.isPaused }));
await shot('C-05-disconnect-grace-countdown');

// ---- C-06: 30초 안에 재접속 → 3초 카운트다운 뒤 재개 ----
await p2.reconnect({ zero: true });
const sawResumeMsg = await page.locator('text=게임 재개!').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
await shot('C-06-reconnected-countdown');
await sleep(4000);
const s6 = await snap();
steps.C06 = { sawResumeMsg, phase: s6.phase, isPaused: s6.isPaused, p2Away: s6.players[1].isAway };
log('C-06', JSON.stringify(steps.C06));
await Promise.all([p1.hold(-0.2, 0.1, 1200), p2.hold(0.2, 0.1, 1200)]);
await shot('C-06-game-resumed');

// ---- C-07: 2P 다시 끊김 → "혼자 계속하기" → 2P 나감 ----
p2.close();
await page.locator('text=혼자 계속하기').first().waitFor({ timeout: 15000 }).catch(() => log('C-07 alone button not in 15s'));
const g7 = await readGrace();
steps.C07pre = g7;
await page.getByText('혼자 계속하기').first().click().catch((e) => log('click alone failed', e.message));
await sleep(1500);
await p1.hold(-0.1, 0.05, 1200);
const s7 = await snap();
const t7 = await bodyText();
steps.C07 = { p2Away: s7.players[1].isAway, p1Away: s7.players[0].isAway, phase: s7.phase, isPaused: s7.isPaused, sawNaGan: t7.includes('나감'), resumeStillDisabled: null };
log('C-07', JSON.stringify(steps.C07));
await shot('C-07-2p-away-status');

// ---- C-08: 나감 상태에서 카드 라운드 → 2P 몫 자동 선택 (웨이브 클리어 필요: 최대 150초 사격) ----
let cardRoundSeen = false;
const tCard = Date.now();
while (Date.now() - tCard < 150000) {
  s = await snap();
  if (s.selection?.kind !== null) { cardRoundSeen = true; break; }
  const tg = (s.targets || []).find((t) => !t.isItem && t.landed) || (s.targets || [])[0];
  if (tg) await p1.snapFire(tg.aimX, tg.aimY); else await p1.snapFire(0, 0);
  await sleep(150);
}
steps.C08 = { cardRoundSeen, selection: s?.selection, phase: s?.phase, elapsedSec: Math.round((Date.now() - tCard) / 1000) };
log('C-08', JSON.stringify(steps.C08));
if (cardRoundSeen) {
  await shot('C-08-away-card-round');
  // 1P만 고르면 진행되는지
  const cardCandidates = (s.targets || []).filter((t) => t.selectKind === 'card' && t.ownerIndex === 0);
  const cc = cardCandidates[0] || (s.targets || []).find((t) => t.selectKind === 'card');
  if (cc) await p1.snapFire(cc.aimX, cc.aimY);
  await sleep(1500);
  const s8 = await snap();
  steps.C08.after1pPick = { selection: s8.selection, phase: s8.phase };
  await shot('C-08-after-1p-pick');
}

// ---- C-09: 나감 뒤 2P 재접속 → 영점 없이 복귀? 십자선·총 다시 보임 ----
await p2.reconnect({ zero: false });
await sleep(1200);
let s9 = await snap();
let zeroNeeded = null;
if (s9.players[1].isAway) {
  // 영점 없이 안 돌아오면 영점(resume)을 보내 복귀 여부를 기록
  zeroNeeded = true;
  await p2.zeroResume();
  await sleep(1000);
  s9 = await snap();
} else {
  zeroNeeded = false;
}
await Promise.all([p1.hold(-0.2, 0.1, 1200), p2.hold(0.2, 0.1, 1200)]);
s9 = await snap();
steps.C09 = { zeroNeededAfterReconnect: zeroNeeded, p2Away: s9.players[1].isAway, phase: s9.phase, isPaused: s9.isPaused };
log('C-09', JSON.stringify(steps.C09));
await shot('C-09-reconnect-after-away');

// ---- C-10: 두 폰 동시 끊김 → 무기한 대기 (카운트다운 없음 기대) ----
p2.close();
await page.locator('text=2P 재접속 대기 중').first().waitFor({ timeout: 15000 }).catch(() => log('C-10 2P grace text missing'));
await sleep(500);
p1.close();
await sleep(35000); // 기존 유예(30초)보다 길게 기다려서 "무기한"인지 확인
const t10 = await bodyText();
const s10 = await snap();
const m10 = t10.match(/재접속 대기 중\s*·\s*(\d+)초/);
steps.C10 = { countdownText: m10 ? m10[0] : null, phase: s10.phase, isPaused: s10.isPaused, snippet: t10.slice(0, 200), hasAlone: t10.includes('혼자 계속하기'), hasResumeDisabled: null };
log('C-10', JSON.stringify({ countdownText: steps.C10.countdownText, paused: s10.isPaused, hasAlone: steps.C10.hasAlone }));
await shot('C-10-both-phones-disconnected-indefinite');

// ---- 5-4: 마우스 이동이 폰 2대 판의 총·십자선을 움직이지 않는지 (사격 없음, 조준 고정) ----
// 폰은 재접속해 조준을 고정하고, 마우스를 화면 구석에서 반대 구석으로 이동시킨 뒤 스냅샷/캡처 비교
// 같은 deviceId로 재접속(p1, p2 객체 재사용)
await p1.reconnect({ zero: true }); await p2.reconnect({ zero: true });
await Promise.all([p1.hold(-0.4, 0.2, 1000), p2.hold(0.4, -0.2, 1000)]);
const sBeforeMouse = await snap();
await shot('C-02-mouse-before-move');
await page.mouse.move(100, 100); await sleep(150); await page.mouse.move(1300, 800); await sleep(300);
await shot('C-02-mouse-after-move');
steps.P01mouse = { note: 'phones held at (-0.4,0.2)/(0.4,-0.2); mouse moved corner to corner; compare screenshots C-02-mouse-before/after', phaseBefore: sBeforeMouse.phase, errorsSoFar: errors.length };

// ---- 5-3: 1024x768 경계 (전투 화면) ----
const boundaryJs = () => {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const out = [];
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], div, span, p, h1, h2, h3'))) {
    const txt = (el.innerText || '').trim();
    if (!txt || txt.length > 60) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
      out.push({ text: txt.slice(0, 40), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw, vh });
    }
  }
  return { vw, vh, offscreenCount: out.length, offscreen: out.slice(0, 25) };
};
steps.boundary = {};
steps.boundary['1440x900_combat'] = await page.evaluate(boundaryJs);
await page.setViewportSize({ width: 1024, height: 768 });
await sleep(1200);
steps.boundary['1024x768_combat'] = await page.evaluate(boundaryJs);
await shot('C-5-3-combat-1024x768');
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(800);

// ---- 종료 ----
const finalSnap = await snap();
steps.final = { phase: finalSnap.phase, isPaused: finalSnap.isPaused, players: finalSnap.players.map((p) => ({ ammo: p.ammo, isAway: p.isAway, score: p.score })) };
const results = { steps, pageErrorsCount: pageErrors.length, errorsCount: errors.length, pageErrors, errors };
fs.writeFileSync(path.join(HERE, 'combat-run-results.json'), JSON.stringify(results, null, 2));
log('wrote combat-run-results.json; errors', errors.length);

p1.close(); p2.close();
await browser.close();
