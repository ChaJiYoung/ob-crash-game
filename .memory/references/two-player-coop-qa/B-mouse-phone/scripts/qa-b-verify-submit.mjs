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
const deviceId = `phone_submit_${Date.now()}`;
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
await new Promise((r) => ws.on('open', r));
send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname: '모바일2P', slot: 2 });
await sleep(400);
send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot: 2 });
await sleep(400);

// 시작
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.waitFor({ state: 'visible' });
await startBtn.click();
await sleep(4200); // 카운트다운
await sleep(1500);

// 무기 선택
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
await page.mouse.click(1440 * 0.265, 900 * 0.5);
await sleep(3500);

// 게임 오버 유도 (정확한 속성: lives = 0, gamePhase = 'GAMEOVER')
log('Inducing gameover properly...');
await page.evaluate(() => {
  const engine = window.__engine;
  if (engine) {
    engine.lives = 0;
    engine.gamePhase = 'GAMEOVER';
  }
});

// 결과 화면 대기
for (let i = 0; i < 30; i++) {
  const restartBtn = page.locator('[data-shootable="restart"]');
  if (await restartBtn.count()) {
    log('Game over reached, result screen visible!');
    break;
  }
  await sleep(500);
}
await sleep(2500);

// B-18 및 B-19 재캡처
await page.screenshot({ path: path.join(OUT, 'B-18-result-coop.png') });
log('Saved clean B-18-result-coop.png');

// play-records.jsonl 확인
const playRecordsPath = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone/data/play-records.jsonl');
if (fs.existsSync(playRecordsPath)) {
  const content = fs.readFileSync(playRecordsPath, 'utf8');
  log('SUCCESS! play-records.jsonl content:\n', content);
} else {
  log('play-records.jsonl still NOT found at:', playRecordsPath);
}

// B-20 로비로 이동 및 캡처
const toLobbyBtn = page.locator('[data-shootable="lobby"]').first();
if (await toLobbyBtn.count()) {
  await toLobbyBtn.click();
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'B-20-return-to-lobby.png') });
  log('Saved clean B-20-return-to-lobby.png');
}

// B-21 로비 팀 랭킹 탭 캡처
const teamTabBtn = page.getByText('팀 랭킹').first();
if (await teamTabBtn.count()) {
  await teamTabBtn.click();
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'B-21-lobby-team-rank-highlight.png') });
  log('Saved clean B-21-lobby-team-rank-highlight.png');
}

ws.close();
await ctx.close();
await browser.close();
log('Done verify-submit.');
