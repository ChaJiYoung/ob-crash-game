import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const OUT_DIR = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q3';
export const BASE_URL = 'https://127.0.0.1:5223/';
export const WS_URL = 'ws://127.0.0.1:8823';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

export async function getUptimeLoad() {
  try {
    const { stdout } = await execAsync('uptime');
    return stdout.trim();
  } catch (e) {
    return `uptime failed: ${e.message}`;
  }
}

export async function measureRafAndLoad(page) {
  const uptime = await getUptimeLoad();
  const rafCount = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let count = 0;
      const start = performance.now();
      function tick(now) {
        count++;
        if (now - start >= 1000) {
          resolve(count);
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  });
  return { rafCount, uptime };
}

export async function ensureLoadAndRaf(page, onWaiting = null, maxWaitSec = 600) {
  const startTime = Date.now();
  let trial = 0;
  const history = [];
  while (Date.now() - startTime < maxWaitSec * 1000) {
    trial++;
    const { rafCount, uptime } = await measureRafAndLoad(page);
    history.push({ trial, rafCount, uptime, timeMs: Date.now() - startTime });
    log(`Load check #${trial}: rAF=${rafCount}/s, load=${uptime}`);
    if (rafCount >= 30) {
      return { ok: true, rafCount, uptime, trials: trial, history };
    }
    log(`rAF ${rafCount} < 30. Waiting 30s before retry...`);
    const waitEnd = Date.now() + 30000;
    while (Date.now() < waitEnd) {
      if (onWaiting) {
        try {
          await onWaiting();
        } catch {}
      }
      await sleep(1000);
    }
  }
  const finalCheck = await measureRafAndLoad(page);
  history.push({ trial: trial + 1, rafCount: finalCheck.rafCount, uptime: finalCheck.uptime, final: true });
  return { ok: false, rafCount: finalCheck.rafCount, uptime: finalCheck.uptime, trials: trial, timeout: true, history };
}

export async function connectAndZeroPhone(page, phone, slot = 1) {
  log(`Connecting phone (slot ${slot})...`);
  await phone.join();
  await page.waitForSelector('text=접속 완료', { timeout: 10000 });
  log(`Phone slot ${slot} confirmed connected!`);

  await phone.zero();
  await page.waitForSelector('text=영점 완료', { timeout: 10000 });
  log(`Phone slot ${slot} confirmed zeroed!`);
  await sleep(400);
}

export async function shootToStart(phone, getSnapshot) {
  log('Shooting center (0, 0) to start...');
  await phone.aimHold(0, 0, 300);
  await phone.snap(0, 0);

  // 카운트다운(3.5초) 대기하며 무기 선택 대기
  const waitStart = Date.now();
  while (Date.now() - waitStart < 7000) {
    const s = await getSnapshot();
    if (s?.selection?.kind === 'weapon') {
      log('Weapon selection reached!');
      return true;
    }
    await phone.aimHold(0, 0, 200);
  }

  // 혹시 늦어질 경우 추가 대기
  for (let i = 0; i < 20; i++) {
    const s = await getSnapshot();
    if (s?.selection?.kind === 'weapon') {
      log('Weapon selection reached!');
      return true;
    }
    await phone.aimHold(0, 0, 200);
  }

  return false;
}

export async function createTestBrowser(viewport = { width: 1440, height: 900 }) {
  const errors = [];
  const pageErrors = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=metal', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    pageErrors.push(e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', msg.text());
      errors.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  let roomId = null;
  for (let i = 0; i < 20; i++) {
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
    if (roomId) break;
    await sleep(500);
  }

  if (!roomId) {
    const newRoomBtn = page.getByText('🔄 새 방 만들기');
    if ((await newRoomBtn.count()) > 0) {
      await newRoomBtn.first().click();
      await sleep(1500);
    }
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  }
  log('TestBrowser ready. Room ID:', roomId);

  const shot = async (name) => {
    const filePath = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath });
    log('Saved screenshot:', name);
    return filePath;
  };

  const getSnapshot = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());

  return {
    browser,
    ctx,
    page,
    roomId,
    errors,
    pageErrors,
    shot,
    getSnapshot,
  };
}

export function createFakePhone(roomId, slot, nickname, deviceIdPrefix = 'phone') {
  let ws = new WebSocket(WS_URL);
  const deviceId = `fake_${deviceIdPrefix}_${slot}`;
  const send = (m) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
  let ready = new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`WebSocket to ${WS_URL} timed out`)), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      res();
    });
    ws.on('error', rej);
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
    slot,
    frame,
    async check() {
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(300);
    },
    async join() {
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(300);
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async zero(resume = false) {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(400);
    },
    async aimHold(aimX, aimY, ms, extra = {}) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY, extra);
        await sleep(30);
      }
    },
    async snap(aimX, aimY) {
      frame(aimX, aimY, { snapFire: true });
      await sleep(50);
      frame(aimX, aimY);
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
}
