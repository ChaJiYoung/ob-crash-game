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
    log('PAGE CONSOLE:', msg.type(), msg.text());
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
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
      await sleep(300);
    },
    async zero(resume = false) {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(300);
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
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
}

async function run() {
  log('Starting Result Screen Button Test...');
  const page = await newPage();

  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 로비 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(300);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(400);

  const p1 = createFakePhone(roomId, 1, '블루폰', 'res_p1');
  const p2 = createFakePhone(roomId, 2, '오렌지폰', 'res_p2');

  await p1.join();
  await p2.join();
  await sleep(400);
  await p1.zero();
  await p2.zero();
  await sleep(400);

  // 로비 사격 시작
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

  // 2P 끊고 혼자 계속하기 -> 2P 나감 처리
  log('Disconnecting 2P and setting to away...');
  p2.close();
  await sleep(1200);
  const alone = page.getByText('혼자 계속하기');
  if (await alone.count()) {
    await alone.first().click();
    await sleep(1000);
  }

  // 게임 오버 대기
  log('Waiting for game over...');
  for (let i = 0; i < 60; i++) {
    await p1.aimHold(0, 0, 1000);
    const gameOver = await page.locator('[data-shootable="restart"]').count();
    if (gameOver > 0) {
      log('Game over reached!');
      break;
    }
  }
  await sleep(1500);

  // 버튼 위치 측정
  const restartBtn = page.locator('[data-shootable="restart"]');
  const box = await restartBtn.boundingBox();
  log('Restart button boundingBox:', box);

  if (box) {
    // 버튼 정중앙 픽셀
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // 뷰포트 1440x900 기준 aim 좌표
    const aimX = (cx / 1440) * 2 - 1;
    const aimY = 1 - (cy / 900) * 2;
    log(`Aiming directly at center of restart button: screen(${cx}, ${cy}) -> aim(${aimX.toFixed(3)}, ${aimY.toFixed(3)})`);

    await p1.aimHold(aimX, aimY, 800);
    await shot(page, 'C-12-result-centered-aim');

    // 폰으로 사격!
    log('Snapping restart button with phone...');
    await p1.snap(aimX, aimY);
    await sleep(2000);
    await shot(page, 'C-12-result-shoot-action-result');

    // 만약 사격으로 다시 시작되었는지 확인
    const phaseAfterShot = await page.evaluate(() => {
      const restartCount = document.querySelectorAll('[data-shootable="restart"]').length;
      return restartCount === 0 ? 'RESTARTED' : 'STILL_ON_RESULT';
    });
    log('Phase after phone shot:', phaseAfterShot);

    if (phaseAfterShot === 'STILL_ON_RESULT') {
      // 마우스 클릭으로 동작하는지 확인 (C-02: 마우스로 결과 버튼 클릭은 동작)
      log('Testing mouse click on restart button...');
      await restartBtn.click();
      await sleep(2000);
      await shot(page, 'C-12-result-mouse-click-restart');
      const phaseAfterMouse = await page.evaluate(() => {
        const restartCount = document.querySelectorAll('[data-shootable="restart"]').length;
        return restartCount === 0 ? 'RESTARTED' : 'STILL_ON_RESULT';
      });
      log('Phase after mouse click:', phaseAfterMouse);
    }
  }

  p1.close();
  await page.context().close();
  await browser.close();

  log('Result Screen Button Test completed. Errors caught:', errors.length);
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
