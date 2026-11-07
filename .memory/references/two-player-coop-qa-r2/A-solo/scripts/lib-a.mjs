// QA-A(R2) 공통 헬퍼: Playwright 브라우저 + WebSocket 가짜 폰 + 디버그 스냅샷 읽기.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

export const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/A-solo';
export const URL_DEV = 'https://127.0.0.1:5201/';
export const WS_URL = 'ws://localhost:8801';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const t0 = Date.now();
export const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// 전역 수집기: 콘솔 에러·페이지 에러는 시나리오 전체에서 모은다.
export const collected = { pageErrors: [], consoleErrors: [], checks: [], values: {} };

export const launch = () => chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

export async function newPage(browser, { width = 1440, height = 900, tag = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { collected.pageErrors.push(`[${tag}] ${e.message}`); log('PAGE ERROR', tag, e.message); });
  page.on('console', (m) => {
    if (m.type() === 'error') { collected.consoleErrors.push(`[${tag}] ${m.text()}`); log('CONSOLE ERROR', tag, m.text()); }
  });
  await page.goto(URL_DEV, { waitUntil: 'networkidle', timeout: 120000 });
  await sleep(1500);
  return { page, ctx };
}

export const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log('shot', `${name}.png`);
};

export const snap = (page) => page.evaluate(() => window.__BEER_DEBUG__?.snapshot() ?? null);

// 판정 기록: 이름, PASS/BUG/DIFF/SKIP, 근거 값.
export function check(id, status, note, evidence = {}) {
  collected.checks.push({ id, status, note, evidence });
  log(`CHECK ${id} ${status} — ${note}`, Object.keys(evidence).length ? JSON.stringify(evidence) : '');
}

// 화면 좌표 변환 (checklist 5-5 공식)
export const normToScreen = (aimX, aimY, width = 1440, height = 900) => ({
  x: ((aimX + 1) / 2) * width,
  y: ((1 - aimY) / 2) * height,
});

export function saveJson(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  log('saved', name);
}

// 가짜 폰 (checklist 0-2). 프레임은 30ms 간격으로 계속 보내야 한다.
export function fakePhone(roomId, slot, nickname) {
  let ws = null;
  const deviceId = `qa-a-phone-${slot}-${Math.random().toString(36).slice(2, 8)}`;
  const send = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
  const errors = [];
  const received = [];
  const open = () => {
    ws = new WebSocket(WS_URL);
    ws.on('message', (raw) => {
      try { const m = JSON.parse(raw.toString()); received.push(m.type); if (m.type === 'ERROR') errors.push(`${m.code}: ${m.message}`); } catch {}
    });
    return new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  };
  const frame = (aimX, aimY, extra = {}) => send({
    type: 'SENSOR_FRAME', roomId, deviceId, slot,
    payload: { aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false,
      feverTriggered: false, isCocked: false, timestamp: Date.now(), ...extra },
  });
  return {
    deviceId, errors, received,
    async join() {
      await open();
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: false }); await sleep(400); },
    async aimHold(aimX, aimY, ms) { const end = Date.now() + ms; while (Date.now() < end) { frame(aimX, aimY); await sleep(30); } },
    async snap(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(60); frame(aimX, aimY); },
    // 연사 유지: rapidFireHold true를 ms 동안 30ms 간격으로 보내고 false로 끝낸다.
    async holdFire(aimX, aimY, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) { frame(aimX, aimY, { rapidFireHold: true }); await sleep(30); }
      frame(aimX, aimY, { rapidFireHold: false });
    },
    async fever(aimX, aimY) { frame(aimX, aimY, { feverTriggered: true }); await sleep(60); frame(aimX, aimY); },
    async skill(aimX, aimY) { frame(aimX, aimY, { skillSnapTriggered: true }); await sleep(60); frame(aimX, aimY); },
    close() { try { ws && ws.close(); } catch {} },
    async reconnect() {
      await open();
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(300);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true });
      await sleep(400);
    },
  };
}

export const roomIdOf = (page) => page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
