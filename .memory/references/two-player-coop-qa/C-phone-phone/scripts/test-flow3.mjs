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
      log(`Reconnecting phone [${slot}] (resume=${resume})...`);
      ws = new WebSocket(WS);
      ready = new Promise((res) => ws.on('open', res));
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(250);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(250);
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    },
  };
}

async function run() {
  log('Starting Flow 3 test (Reconnect countdown catch, Continue Alone, Away status, Reconnect, Result away badge, shoot result button)...');
  const page = await newPage();

  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 로비 1P, 2P 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = createFakePhone(roomId, 1, '블루폰', 'flow3_p1');
  const p2 = createFakePhone(roomId, 2, '오렌지폰', 'flow3_p2');

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
  await p1.aimHold(-0.47, 0, 400);
  await p1.snap(-0.47, 0);
  await sleep(300);
  await p2.aimHold(0.47, 0, 400);
  await p2.snap(0.47, 0);
  await sleep(1500);

  // 전투 진입
  await Promise.all([p1.aimHold(-0.2, 0.1, 2000), p2.aimHold(0.2, 0.1, 2000)]);
  log('Combat started.');

  // 1. C-06 카운트다운 캡처 정밀 검증
  log('Testing C-06: Disconnecting 2P for countdown capture...');
  p2.close();
  await sleep(1500);

  // 재접속하면서 바로 카운트다운 캡처 시도
  log('Reconnecting 2P and catching 3s countdown...');
  const reconnectPromise = p2.reconnect(true);
  // 카운트다운 엘리먼트가 나타나면 즉시 캡처
  try {
    await page.locator('text=게임 재개! 조준선을 정렬하세요').waitFor({ timeout: 4000 });
    await shot(page, 'C-06-reconnected-3s-countdown');
  } catch (err) {
    log('Countdown wait warning:', err.message);
    await shot(page, 'C-06-reconnected-3s-countdown-fallback');
  }
  await reconnectPromise;
  await Promise.all([p1.aimHold(-0.2, 0.1, 3500), p2.aimHold(0.2, 0.1, 3500)]);

  // 2. C-07: 2P 다시 끊김 후 "혼자 계속하기" 클릭
  log('Disconnecting 2P again to test Continue Alone (Away status)...');
  p2.close();
  await sleep(1500);

  log('Clicking 혼자 계속하기 button...');
  const continueAloneBtn = page.getByText('혼자 계속하기');
  if (await continueAloneBtn.count()) {
    await continueAloneBtn.first().click();
    await sleep(1500);
  } else {
    log('WARNING: 혼자 계속하기 button not found!');
  }

  // 1P 조준 프레임 계속 보내기
  await p1.aimHold(-0.1, 0.05, 1000);

  // C-07: 2P "나감" 배지 표시, 2P 패널 흐림, 2P 십자선/총 숨김 캡처
  await shot(page, 'C-07-2p-away-status');

  // 3. C-09: 나감 뒤 2P 재접속 -> 영점 없이 바로 복귀
  log('Testing C-09: Reconnecting 2P after away status...');
  await p2.reconnect(true);
  await sleep(1000);
  // 1P, 2P 조준 프레임 전송
  await Promise.all([p1.aimHold(-0.2, 0.1, 1500), p2.aimHold(0.2, 0.1, 1500)]);
  // C-09: 복귀 캡처 (십자선/총 다시 보임, 나감 배지 사라짐)
  await shot(page, 'C-09-reconnect-after-away');

  // 4. 다시 2P 이탈 후 게임 오버까지 진행하여 결과 화면(C-12) 확인
  log('Disconnecting 2P again and letting monsters breach for game over...');
  p2.close();
  await sleep(1000);
  const alone2 = page.getByText('혼자 계속하기');
  if (await alone2.count()) {
    await alone2.first().click();
    await sleep(1000);
  }

  // 몬스터들이 방어선을 넘어 목숨 5개가 다 닳아 게임 오버될 때까지 대기
  log('Waiting for game over (defense breach)...');
  for (let i = 0; i < 60; i++) {
    // 1P 조준 프레임은 보내되 사격은 하지 않음
    await p1.aimHold(0, 0, 1000);
    const gameOver = await page.locator('[data-shootable="restart"]').count();
    if (gameOver > 0) {
      log('Game over detected!');
      break;
    }
  }

  await sleep(2000);
  // C-12: 결과 화면 (이탈자 칸 "나감", 1P/2P 결과, 팀 최고 기록 등)
  await shot(page, 'C-12-result-away-badge');

  // C-12: 폰 사격으로 결과 화면 버튼 누르기 테스트
  // 1P가 [data-shootable="lobby"] 또는 [data-shootable="restart"] 위치를 겨눠서 사격
  log('Phone 1 aiming and shooting at lobby/restart button...');
  // 결과 화면의 '로비로' 또는 '다시 시작' 버튼의 위치를 확인
  const btnBox = await page.locator('[data-shootable="restart"]').boundingBox();
  if (btnBox) {
    log('Restart button box:', btnBox);
    // 화면 좌표(px)를 폰 aimX, aimY (-1 ~ 1)로 변환
    const btnAimX = ((btnBox.x + btnBox.width / 2) / 1440) * 2 - 1;
    const btnAimY = 1 - ((btnBox.y + btnBox.height / 2) / 900) * 2;
    log('Aiming at restart button:', { btnAimX, btnAimY });
    await p1.aimHold(btnAimX, btnAimY, 500);
    await p1.snap(btnAimX, btnAimY);
    await sleep(1500);
    await shot(page, 'C-12-result-shoot-restart-action');
  }

  p1.close();
  p2.close();
  await page.context().close();
  await browser.close();

  log('Flow 3 completed. Total errors:', errors.length);
  if (errors.length) {
    console.log('Errors:', errors);
  }
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
