import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now()-t0)/1000).toFixed(1).padStart(6), ...a);
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
page.on('pageerror', (e) => log('PAGEERROR', e.message));
await page.goto('https://127.0.0.1:5203/', { waitUntil: 'domcontentloaded' });
const roomId = await page.waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 30000 }).then((h) => h.jsonValue());
log('room', roomId);
await sleep(800);
await page.getByText('📱 모바일').first().click(); await sleep(400);
await page.getByText('📱 모바일').nth(1).click(); await sleep(500);
const snap = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
function phone(slot, nick) {
  const ws = new WebSocket(`ws://localhost:8803`);
  const deviceId = `probe_${slot}_${Date.now()}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((r) => ws.on('open', r));
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR' || m.type === 'SENSOR_ERROR') log('WS', slot, m.type, m.code, m.message); });
  const f = (aimX, aimY, extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, skillSnapTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  return {
    ws, deviceId, f, ready,
    async join() { await ready; send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname: nick, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    async hold(x, y, ms, extra = {}) { const e = Date.now() + ms; while (Date.now() < e) { f(x, y, extra); await sleep(30); } },
    async snap(x, y) { f(x, y, { snapFire: true }); await sleep(50); f(x, y); },
  };
}
const p1 = phone(1, '블루폰'); const p2 = phone(2, '오렌지폰');
await p1.join(); await p2.join(); await sleep(300);
await p1.zero(); await p2.zero(); await sleep(300);
let s = await snap(); log('after zero', s.phase, JSON.stringify(s.selection));
await Promise.all([p1.hold(-0.2, 0, 800), p2.hold(0.2, 0, 800)]);
s = await snap(); log('before start shot', s.phase, JSON.stringify(s.selection));
await p2.snap(0, 0);
for (let i = 0; i < 14; i++) { await Promise.all([p1.hold(-0.3, 0, 500), p2.hold(0.3, 0, 500)]); s = await snap(); log('countdown poll', s.phase, JSON.stringify(s.selection), 'paused', s.isPaused); if (s.phase !== 'ZEROING' && s.phase !== 'PAIRING') break; }
for (let i = 0; i < 20; i++) { await Promise.all([p1.hold(-0.47, 0, 250), p2.hold(0.47, 0, 250)]); s = await snap(); log('select poll', s.phase, JSON.stringify(s.selection), s.players.map(p=>p.weaponKind).join('/')); if (s.phase === 'PLAYING') break; }
await browser.close(); process.exit(0);
