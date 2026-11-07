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
    async skill(aimX = 0, aimY = 0) {
      frame(aimX, aimY, { skillSnapTriggered: true });
      await sleep(60);
      frame(aimX, aimY);
    },
    async fever(aimX = 0, aimY = 0) {
      frame(aimX, aimY, { feverTriggered: true });
      await sleep(60);
      frame(aimX, aimY);
    },
  };
}

async function runCombo1() {
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

  log('--- Starting Combination 1: 1P Mouse + 2P Phone ---');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  // Room ID 읽기
  let roomId = null;
  for (let i = 0; i < 30; i++) {
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
    if (roomId) break;
    await sleep(300);
  }
  log('Room ID:', roomId);

  // [B-01]: 1P 마우스 설정
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  const slot2 = page.locator('[data-testid="slot-card-2"]');

  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await slot1.locator('input[placeholder="닉네임 입력"]').fill('마우스1P');
  await slot1.locator('button[type="submit"]').click();
  await sleep(400);

  // 2P 슬롯 모바일 선택
  await slot2.getByRole('button', { name: '📱 모바일' }).click();
  await sleep(400);

  // B-01: 한쪽만 준비 완료 시 "2P 준비 중" 안내
  await shot('B-01-lobby-start-gate');
  const startBtn = page.locator('[data-shootable="start"]');
  const isStartDisabled = await startBtn.isDisabled().catch(() => false);
  const startBtnText = await startBtn.textContent().catch(() => '');
  log('Start button state:', { isStartDisabled, startBtnText });

  // 폰 연결
  const phone = fakePhone(roomId, 2, '모바일2P');
  await phone.join();
  await sleep(600);
  await shot('B-01-lobby-2p-uncalibrated');

  // [B-02]: 슬롯 거절 테스트
  log('Testing B-02 slot rejection...');
  const intruderCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const intruderPage = await intruderCtx.newPage();
  await intruderPage.goto(`${URL}controller?room=${roomId}&slot=2`, { waitUntil: 'networkidle' });
  await sleep(1200);
  const intruderInput = intruderPage.getByPlaceholder('닉네임 입력');
  if (await intruderInput.count()) {
    await intruderInput.fill('불청객');
    await intruderPage.getByText('시작하기').click();
    await sleep(1200);
  }
  await intruderPage.screenshot({ path: path.join(OUT, 'B-02-slot-rejection.png') });
  log('Saved B-02-slot-rejection.png');
  await intruderCtx.close();

  // 2P 폰 영점 조절
  await phone.zero();
  await phone.aimHold(0, 0, 500);
  await sleep(600);
  await shot('B-01b-lobby-both-ready');

  // [B-03]: 무기 선택 라운드 진입
  log('Starting game to weapon select...');
  await startBtn.click();
  await phone.aimHold(0, 0, 4200);
  await sleep(1500);
  await shot('B-03-weapon-select-both');

  const snapWeapon = await getSnapshot();
  log('Snapshot at weapon select:', snapWeapon?.phase, snapWeapon?.selection);

  // [B-04]: 1P 마우스로 2P 카드 영역 사격 -> 선택 안 됨
  log('Testing B-04 cross-shooting: 1P mouse clicking 2P card...');
  await page.mouse.move(1440 * 0.75, 900 * 0.5, { steps: 5 });
  await sleep(150);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(600);
  await shot('B-04-weapon-cross-shoot');

  const snapAfterCross = await getSnapshot();
  log('Snapshot after cross shoot:', snapAfterCross?.selection);

  // [B-05]: 2P 폰이 오른쪽 카드 선택 -> 대기 상자 표시
  log('2P phone selecting weapon card on right side...');
  await phone.aimHold(0.47, -0.05, 500);
  await phone.snap(0.47, -0.05);
  await phone.aimHold(0.47, -0.05, 500);
  await sleep(600);
  await shot('B-05-weapon-partial-done');

  const snapPartialDone = await getSnapshot();
  log('Snapshot partial done:', snapPartialDone?.selection);

  // [B-06]: 1P 마우스가 왼쪽 카드 선택 -> 전투 시작
  log('1P mouse selecting weapon card on left side...');
  await page.mouse.move(1440 * 0.265, 900 * 0.5, { steps: 5 });
  await sleep(150);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();

  // 전투 진입 대기 (약 3초)
  await phone.aimHold(0, 0, 3000);
  await shot('B-06-game-start');

  const snapCombat = await getSnapshot();
  log('Snapshot combat started:', snapCombat?.phase, snapCombat?.players);

  // [B-07]: 전투 HUD 확인
  await page.mouse.move(1440 * 0.35, 900 * 0.45);
  await phone.aimHold(0.35, -0.1, 800);
  await shot('B-07-combat-hud');

  // [B-08]: 스킬 안내 확인
  await shot('B-08-skill-badges');

  // [B-09]: 십자선 확인
  await shot('B-09-crosshairs');

  // [5-2 / B-10]: 총구 조준(정량) 3가지 조합 캡처
  log('Testing 5-2 Gun Aim quantitatively...');
  // 조합 1: 1P (-0.7, 0.4) / 2P (0.7, -0.3)
  // 마우스 화면 좌표: x = (-0.7 + 1)/2 * 1440 = 216, y = (1 - 0.4)/2 * 900 = 270
  await page.mouse.move(216, 270, { steps: 5 });
  await phone.aimHold(0.7, -0.3, 1000);
  await shot('B-10-gun-aim-quadrant');

  // 조합 2: 교차: 1P (0.6, 0.0) / 2P (-0.6, 0.0)
  // 마우스: x = (0.6 + 1)/2 * 1440 = 1152, y = 450
  await page.mouse.move(1152, 450, { steps: 5 });
  await phone.aimHold(-0.6, 0.0, 1000);
  await shot('B-10-gun-aim-cross');

  // 조합 3: 가운데: 1P (0, 0) / 2P (0, 0)
  // 마우스: x = 720, y = 450
  await page.mouse.move(720, 450, { steps: 5 });
  await phone.aimHold(0, 0, 1000);
  await shot('B-10-gun-aim-center');

  // [B-11]: 사격 광선 및 판정 팝업
  log('Testing B-11 shooting lasers...');
  await page.mouse.move(720, 350, { steps: 4 });
  await page.mouse.down();
  await sleep(100);
  await page.mouse.up();
  await phone.aimHold(0.2, 0.1, 200);
  await phone.snap(0.2, 0.1);
  await shot('B-11-lasers-and-judgment');

  // [5-1 / B-12]: 연사 검증 (결과로 판정)
  log('Testing 5-1 Rapid Fire on Mouse & Phone...');
  const snapBeforeRapid = await getSnapshot();
  const p1AmmoBefore = snapBeforeRapid?.players[0]?.ammo;
  const p2AmmoBefore = snapBeforeRapid?.players[1]?.ammo;
  log(`Before rapid fire ammo: P1=${p1AmmoBefore}, P2=${p2AmmoBefore}`);

  // 1P 마우스 1초 누르고 있기
  log('P1 Mouse holding down for 1000ms...');
  await page.mouse.move(720, 400);
  await page.mouse.down();
  await sleep(1000);
  await page.mouse.up();
  await sleep(200);

  const snapAfterP1Rapid = await getSnapshot();
  const p1AmmoAfter = snapAfterP1Rapid?.players[0]?.ammo;
  log(`After P1 rapid fire: P1 ammo=${p1AmmoAfter} (delta = ${p1AmmoBefore - p1AmmoAfter})`);

  // 2P 폰 rapidFireHold 1초 유지
  log('P2 Phone rapidFireHold for 1000ms...');
  await phone.aimHold(0.1, 0.1, 1000, { rapidFireHold: true });
  await sleep(200);

  const snapAfterP2Rapid = await getSnapshot();
  const p2AmmoAfter = snapAfterP2Rapid?.players[1]?.ammo;
  log(`After P2 rapid fire: P2 ammo=${p2AmmoAfter} (delta = ${p2AmmoBefore - p2AmmoAfter})`);

  // 입력 분리 스크린샷
  await shot('B-12-input-separation');

  // [B-16]: HUD 버튼 클릭이 사격으로 새지 않음
  log('Testing B-16 HUD button click no leak...');
  const snapBeforeBtn = await getSnapshot();
  const p1AmmoBeforeBtn = snapBeforeBtn?.players[0]?.ammo;

  // 가이드 버튼 클릭
  const guideBtn = page.getByRole('button', { name: '가이드' });
  if (await guideBtn.count()) {
    await guideBtn.click();
    await sleep(500);
    const snapAfterBtn = await getSnapshot();
    const p1AmmoAfterBtn = snapAfterBtn?.players[0]?.ammo;
    log('HUD button click ammo check:', { before: p1AmmoBeforeBtn, after: p1AmmoAfterBtn });
    await shot('B-16-hud-button-click-no-leak');
    // 모달 닫기
    const closeBtn = page.getByRole('button', { name: '닫기' });
    if (await closeBtn.count()) await closeBtn.click();
    await sleep(400);
  }

  // [B-17]: Esc 일시정지 메뉴 & 다시 시작 / 재개
  log('Testing B-17 Esc pause...');
  await page.keyboard.press('Escape');
  await sleep(800);
  await shot('B-17-esc-pause-restart');
  const snapPaused = await getSnapshot();
  log('Is paused:', snapPaused?.isPaused);
  // 재개
  const resumeBtn = page.getByRole('button', { name: '계속하기' });
  if (await resumeBtn.count()) {
    await resumeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await sleep(600);

  // 결과 화면 도달 대기 (몬스터가 방어선을 돌파하여 목숨이 0이 될 때까지)
  log('Waiting for game over to reach result screen...');
  let reachedResult = false;
  for (let i = 0; i < 90; i++) {
    const snap = await getSnapshot();
    if (snap?.phase === 'RESULT' || snap?.lives <= 0) {
      log(`Game ended (phase=${snap?.phase}, lives=${snap?.lives}) at iteration ${i}`);
      reachedResult = true;
      break;
    }
    const restartBtnCount = await page.locator('[data-shootable="restart"]').count();
    if (restartBtnCount > 0) {
      reachedResult = true;
      break;
    }
    await phone.aimHold(0, 0, 1000);
  }
  await sleep(2500);
  await shot('B-18-result-coop');

  const snapResult = await getSnapshot();
  log('Result snapshot:', snapResult?.phase);

  // [B-19]: 다시 시작 버튼 확인
  log('Testing B-19 restart button...');
  // 결과 화면에서 "다시 시작" 버튼 위치 확인
  const restartBtn = page.locator('[data-shootable="restart"]');
  const restartVisible = await restartBtn.isVisible().catch(() => false);
  log('Restart button visible?', restartVisible);
  await shot('B-19-restart-both-devices');

  // [B-20]: 로비로 가기
  log('Testing B-20 return to lobby...');
  const lobbyBtn = page.locator('[data-shootable="lobby"]');
  if (await lobbyBtn.isVisible().catch(() => false)) {
    await lobbyBtn.click();
    await sleep(2000);
  } else {
    // Esc 일시정지 등에서 로비로
    await page.keyboard.press('Escape');
    await sleep(500);
    const returnLobby = page.getByRole('button', { name: '로비로' });
    if (await returnLobby.count()) await returnLobby.click();
    await sleep(2000);
  }
  await shot('B-20-return-to-lobby');

  // [B-21]: 로비 팀 랭킹 탭 확인
  log('Checking B-21 lobby team rank highlight...');
  const teamRankTab = page.getByRole('button', { name: '팀 랭킹' });
  if (await teamRankTab.count()) {
    await teamRankTab.click();
    await sleep(800);
  }
  await shot('B-21-lobby-team-rank-highlight');

  // 데이터 파일 확인
  const dataDir = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone/data');
  const recordsPath = path.join(dataDir, 'play-records.jsonl');
  const playersPath = path.join(dataDir, 'players.json');
  let recordsContent = '';
  if (fs.existsSync(recordsPath)) {
    recordsContent = fs.readFileSync(recordsPath, 'utf8');
    log('Records file contents:\n', recordsContent);
  } else {
    log('Records file does not exist yet at:', recordsPath);
  }

  // 에러 리포트 저장
  fs.writeFileSync(
    path.join(OUT, 'combo1-errors.json'),
    JSON.stringify({ errors: collectedErrors, logs: collectedLogs.slice(-50) }, null, 2)
  );
  log('Finished Combo 1. Errors count:', collectedErrors.length);

  phone.ws.close();
  await browser.close();

  return {
    errors: collectedErrors,
    p1AmmoDelta: p1AmmoBefore - p1AmmoAfter,
    p2AmmoDelta: p2AmmoBefore - p2AmmoAfter,
    recordsContent,
  };
}

runCombo1()
  .then((res) => {
    log('Combo 1 completed successfully:', res);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Combo 1 FATAL ERROR:', e);
    process.exit(1);
  });
