// Diagnostic: same-device slot move, then check whether the mouse button in slot 1 becomes disabled.
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

const ws = new WebSocket('ws://localhost:8802');
const msgs = [];
ws.on('message', (raw) => msgs.push(raw.toString()));
await new Promise((r) => ws.on('open', r));
const dev = `diag_dev_${Date.now()}`;
const send = (m) => ws.send(JSON.stringify(m));

const btnState = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="slot-card-"]')).map((c) => ({
  card: c.getAttribute('data-testid'),
  mouseBtnDisabled: Array.from(c.querySelectorAll('button')).filter((b) => b.innerText.includes('마우스')).map((b) => b.disabled),
  text: c.innerText.replace(/\n/g, ' | ').slice(0, 120),
})));

send({ type: 'REGISTER_NICKNAME', roomId, deviceId: dev, nickname: '진단폰', slot: 2 });
await sleep(700);
log('A after register slot2', JSON.stringify(await btnState()));
send({ type: 'REGISTER_NICKNAME', roomId, deviceId: dev, nickname: '진단폰', slot: 1 });
await sleep(900);
log('B after same device -> slot1', JSON.stringify(await btnState()));
log('server msgs', msgs.filter((m) => m.includes('ERROR') || m.includes('SLOT')).slice(0, 5));
await page.screenshot({ path: path.join(BASE, 'V-diag-slot-move.png') });
ws.close();
await browser.close();
process.exit(0);
