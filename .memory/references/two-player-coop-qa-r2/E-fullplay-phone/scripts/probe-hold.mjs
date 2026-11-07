import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const weapon = process.argv[2] || 'gatling';
const ws = new WebSocket('ws://localhost:8805');
const deviceId = `phone_qa_e_probe_${Date.now()}`;
const st = { aimX: 0, aimY: 0, hold: false };
let roomId;
let streamTimer;
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const frame = (extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot: 1, payload: { aimX: st.aimX, aimY: st.aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: st.hold, feverTriggered: false, isCocked: false, skillSnapTriggered: false, timestamp: Date.now(), ...extra } });
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const snap = () => page.evaluate(() => window.__BEER_DEBUG__.snapshot());
await page.goto('https://127.0.0.1:5205/', { waitUntil: 'load' });
await sleep(2500);
const mobile = page.getByText('📱 모바일').first();
await mobile.waitFor({ state: 'visible', timeout: 30000 });
await mobile.click();
await sleep(1000);
roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
while (ws.readyState !== 1) await sleep(50);
send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname: 'probe', slot: 1 });
await sleep(400);
streamTimer = setInterval(() => frame(), 30);
await sleep(600);
send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot: 1 });
await sleep(400);
frame({ snapFire: true });
await sleep(4200);
for (let i = 0; i < 100; i++) { const s = await snap(); if (s.selection.kind === 'weapon') break; await sleep(200); }
const s0 = await snap();
console.log('DIAG phase', s0.phase, 'selection', JSON.stringify(s0.selection), 'targets', s0.targets.length, 'kinds', JSON.stringify(s0.targets.filter(t=>t.selectKind).map(t=>t.selectValue)));
const wt = s0.targets.find((t) => t.selectKind === 'weapon' && t.selectValue === weapon);
st.aimX = wt.aimX; st.aimY = wt.aimY;
await sleep(500);
frame({ snapFire: true });
await sleep(1500);
for (let i = 0; i < 100; i++) { const s = await snap(); if (s.phase === 'PLAYING' && !s.selection.kind) break; await sleep(200); }
const log = [];
const ammo = async () => (await snap()).players[0].ammo;
// 아무 표적도 없는 허공(0.9,-0.9)에서 조준 — 탄약 변화만 본다
st.aimX = 0.9; st.aimY = -0.9;
await sleep(300);
log.push(['start', await ammo()]);
for (const label of ['A_hold1s_1', 'A_hold1s_2']) {
  st.hold = true;
  const seq = [await ammo()];
  for (let i = 0; i < 10; i++) { await sleep(100); seq.push(await ammo()); }
  st.hold = false;
  await sleep(400);
  log.push([label, seq.join(',')]);
}
for (let k = 0; k < 3; k++) {
  const b = await ammo();
  frame({ snapFire: true });
  await sleep(500);
  log.push([`snap${k}`, `${b}->${await ammo()}`]);
}
console.log(JSON.stringify({ weapon, log, phase: (await snap()).phase, maxAmmo: (await snap()).players[0].maxAmmo }, null, 1));
fs.writeFileSync(path.join(OUT, `probe-hold-${weapon}.json`), JSON.stringify(log, null, 1));
clearInterval(streamTimer);
ws.close();
await browser.close();
