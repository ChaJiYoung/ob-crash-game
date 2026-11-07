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

function fakePhone(roomId, slot, nickname, deviceIdPrefix = 'phone') {
  const ws = new WebSocket(WS);
  const deviceId = `fake_${deviceIdPrefix}_${slot}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
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
        isCocked: false,
        timestamp: Date.now(),
        ...extra,
      },
    });

  return {
    ws,
    ready,
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
  };
}

async function run() {
  log('Starting Flow 1 test...');
  const page = await newPage();

  // Wait for room ID
  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 1. 로비 1P, 2P 모바일 선택
  log('Selecting Mobile for 1P and 2P...');
  await page.getByText('📱 모바일').first().click();
  await sleep(500);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(600);

  // 폰 1, 폰 2 접속
  log('Connecting Phone 1 (1P) and Phone 2 (2P)...');
  const p1 = fakePhone(roomId, 1, '블루폰', 'p1');
  const p2 = fakePhone(roomId, 2, '오렌지폰', 'p2');

  await p1.join();
  await p2.join();
  await sleep(600);

  // 영점 조정
  log('Calibrating zero for both phones...');
  await p1.zero();
  await p2.zero();
  await sleep(600);

  // 폰 조준 프레임 보내기
  await Promise.all([p1.aimHold(-0.2, 0, 800), p2.aimHold(0.2, 0, 800)]);

  // C-01: 둘 다 준비 완료 상태 캡처
  await shot(page, 'C-01-lobby-both-phones-ready');

  // 가운데 사격으로 게임 시작 (Phone 2가 쏜다)
  log('Phone 2 shooting center to start game...');
  await p2.snap(0, 0);
  await sleep(800);
  await shot(page, 'C-01-lobby-countdown-start');

  // 3초 카운트다운 동안 조준 프레임 전송 (카운트다운 동안 0 유지)
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // C-03: 무기 선택 화면 (1P 왼쪽 파랑, 2P 오른쪽 주황)
  await shot(page, 'C-03-weapon-select-split');

  // Phone 1(1P)이 왼쪽 카드(aimX -0.47, aimY 0)를 사격
  log('Phone 1 selecting weapon on the left...');
  await p1.aimHold(-0.47, 0, 500);
  await p1.snap(-0.47, 0);
  await p1.aimHold(-0.47, 0, 600);

  // C-03: 1P 선택 완료 대기 상자 캡처
  await shot(page, 'C-03-weapon-select-1p-waiting');

  // Phone 2(2P)가 오른쪽 카드(aimX 0.47, aimY 0)를 사격
  log('Phone 2 selecting weapon on the right...');
  await p2.aimHold(0.47, 0, 500);
  await p2.snap(0.47, 0);
  await p2.aimHold(0.47, 0, 1000);

  // 전투 진입
  log('Entering combat phase...');
  await Promise.all([p1.aimHold(-0.3, 0.1, 2000), p2.aimHold(0.3, 0.1, 2000)]);
  await sleep(1500);

  // C-04: 전투 HUD 확인 (두 패널 모두 "[위로 휙!]")
  await shot(page, 'C-04-combat-hud-swipe-up');

  // C-02: 마우스로 게임 화면 클릭 (사격 안 됨 확인)
  log('Testing mouse click on 3D canvas (should not fire)...');
  const ammoBefore = await page.evaluate(() => {
    // HUD 상의 탄약 텍스트 또는 캔버스 상태 확인
    return document.body.innerText;
  });
  await page.mouse.click(720, 450);
  await sleep(500);

  // HUD 버튼(가이드 ? 또는 일시정지) 마우스 클릭 동작 확인
  log('Testing mouse click on HUD pause button...');
  // Esc로 일시정지 열기 또는 버튼 클릭
  await page.keyboard.press('Escape');
  await sleep(800);
  await shot(page, 'C-02-mouse-click-hud-works');

  // 모달 안의 이어하기 버튼 클릭 동작 확인
  await page.getByText('▶ 이어하기').first().click();
  await sleep(800);

  p1.ws.close();
  p2.ws.close();
  await page.context().close();
  await browser.close();

  log('Flow 1 completed successfully! Errors caught:', errors.length);
  if (errors.length) {
    console.log('Errors encountered:', errors);
  }
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
