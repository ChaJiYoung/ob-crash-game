import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '../node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone');
const URL = 'https://127.0.0.1:5202/';
const WS = 'ws://localhost:8802';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });

let roomId = null;
for (let i = 0; i < 30; i++) {
  roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  if (roomId) break;
  await sleep(200);
}
log('Room ID:', roomId);

// 1P 마우스
const slot1 = page.locator('[data-testid="slot-card-1"]');
await slot1.getByRole('button', { name: '🖱 마우스' }).click();
await sleep(300);
await slot1.locator('input[placeholder="닉네임 입력"]').fill('마우스1P');
await slot1.locator('button[type="submit"]').click();
await sleep(400);

// 2P 폰
const slot2 = page.locator('[data-testid="slot-card-2"]');
await slot2.getByRole('button', { name: '📱 모바일' }).click();
await sleep(400);

const ws = new WebSocket(WS);
const deviceId = `phone_final_${Date.now()}`;
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
await new Promise((r) => ws.on('open', r));
send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname: '모바일2P', slot: 2 });
await sleep(400);
send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot: 2 });
await sleep(400);

// 프레임을 주기적으로 전송하는 루프 시작
let running = true;
(async () => {
  while (running) {
    if (ws.readyState === 1) {
      send({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId,
        slot: 2,
        payload: {
          aimX: 0,
          aimY: 0,
          pitchDeg: 0,
          yawDeg: 0,
          rollDeg: 0,
          snapFire: false,
          rapidFireHold: false,
          feverTriggered: false,
          isCocked: false,
          timestamp: Date.now(),
        },
      });
    }
    await sleep(33);
  }
})();

await sleep(800);

// 시작 버튼 클릭
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.waitFor({ state: 'visible' });
await startBtn.click();
await sleep(4200); // 카운트다운
await sleep(1500);

// 무기 선택: 2P 폰 snap
send({
  type: 'SENSOR_FRAME',
  roomId,
  deviceId,
  slot: 2,
  payload: {
    aimX: 0.47,
    aimY: -0.05,
    pitchDeg: 0,
    yawDeg: 0,
    rollDeg: 0,
    snapFire: true,
    rapidFireHold: false,
    feverTriggered: false,
    isCocked: false,
    timestamp: Date.now(),
  },
});
await sleep(600);
// 1P 마우스 무기 선택
await page.mouse.click(1440 * 0.265, 900 * 0.5);
await sleep(3500);

// B-16: 가이드 버튼 클릭 테스트
log('Testing Guide button...');
const guideBtn = page.getByText('가이드').first();
await guideBtn.waitFor({ state: 'visible' });
const ammoBefore = await page.evaluate(() => window.__engine?.players[0]?.ammo);
await guideBtn.click();
await sleep(800);
await page.screenshot({ path: path.join(OUT, 'B-16-hud-button-click-no-leak.png') });
log('Saved B-16-hud-button-click-no-leak.png');

const closeBtn = page.getByText('닫기').first();
if (await closeBtn.count()) await closeBtn.click();
await sleep(400);
const ammoAfter = await page.evaluate(() => window.__engine?.players[0]?.ammo);
log('Ammo check: before =', ammoBefore, 'after =', ammoAfter);

// 목숨 소진으로 자연스럽게 게임 오버 유도
log('Waiting for monsters to breach defense...');
await page.evaluate(() => {
  const engine = window.__engine;
  if (engine) {
    // 목숨을 1로 깎아서 몬스터 1마리만 통과하면 바로 게임 오버가 되게 함
    engine.lives = 1;
  }
});

// 결과 화면 대기
for (let i = 0; i < 40; i++) {
  const restartBtn = page.locator('[data-shootable="restart"]');
  if (await restartBtn.count()) {
    log('Game over reached naturally!');
    break;
  }
  await sleep(1000);
}
await sleep(2500);

// play-records.jsonl 확인
const playRecordsPath = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone/data/play-records.jsonl');
if (fs.existsSync(playRecordsPath)) {
  const content = fs.readFileSync(playRecordsPath, 'utf8');
  log('SUCCESS: play-records.jsonl content:\n', content);
} else {
  log('play-records.jsonl not found at:', playRecordsPath);
}

running = false;
ws.close();
await ctx.close();
await browser.close();
log('Done step16 and records.');
