import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

export const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q2';
export const URL = 'https://127.0.0.1:5222/';
export const WS = 'ws://127.0.0.1:8822';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export const toScreenX = (aimX) => Math.round(((Math.max(-1, Math.min(1, aimX)) * 0.94 + 1) / 2) * 1440);
export const toScreenY = (aimY) => Math.round(((1 - Math.max(-1, Math.min(1, aimY)) * 0.84) / 2) * 900);
export const fromScreenX = (x) => (((x / 1440) * 2 - 1) / 0.94);
export const fromScreenY = (y) => ((1 - (y / 900) * 2) / 0.84);

export async function createTestEnv(viewport = { width: 1440, height: 900 }) {
  const errors = [];
  const pageErrors = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    pageErrors.push(e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', text);
      errors.push(`CONSOLE ERROR: ${text}`);
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  // Wait for room id
  let roomId = null;
  for (let i = 0; i < 20; i++) {
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
    if (roomId) break;
    await sleep(500);
  }

  if (!roomId) {
    log('Room ID not found in localStorage, clicking 새 방 만들기...');
    const newRoomBtn = page.getByText('🔄 새 방 만들기');
    if ((await newRoomBtn.count()) > 0) {
      await newRoomBtn.first().click();
      await sleep(1500);
    }
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  }
  log('TestEnv ready. Room ID:', roomId);

  const shot = async (name) => {
    const filePath = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: filePath });
    log('Saved screenshot:', name);
    return filePath;
  };

  const getSnapshot = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());

  function fakePhone(slot, nickname, customDeviceId = null) {
    let ws = new WebSocket(WS);
    const deviceId = customDeviceId || `fake_phone_${slot}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const send = (m) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

    const readyPromise = new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`WebSocket to ${WS} timed out after 5s`)), 5000);
      ws.once('open', () => {
        clearTimeout(timer);
        res();
      });
      ws.once('error', (err) => {
        clearTimeout(timer);
        rej(err);
      });
    });

    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === 'ERROR') log(`phone [${slot}] ERROR:`, m.code, m.message);
      } catch {}
    });

    const frame = (aimX, aimY, extra = {}) =>
      send({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId,
        slot,
        payload: {
          aimX,
          aimY,
          pitchDeg: 0,
          yawDeg: 0,
          rollDeg: 0,
          snapFire: false,
          rapidFireHold: false,
          feverTriggered: false,
          skillSnapTriggered: false,
          isCocked: false,
          timestamp: Date.now(),
          ...extra,
        },
      });

    return {
      get ws() {
        return ws;
      },
      deviceId,
      frame,
      async join() {
        await readyPromise;
        log(`fakePhone [${slot}] connected, sending REGISTER_NICKNAME...`);
        send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
        await sleep(350);
      },
      async check() {
        await readyPromise;
        send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
        await sleep(300);
      },
      async zero(resume = false) {
        log(`fakePhone [${slot}] sending CALIBRATE_ZERO (resume=${resume})...`);
        send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
        await sleep(350);
      },
      async aimHold(aimX, aimY, ms, extra = {}) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
          frame(aimX, aimY, extra);
          await sleep(30);
        }
      },
      async snapFire(aimX, aimY) {
        frame(aimX, aimY, { snapFire: true });
        await sleep(50);
        frame(aimX, aimY);
      },
      async reconnect(resume = true) {
        log(`Reconnecting phone [${slot}] (resume=${resume})...`);
        ws = new WebSocket(WS);
        const reReady = new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('reconnect timed out')), 5000);
          ws.once('open', () => {
            clearTimeout(t);
            res();
          });
          ws.once('error', (err) => {
            clearTimeout(t);
            rej(err);
          });
        });
        await reReady;
        send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
        await sleep(250);
        send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
        await sleep(250);
      },
      close() {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      },
    };
  }

  const cleanup = async () => {
    await page.context().close();
    await browser.close();
  };

  return {
    browser,
    page,
    roomId,
    errors,
    pageErrors,
    shot,
    getSnapshot,
    fakePhone,
    cleanup,
  };
}
