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
  const deviceId = `phone_solo_slot2_${Date.now()}`;
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
      ws.close();
    }
  };
}

log('=== Starting Test A-3 (Phone Solo in 2P Slot) ===');

const page = await createPage();

// 1. 1P 슬롯은 비어 두고, 2P 슬롯의 '📱 모바일' 선택
log('Selecting 2P Mobile button (leaving 1P empty)...');
const mobileButtons = page.getByText('📱 모바일');
await mobileButtons.nth(1).click();
await sleep(1000);

const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
log('Lobby Room ID:', roomId);

// 2. 가짜 폰을 slot 2로 연결
log('Connecting fake phone to slot 2...');
const phone = createFakePhone(roomId, 2, '혼자2P폰');
await phone.join();
await phone.zero();
await phone.aimHold(0, 0, 800);

await shot(page, 'A-3-01-lobby-2p-phone-only');

const lobbySlotsInfo = await page.evaluate(() => {
  return {
    text: document.body.innerText.slice(0, 500)
  };
});
log('Lobby slots state:', lobbySlotsInfo.text.slice(0, 200));

// 3. 폰으로 화면 가운데 사격 -> 1인 판 시작 확인 (D06, D33)
log('Phone shooting center to start game...');
await phone.snap(0, 0);
await phone.aimHold(0, 0, 4200);

// 무기 선택 화면
log('Shooting weapon card...');
await phone.snap(0, 0);
await sleep(2500);

// 4. 전투 HUD 확인: 1인 모양(1P/2P 배지 없음, 앰버 색상, 개인 패널 1개)
log('Checking Combat HUD for Solo 2P Phone...');
await shot(page, 'A-3-02-combat-2p-phone-solo');

const combatInfo = await page.evaluate(() => {
  const full = document.body.innerText;
  const has1PBadge = full.includes('1P ·') || full.includes('1P 배지');
  const has2PBadge = full.includes('2P ·') || full.includes('2P 배지');
  const hasBarDefense = full.includes('BAR DEFENSE') && !full.includes('TEAM · BAR DEFENSE');
  const hasSkillFlick = full.includes('위로 휙');
  const panels = document.querySelectorAll('[style*="rgba(17, 24, 39"]').length;
  return { has1PBadge, has2PBadge, hasBarDefense, hasSkillFlick, panels, snippet: full.slice(0, 200) };
});
log('Combat HUD evaluation:', combatInfo);

// 5. 센서 랩(샌드박스) 진입 및 영점 리셋 테스트
log('Entering Sensor Lab from HUD...');
const sensorLabBtn = page.getByText('센서 연구소');
if (await sensorLabBtn.count()) {
  await sensorLabBtn.first().click();
  await sleep(1500);
}

await shot(page, 'A-3-03-sensor-lab-overlay');

// "🎯 정면 영점 리셋" 버튼 클릭
log('Clicking Zero Reset button in Sensor Lab...');
const zeroResetBtn = page.getByText('정면 영점 리셋');
if (await zeroResetBtn.count()) {
  await zeroResetBtn.first().click();
  await sleep(1000);
  await shot(page, 'A-3-03-sensor-lab-zero-reset');
}

// "실전 시작" 버튼 동작 확인 (시작 조건 거침)
log('Testing Real Game Start from Sensor Lab...');
const startRealBtn = page.getByText('실전 시작');
if (await startRealBtn.count()) {
  await startRealBtn.first().click();
  await sleep(2500);
  await shot(page, 'A-3-04-sensor-lab-start-game');
}

phone.close();
await browser.close();
log('Errors encountered in A-3:', errors);
log('=== Done Test A-3 ===');
process.exit(0);
