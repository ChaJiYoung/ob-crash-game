// Diagnostic v2: mirrors the verify script's 01a/01b sequence (Phone class with ticker),
// logs every server message and the slot-card state at each step, then tries a mouse click on slot 1 mouse button.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

const BASE = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('https://127.0.0.1:5202/', { waitUntil: 'networkidle' });
await sleep(1200);
let roomId = null;
for (let i = 0; i < 40 && !roomId; i++) { roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id')); if (!roomId) await sleep(300); }
log('room', roomId);

const state = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="slot-card-"]')).map((c) => ({
  card: c.getAttribute('data-testid').slice(-1),
  mouseDisabled: Array.from(c.querySelectorAll('button')).filter((b) => b.innerText.includes('마우스')).map((b) => b.disabled),
  phoneDisabled: Array.from(c.querySelectorAll('button')).filter((b) => b.innerText.includes('모바일')).map((b) => b.disabled),
  nick: c.innerText.includes('모바일P') ? 'has 모바일P' : 'no 모바일P',
  ready: c.innerText.includes('영점') ? 'needs zero' : (c.innerText.includes('준비') ? 'ready' : '-'),
})));

const ws = new WebSocket('ws://localhost:8802');
ws.on('message', (raw) => log('  SRV', raw.toString().slice(0, 160)));
await new Promise((r) => ws.on('open', r));
const dev = `diag2_dev_${Date.now()}`;
const send = (m) => { ws.send(JSON.stringify(m)); log('  SEND', m.type, 'slot', m.slot ?? ''); };

send({ type: 'REGISTER_NICKNAME', roomId, deviceId: dev, nickname: '모바일P', slot: 2 });
await sleep(1200);
log('STEP A (register slot2)', JSON.stringify(await state()));
send({ type: 'REGISTER_NICKNAME', roomId, deviceId: dev, nickname: '모바일P', slot: 1 });
await sleep(1200);
log('STEP B (same device -> slot1)', JSON.stringify(await state()));
send({ type: 'REGISTER_NICKNAME', roomId, deviceId: dev, nickname: '모바일P', slot: 2 });
await sleep(1200);
log('STEP C (back to slot2)', JSON.stringify(await state()));
await page.screenshot({ path: path.join(BASE, 'V-diag2-after-moves.png') });
try {
  await page.locator('[data-testid="slot-card-1"]').getByRole('button', { name: '🖱 마우스' }).click({ timeout: 5000 });
  log('STEP D mouse click slot1 OK');
} catch (e) {
  log('STEP D mouse click slot1 FAILED:', e.message.split('\n')[0]);
}
ws.close();
await browser.close();
process.exit(0);
