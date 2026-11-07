import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/A-solo';
const URL = 'https://127.0.0.1:5201/';
const WS = 'ws://localhost:8801';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  log('PAGE ERROR:', e.message);
  errors.push(`PAGE ERROR: ${e.message}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(2500);

const shot = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

function createFakePhone(roomId, slot, nickname) {
  let ws = new WebSocket(WS);
  const deviceId = `phone_res_test_${slot}_${Date.now()}`;
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
    ws,
    deviceId,
    frame,
    async join() {
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async zero() {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot });
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
    close() {
      try { ws.close(); } catch {}
    }
  };
}

log('=== Starting Test A-2 Result Shot (Targeted) ===');
// 1P 📱 선택
await page.getByText('📱 모바일').first().click();
await sleep(1000);
const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
log('Room ID:', roomId);

const phone = createFakePhone(roomId, 1, '결과조준폰');
await phone.join();
await phone.zero();
await phone.aimHold(0, 0, 500);

// 화면 가운데 사격하여 게임 시작 (D33)
log('Phone shooting center to start game...');
await phone.snap(0, 0);
await phone.aimHold(0, 0, 4200); // 3초 카운트다운 동안 조준 유지
await sleep(1000);

// 무기 카드 선택: 가운데 카드 클릭 (마우스로 확실하게 카드 선택)
log('Selecting weapon card...');
await page.mouse.click(720, 450);
await sleep(2000);

// 전투 진입 확인
const inCombat = await page.evaluate(() => document.body.innerText.includes('BAR DEFENSE'));
log('In combat confirmed:', inCombat);

// 게임 오버될 때까지 대기 (최대 100초)
log('Waiting for game over screen...');
let reachedResult = false;
for (let i = 0; i < 100; i++) {
  const hasRestart = await page.locator('[data-shootable="restart"]').count();
  if (hasRestart > 0) {
    reachedResult = true;
    break;
  }
  await phone.aimHold(0, 0, 1000);
}

if (!reachedResult) {
  log('Could not reach result screen within timeout');
  phone.close();
  await browser.close();
  process.exit(1);
}

log('Reached Result Screen!');
await sleep(2000);
await shot('A-2-11-phone-result-screen');

// 1. 버튼 밖 사격 테스트 (허공: aimX = 0.8, aimY = -0.8)
log('Testing shot outside button (aim: 0.8, -0.8)...');
await phone.aimHold(0.8, -0.8, 600);
await phone.snap(0.8, -0.8);
await sleep(1000);
const stillOnResult = await page.locator('[data-shootable="restart"]').count();
log('Still on result screen after outside shot:', stillOnResult > 0);

// 2. "다시 시작" 버튼 위치 확인 및 조준
const restartBtn = page.locator('[data-shootable="restart"]').first();
const box = await restartBtn.boundingBox();
log('Restart button box:', box);

if (box) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const normX = (centerX - 720) / 720;
  const normY = (centerY - 450) / 450;
  log(`Aiming at restart button: normX=${normX.toFixed(3)}, normY=${normY.toFixed(3)}`);

  await phone.aimHold(normX, normY, 800);
  await shot('A-2-12-phone-aiming-restart-button');

  // 사격!
  log('Shooting restart button with phone...');
  await phone.snap(normX, normY);
  await sleep(3000);

  // 다시 시작 동작 확인 (무기 선택 화면으로 복귀)
  const restartSuccess = await page.evaluate(() => {
    return document.body.innerText.includes('무기') || document.body.innerText.includes('리볼버') || document.body.innerText.includes('선택');
  });
  log('Restarted successfully:', restartSuccess);
  await shot('A-2-13-phone-restart-action');
}

phone.close();
await browser.close();
log('Errors encountered:', errors);
log('=== Done Test A-2 Result Shot ===');
process.exit(0);
