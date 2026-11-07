import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/A-solo';
const URL = 'https://127.0.0.1:5201/';
const WS = 'ws://localhost:8801';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const consoleLogs = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function createPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', text);
      errors.push(`CONSOLE ERROR: ${text}`);
    } else {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(2000);
  return page;
}

const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

function createFakePhone(roomId, slot, nickname) {
  let ws = new WebSocket(WS);
  const deviceId = `phone_solo_${slot}_${Date.now()}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  let ready = new Promise((res) => ws.on('open', res));
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') log('phone ERROR', m.code, m.message);
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
    get ws() { return ws; },
    deviceId,
    frame,
    async join() {
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async zero(resume = false) {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume });
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
    async holdFire(aimX, aimY, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY, { rapidFireHold: true });
        await sleep(33);
      }
      frame(aimX, aimY, { rapidFireHold: false });
    },
    async fever(aimX, aimY) {
      frame(aimX, aimY, { feverTriggered: true });
      await sleep(60);
      frame(aimX, aimY);
    },
    async skill(aimX, aimY) {
      frame(aimX, aimY, { skillSnapTriggered: true });
      await sleep(60);
      frame(aimX, aimY);
    },
    close() {
      ws.close();
    },
    async reconnect() {
      ws = new WebSocket(WS);
      ready = new Promise((res) => ws.on('open', res));
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
      await sleep(300);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, resume: true });
      await sleep(400);
    }
  };
}

log('=== Starting Test A-2 (Phone Solo 1P) ===');

const page = await createPage();

// 1. 1P 📱 선택 -> QR, 방 코드, URL에 slot=1 확인
log('Selecting 1P Mobile...');
const mobileBtn1 = page.getByText('📱 모바일').first();
await mobileBtn1.click();
await sleep(1000);

const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
log('Lobby Room ID:', roomId);

// URL 및 텍스트 검사
const qrCardInfo = await page.evaluate(() => {
  const card1 = document.querySelectorAll('[style*="border-color"]')[0] || document.body;
  const qrLinks = Array.from(document.querySelectorAll('a, p, span, div'))
    .map(el => el.textContent?.trim() || '')
    .filter(t => t.includes('slot=') || t.includes('controller'));
  return { qrLinks: qrLinks.slice(0, 5), text: document.body.innerText.slice(0, 500) };
});
log('QR Card Info:', JSON.stringify(qrCardInfo, null, 2));

await shot(page, 'A-2-01-lobby-phone-1p-qr');

// 2. 가짜 폰 연결 (1P 슬롯)
log('Connecting fake phone to slot 1...');
const phone = createFakePhone(roomId, 1, '폰모바일1P');
await phone.join();
await sleep(1000);

// 영점 전 "영점을 맞춰 주세요" 확인
await shot(page, 'A-2-02-phone-joined-need-zero');
const zeroPrompt = await page.evaluate(() => document.body.innerText.includes('영점'));
log('Zero prompt visible:', zeroPrompt);

// 영점 맞추기
log('Calibrating zero...');
await phone.zero();
await phone.aimHold(0, 0, 800);
await shot(page, 'A-2-03-phone-ready');

// 3. 폰으로 화면 가운데 사격 -> 카운트다운 3초 -> 시작 (D33)
log('Phone shooting center to start game (D33)...');
await phone.aimHold(0, 0, 300);
await phone.snap(0, 0);

// 카운트다운 캡처 (3초 카운트다운 중)
await sleep(1200);
await shot(page, 'A-2-04-phone-start-countdown');

// 카운트다운 끝날 때까지 폰 조준 유지
await phone.aimHold(0, 0, 3000);
await sleep(1000);

// 4. 무기 카드 폰 사격으로 선택
await shot(page, 'A-2-05-phone-weapon-select');

// 가운데 무기 카드 조준 사격 (0, 0 근처)
log('Phone shooting center weapon card...');
await phone.aimHold(0, 0, 400);
await phone.snap(0, 0);
await sleep(1500);

// 5. 전투 HUD 확인 (스킬 안내 "[위로 휙!]" 하나만 확인, 시안 5-1 비교)
await shot(page, 'A-2-06-phone-combat-hud');

const hudDetails = await page.evaluate(() => {
  const fullText = document.body.innerText;
  const hasUpFlick = fullText.includes('위로 휙');
  const hasRightClick = fullText.includes('우클릭');
  const has1P = fullText.includes('1P ·');
  return { hasUpFlick, hasRightClick, has1P, snippet: fullText.slice(0, 300) };
});
log('Phone Combat HUD Details:', hudDetails);

// 6. 조작 테스트: 단발(snap), 홀드 연사, 피버, 스킬
log('Testing Phone Controls: snap, hold, fever, skill...');
// 시작 1.5초 후
await phone.aimHold(0.1, 0.1, 2000);

// 단발
log('Testing single snap...');
await phone.snap(0.1, 0.1);
await sleep(400);

// 홀드 연사
log('Testing rapid fire hold...');
await phone.holdFire(0.1, 0.1, 1500);
await sleep(500);

// 스킬
log('Testing skill gesture...');
await phone.skill(0.1, 0.1);
await sleep(1000);

// 피버
log('Testing fever...');
await phone.fever(0.1, 0.1);
await sleep(1000);

await shot(page, 'A-2-07-phone-combat-actions');

// 7. 폰 끊김 테스트: 폰 연결 종료 -> 일시정지 "폰 재연결 중" 무기한 유지 확인
log('Disconnecting phone to test disconnect handling...');
phone.close();
await sleep(2000);
await shot(page, 'A-2-08-phone-disconnected-pause');

const disconnectModal = await page.evaluate(() => {
  return {
    text: document.body.innerText.slice(0, 400),
    hasReconnectWaiting: document.body.innerText.includes('재연결') || document.body.innerText.includes('연결 끊김') || document.body.innerText.includes('일시정지')
  };
});
log('Disconnect Modal:', disconnectModal);

// 5초 더 대기해도 무기한 유지되는지 확인 (1인 판은 30초 카운트다운 없이 무기한 대기)
await sleep(5000);
await shot(page, 'A-2-09-phone-disconnect-indefinite');

// 8. 폰 재접속 -> "다시 연결됨" / 게임 재개 확인
log('Reconnecting fake phone...');
await phone.reconnect();
await phone.aimHold(0, 0, 1500);
await shot(page, 'A-2-10-phone-reconnected-resume');

// 9. 결과 화면 도달 대기 및 버튼 사격 테스트
log('Waiting for game over to reach result screen...');
let resultReached = false;
for (let i = 0; i < 60; i++) {
  const hasRestart = await page.locator('[data-shootable="restart"]').count();
  if (hasRestart > 0) {
    resultReached = true;
    break;
  }
  // 가만히 대기하여 방어선 무너지게 함
  await phone.aimHold(0, 0, 1000);
}

if (resultReached) {
  log('Result screen reached on phone 1P!');
  await sleep(1500);
  await shot(page, 'A-2-11-phone-result-screen');

  // 버튼 밖을 쏘면 아무 일 없음 테스트 (조준 0.8, -0.8 등 허공 사격)
  log('Shooting outside button (aim: 0.8, -0.8)...');
  await phone.aimHold(0.8, -0.8, 400);
  await phone.snap(0.8, -0.8);
  await sleep(1000);
  const stillOnResult = await page.locator('[data-shootable="restart"]').count();
  log('Still on result screen after outside shot:', stillOnResult > 0);

  // 결과 화면의 "다시 시작" 버튼 위치를 찾아 조준 후 사격
  // Playwright로 restart 버튼의 bounding box를 가져와 가상 조준 좌표로 변환
  const restartBtn = page.locator('[data-shootable="restart"]').first();
  const box = await restartBtn.boundingBox();
  if (box) {
    // 캔버스 중심(720, 450) 기준 정규화 좌표 (-1 ~ 1)
    const btnCenterX = box.x + box.width / 2;
    const btnCenterY = box.y + box.height / 2;
    const normX = (btnCenterX - 720) / 720;
    const normY = (btnCenterY - 450) / 450;
    log(`Restart button pos: (${btnCenterX}, ${btnCenterY}) -> norm: (${normX.toFixed(2)}, ${normY.toFixed(2)})`);

    await phone.aimHold(normX, normY, 600);
    await shot(page, 'A-2-12-phone-aiming-restart-button');
    await phone.snap(normX, normY);
    await sleep(2500);
    await shot(page, 'A-2-13-phone-restart-action');
  }
}

await browser.close();
log('Errors encountered in A-2:', errors);
log('=== Done Test A-2 ===');
