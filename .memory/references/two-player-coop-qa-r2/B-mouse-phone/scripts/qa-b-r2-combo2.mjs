import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone');
const URL = 'https://127.0.0.1:5202/';
const WS = 'ws://localhost:8802';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const collectedErrors = [];
const collectedLogs = [];

function recordError(type, msg) {
  log(`[ERROR ${type}]`, msg);
  collectedErrors.push({ type, msg, time: new Date().toISOString() });
}

function fakePhone(roomId, slot, nickname, customDeviceId) {
  const ws = new WebSocket(WS);
  const deviceId = customDeviceId || `fake_phone_s${slot}_${Date.now()}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  let lastError = null;
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') {
        log(`phone [slot ${slot}] ERROR:`, m.code, m.message);
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
    async aimHold(aimX, aimY, ms, extra = {}) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY, extra);
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

async function runCombo2() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => recordError('pageerror', e.message));
  page.on('console', (msg) => {
    const text = msg.text();
    collectedLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      recordError('console.error', text);
    }
  });

  const shot = async (name) => {
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    log('Saved screenshot:', name);
  };

  const getSnapshot = async () => {
    return await page.evaluate(() => (window.__BEER_DEBUG__?.snapshot ? window.__BEER_DEBUG__.snapshot() : null));
  };

  log('--- Starting Combination 2: 1P Phone + 2P Mouse ---');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  let roomId = null;
  for (let i = 0; i < 30; i++) {
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
    if (roomId) break;
    await sleep(300);
  }
  log('Room ID:', roomId);

  const slot1 = page.locator('[data-testid="slot-card-1"]');
  const slot2 = page.locator('[data-testid="slot-card-2"]');

  // 1P 모바일 선택
  await slot1.getByRole('button', { name: '📱 모바일' }).click();
  await sleep(400);

  // 2P 마우스 선택
  await slot2.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await slot2.locator('input[placeholder="닉네임 입력"]').fill('마우스2P');
  await slot2.locator('button[type="submit"]').click();
  await sleep(400);

  // B2-01: 1P 폰 미연결 상태에서 "1P 준비 중" 게이트 확인
  await shot('B2-01-lobby-start-gate');

  // 1P 폰 연결
  const phone = fakePhone(roomId, 1, '모바일1P');
  await phone.join();
  await sleep(600);
  await phone.zero();
  await phone.aimHold(0, 0, 500);
  await sleep(600);
  await shot('B2-01b-lobby-both-ready');

  // B2-02: 로비 폰 시작 - 화면 가운데(0, 0) 사격 snap(0, 0)으로 시작 (D33)
  log('B2-02: Starting game via 1P Phone center shot...');
  await phone.aimHold(0, 0, 300);
  await phone.snap(0, 0);
  // 3초 카운트다운 동안 폰 조준 0 유지
  await phone.aimHold(0, 0, 4200);
  await sleep(1500);

  // B2-03: 무기 선택 화면 (1P 폰 왼쪽 파랑, 2P 마우스 오른쪽 주황)
  await shot('B2-03-weapon-select');

  // 1P 폰이 왼쪽 카드 사격
  log('1P phone selecting left weapon card...');
  await phone.aimHold(-0.47, -0.05, 500);
  await phone.snap(-0.47, -0.05);
  await phone.aimHold(-0.47, -0.05, 500);
  await sleep(600);

  // 2P 마우스가 오른쪽 카드 클릭 (확실하게 done[1]이 될 때까지)
  log('2P mouse selecting right weapon card...');
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getSnapshot();
    if (snap?.selection?.done?.[1]) {
      log('2P card selected successfully!');
      break;
    }
    const targetX = 1440 * (0.735 + (attempt - 2) * 0.03);
    const targetY = 900 * 0.5;
    log(`2P click attempt ${attempt} at (${targetX}, ${targetY})`);
    await page.mouse.move(targetX, targetY, { steps: 4 });
    await sleep(100);
    await page.mouse.down();
    await sleep(120);
    await page.mouse.up();
    await sleep(400);
  }

  // 전투 진입 대기
  await phone.aimHold(0, 0, 3000);

  // B2-07: 전투 HUD (1P 폰 좌하단 파랑, 2P 마우스 우하단 주황)
  await page.mouse.move(1440 * 0.7, 900 * 0.45);
  await phone.aimHold(-0.35, -0.1, 800);
  await shot('B2-07-combat-hud');

  // B2-08: 스킬 안내 (1P 폰 [위로 휙!], 2P 마우스 [우클릭])
  await shot('B2-08-skill-badges');

  // B2-09: 십자선 (1P 폰 파랑 1P, 2P 마우스 주황 2P)
  await shot('B2-09-crosshairs');

  // 5-4 P01 핵심 검증: 마우스 이동이 2P 마우스 총·십자선만 움직이고 1P 폰에는 영향 없는지 확인
  log('Testing 5-4 / P01 Mouse movement isolation...');
  // 1P 폰은 (-0.5, 0.2)로 고정
  await phone.aimHold(-0.5, 0.2, 500);

  // 마우스를 화면 우측 상단으로 이동 (x=1200, y=200)
  await page.mouse.move(1200, 200, { steps: 5 });
  await phone.aimHold(-0.5, 0.2, 500);
  await shot('B2-10-mouse-isolation-move1');

  // 마우스를 화면 우측 하단으로 이동 (x=1100, y=700)
  await page.mouse.move(1100, 700, { steps: 5 });
  await phone.aimHold(-0.5, 0.2, 500);
  await shot('B2-10-mouse-isolation-move2');

  // 십자선 DOM 좌표 확인
  const crosshairs = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('[data-testid^="crosshair-"]'));
    return list.map((el) => {
      const rect = el.getBoundingClientRect();
      return { id: el.getAttribute('data-testid'), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
  });
  log('Crosshairs positions during mouse move:', crosshairs);

  // B2-12: 입력 분리 검증 (폰 사격 -> 1P 점수만, 마우스 사격 -> 2P 점수만)
  const snapBeforeFire = await getSnapshot();
  const p1ScoreBefore = snapBeforeFire?.players[0]?.score || 0;
  const p2ScoreBefore = snapBeforeFire?.players[1]?.score || 0;

  // 1P 폰 사격
  await phone.aimHold(-0.5, 0.2, 200);
  await phone.snap(-0.5, 0.2);
  await sleep(300);

  // 2P 마우스 사격
  await page.mouse.click(1100, 450);
  await sleep(300);

  await shot('B2-12-input-separation');

  // 결과 화면 대기
  log('Waiting for game over to check B2-18 result...');
  for (let i = 0; i < 90; i++) {
    const snap = await getSnapshot();
    if (snap?.phase === 'GAMEOVER' || (snap?.lives !== undefined && snap.lives <= 0)) break;
    const restartVisible = await page.locator('[data-shootable="restart"]').isVisible().catch(() => false);
    if (restartVisible) break;
    await phone.aimHold(-0.5, 0.2, 1000);
  }
  await sleep(2500);
  await shot('B2-18-result');

  // 에러 리포트 저장
  fs.writeFileSync(
    path.join(OUT, 'combo2-errors.json'),
    JSON.stringify({ errors: collectedErrors, logs: collectedLogs.slice(-50) }, null, 2)
  );
  log('Finished Combo 2. Errors count:', collectedErrors.length);

  phone.ws.close();
  await browser.close();

  return { errors: collectedErrors };
}

runCombo2()
  .then((res) => {
    log('Combo 2 completed successfully:', res);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Combo 2 FATAL ERROR:', e);
    process.exit(1);
  });
