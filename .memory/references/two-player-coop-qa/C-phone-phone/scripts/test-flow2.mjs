import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/C-phone-phone';
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', msg.text());
      errors.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  return page;
}

const shot = async (page, name) => {
  const filePath = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: filePath });
  log('Saved screenshot:', name);
};

function createFakePhone(roomId, slot, nickname, deviceIdPrefix = 'phone') {
  let ws = new WebSocket(WS);
  const deviceId = `fake_${deviceIdPrefix}_${slot}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  let ready = new Promise((res) => ws.on('open', res));

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
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async check() {
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(400);
    },
    async zero(resume = false) {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(400);
    },
    async aimHold(aimX, aimY, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY);
        await sleep(33);
      }
    },
    async snap(aimX, aimY) {
      frame(aimX, aimY, { snapFire: true });
      await sleep(60);
      frame(aimX, aimY);
    },
    async reconnect(resume = true) {
      log(`Reconnecting phone [${slot}]...`);
      ws = new WebSocket(WS);
      ready = new Promise((res) => ws.on('open', res));
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(400);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(400);
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    },
  };
}

async function run() {
  log('Starting Flow 2 test (Disconnect grace, reconnect countdown, simultaneous disconnect)...');
  const page = await newPage();

  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 1P 모바일, 2P 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = createFakePhone(roomId, 1, '블루폰', 'flow2_p1');
  const p2 = createFakePhone(roomId, 2, '오렌지폰', 'flow2_p2');

  await p1.join();
  await p2.join();
  await sleep(500);
  await p1.zero();
  await p2.zero();
  await sleep(500);

  // 폰으로 시작 사격
  await p1.snap(0, 0);
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // 무기 선택
  log('Selecting weapons...');
  await p1.aimHold(-0.47, 0, 400);
  await p1.snap(-0.47, 0);
  await sleep(300);
  await p2.aimHold(0.47, 0, 400);
  await p2.snap(0.47, 0);
  await sleep(1500);

  // 전투 진입
  log('Combat active. Keeping aim frames alive...');
  // 스킬 쿨다운 20초 대기하면서 패널의 [위로 휙!] 갱신 확인
  log('Waiting for skill cooldown to reach SKILL READY [위로 휙!]...');
  for (let sec = 0; sec < 21; sec++) {
    await Promise.all([p1.aimHold(-0.2, 0.1, 1000), p2.aimHold(0.2, 0.1, 1000)]);
  }
  // C-04: 스킬 쿨다운 완료 후 "[위로 휙!]" 캡처
  await shot(page, 'C-04-combat-hud-skill-ready');

  // C-05: 2P 폰 끊김 테스트
  log('Disconnecting Phone 2 (2P)...');
  p2.close();
  await sleep(1500);
  // C-05: 재접속 대기 오버레이 캡처 (30초 카운트다운, 재개 비활성, 혼자 계속하기 표시)
  await shot(page, 'C-05-disconnect-grace-countdown');

  // C-06: 30초 안에 재접속 -> 3초 카운트다운 뒤 재개
  log('Phone 2 reconnecting within grace period...');
  await p2.reconnect(true);
  await sleep(800);
  // 3초 카운트다운 화면 캡처
  await shot(page, 'C-06-reconnected-countdown');
  // 카운트다운 종료 및 재개 대기 (3.5초)
  await Promise.all([p1.aimHold(-0.2, 0.1, 3500), p2.aimHold(0.2, 0.1, 3500)]);
  await shot(page, 'C-06-game-resumed');

  // C-10: 두 폰 동시 끊김 -> 무기한 대기 (D40)
  log('Testing simultaneous disconnect (both phones disconnect)...');
  log('Disconnecting Phone 2 first...');
  p2.close();
  await sleep(1000);
  log('Disconnecting Phone 1 while 2P is in grace...');
  p1.close();
  await sleep(1500);
  // C-10: 두 폰 동시 끊김 무기한 대기 캡처
  await shot(page, 'C-10-both-phones-disconnected-indefinite');

  await page.context().close();
  await browser.close();

  log('Flow 2 completed. Total errors caught:', errors.length);
  if (errors.length) {
    console.log('Errors encountered:', errors);
  }
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
