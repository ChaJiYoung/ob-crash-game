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
    async aimHold(aimX, aimY, ms, extra = {}) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY, extra);
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
      await sleep(200);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
      await sleep(200);
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    },
  };
}

async function run() {
  log('Starting Flow 4: Reconnect countdown 3s catch, Away Game Over -> Result screen away badge, and shoot restart button...');
  const page = await newPage();

  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 로비 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = createFakePhone(roomId, 1, '블루폰', 'flow4_p1');
  const p2 = createFakePhone(roomId, 2, '오렌지폰', 'flow4_p2');

  await p1.join();
  await p2.join();
  await sleep(500);
  await p1.zero();
  await p2.zero();
  await sleep(500);

  // 로비 가운데 사격으로 시작
  await p1.snap(0, 0);
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // 1P: 개틀링(-0.47, 0) 선택
  log('1P selecting Gatling...');
  await p1.aimHold(-0.47, 0, 500);
  await p1.snap(-0.47, 0);
  await sleep(500);

  // 2P: 샷건(0.47, 0) 선택
  log('2P selecting Shotgun...');
  await p2.aimHold(0.47, 0, 500);
  await p2.snap(0.47, 0);
  await sleep(1500);

  // 전투 진입
  log('Combat phase entered. Sending aim frames...');
  await Promise.all([p1.aimHold(-0.2, 0.1, 2000), p2.aimHold(0.2, 0.1, 2000)]);

  // 1. C-06 정밀 캡처: 2P 끊김 후 재연결 시 3초 카운트다운 숫자 잡기
  log('Testing C-06 countdown overlay...');
  p2.close();
  await sleep(1500);

  // 재연결 시작
  p2.reconnect(true);
  // 카운트다운 텍스트 '게임 재개! 조준선을 정렬하세요' 대기 후 즉시 캡처
  try {
    await page.locator('text=게임 재개! 조준선을 정렬하세요').waitFor({ timeout: 3000 });
    await shot(page, 'C-06-reconnected-3s-countdown-clean');
  } catch (e) {
    log('Countdown wait missed or timed out:', e.message);
  }
  // 카운트다운 끝날 때까지 대기
  await Promise.all([p1.aimHold(-0.2, 0.1, 3500), p2.aimHold(0.2, 0.1, 3500)]);

  // 2. 2P 다시 끊김 후 "혼자 계속하기" 클릭 -> 2P "나감" 상태 만들기
  log('Disconnecting 2P and clicking 혼자 계속하기...');
  p2.close();
  await sleep(1500);
  const continueAloneBtn = page.getByText('혼자 계속하기');
  if (await continueAloneBtn.count()) {
    await continueAloneBtn.first().click();
    await sleep(1000);
  }

  // 2P가 나간 상태에서 몬스터들이 방어선을 뚫어 게임 오버가 될 때까지 대기
  log('Waiting for monsters to breach defense and trigger Game Over...');
  for (let i = 0; i < 60; i++) {
    // 1P 조준 프레임만 보내고 사격은 안 함
    await p1.aimHold(0, 0, 1000);
    const gameOverButtons = await page.locator('[data-shootable="restart"]').count();
    if (gameOverButtons > 0) {
      log(`Game Over reached after ~${i}s!`);
      break;
    }
  }

  await sleep(2000);
  // C-12: 결과 화면 캡처 (2P 칸 "나감" 배지, 점수, 팀 랭킹 탭 등)
  await shot(page, 'C-12-result-away-badge');

  // C-12: 폰 사격으로 "다시 시작" 버튼 쏴서 동작 확인
  log('Finding "다시 시작" button location...');
  const restartBtn = page.locator('[data-shootable="restart"]');
  if (await restartBtn.count()) {
    const box = await restartBtn.boundingBox();
    if (box) {
      log('Restart button boundingBox:', box);
      // 화면 1440x900 기준 정규화 좌표 (-1 ~ 1)
      const btnX = ((box.x + box.width / 2) / 1440) * 2 - 1;
      const btnY = 1 - ((box.y + box.height / 2) / 900) * 2;
      log('Aiming at restart button:', { btnX, btnY });

      // 1P 폰으로 버튼 조준
      await p1.aimHold(btnX, btnY, 600);
      await shot(page, 'C-12-result-aim-restart-button');

      // 1P 폰으로 버튼 사격!
      log('Phone 1 snapping restart button...');
      await p1.snap(btnX, btnY);
      await sleep(1500);

      // 다시 시작되어 무기 선택 또는 카운트다운 화면으로 넘어갔는지 캡처
      await shot(page, 'C-12-result-restart-triggered');
    }
  } else {
    log('ERROR: restart button not found!');
  }

  p1.close();
  p2.close();
  await page.context().close();
  await browser.close();

  log('Flow 4 finished. Errors caught:', errors.length);
  if (errors.length) {
    console.log('Errors:', errors);
  }
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
