import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '../node_modules/ws/wrapper.mjs';
import path from 'node:path';

const OUT = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone');
const URL = 'https://127.0.0.1:5202/';
const WS = 'ws://localhost:8802';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl']
});

async function newPCPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR', e.message);
    errors.push({ type: 'pageerror', message: e.message });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log('CONSOLE ERROR', msg.text());
      errors.push({ type: 'console.error', text: msg.text() });
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);
  return { ctx, page };
}

function fakePhone(roomId, slot, nickname, customDeviceId) {
  const ws = new WebSocket(WS);
  const deviceId = customDeviceId || `test_phone_${slot}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  let lastError = null;
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') {
        log(`phone [${slot}] ERROR:`, m.code, m.message);
        lastError = m;
      }
    } catch (e) {}
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
    getLastError: () => lastError,
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
        await sleep(30);
      }
    },
    async snap(aimX, aimY) {
      frame(aimX, aimY, { snapFire: true });
      await sleep(60);
      frame(aimX, aimY);
    },
  };
}

log('Starting Lobby & Slot tests...');
const { ctx, page } = await newPCPage();

// 1. 초기 상태 캡처
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-initial.png') });
const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
log('Lobby Room ID:', roomId);

// 1P 마우스 선택 후 닉네임 입력 대기
await page.getByText('🖱 마우스').first().click();
await sleep(300);
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-1p-mouse-input.png') });

// 1P 닉네임 입력 & 등록
await page.getByPlaceholder('닉네임 입력').fill('마우스1P');
await page.getByText('확인', { exact: true }).click();
await sleep(500);

// 2P 모바일 선택
await page.getByText('📱 모바일').nth(1).click();
await sleep(500);
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-1p-ready-2p-waiting.png') });

// 1P만 준비된 상태에서 시작 시도 -> "2P 준비 중" 안내 문구 확인
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.click();
await sleep(300);
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-2p-waiting-notice.png') });

// 2P 가짜 폰 연결 (아직 영점 안 함)
const phone2P = fakePhone(roomId, 2, '폰2P');
await phone2P.join();
await sleep(500);
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-2p-paired-not-zeroed.png') });

// 2P 폰 영점 완료
await phone2P.zero();
await phone2P.aimHold(0, 0, 500);
await sleep(500);
await page.screenshot({ path: path.join(OUT, 'B-01-lobby-both-ready.png') });

// 2. 다른 기기가 차지한 슬롯 거절 및 슬롯 이동 테스트
// 실제 모바일 컨트롤러 페이지를 새 context로 열어서 거절 화면 확인
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const phonePage = await phoneCtx.newPage();
// 이미 phone2P가 slot 2를 차지한 상태에서 다른 deviceId로 slot 2에 접속 시도
await phonePage.goto(`${URL}controller?room=${roomId}&slot=2`);
await sleep(1500);
// 닉네임 등록 화면이 나오면 등록 시도
const nickInput = phonePage.getByPlaceholder('닉네임 입력');
if (await nickInput.count()) {
  await nickInput.fill('불청객');
  await phonePage.getByText('시작하기').click();
  await sleep(1500);
}
await phonePage.screenshot({ path: path.join(OUT, 'B-02-phone-slot-occupied-rejected.png') });

// 같은 기기(phone2P)가 다른 슬롯(1P 슬롯 QR: slot=1)으로 다시 붙으면 슬롯 이동되는지 테스트
// 1P를 모바일로 바꾸려면 먼저 1P 마우스를 해제하거나, 폰2P가 slot 1로 attachControllerSocket 시도
// ws로 직접 테스트
const phone2P_move = fakePhone(roomId, 1, '폰2P', phone2P.deviceId);
await phone2P_move.join();
await sleep(500);
log('Phone2P move lastError:', phone2P_move.getLastError());

await page.screenshot({ path: path.join(OUT, 'B-02-slot-move-pc.png') });

await phoneCtx.close();
await ctx.close();
await browser.close();

console.log('Lobby & Slot test finished. Errors:', errors);
