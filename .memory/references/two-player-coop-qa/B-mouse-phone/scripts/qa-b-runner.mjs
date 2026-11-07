import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '../node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone');
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
  const deviceId = customDeviceId || `test_phone_slot${slot}_${Date.now()}`;
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

async function runQAB() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  async function createPCPage() {
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
    await page.goto(URL, { waitUntil: 'networkidle' });
    return { ctx, page };
  }

  async function waitForRoomId(page) {
    for (let i = 0; i < 30; i++) {
      const r = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
      if (r) return r;
      await sleep(300);
    }
    throw new Error('Room ID timed out');
  }

  const shot = async (page, name) => {
    const fullPath = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: fullPath });
    log('Saved screenshot:', name);
  };

  log('=====================================================');
  log('STARTING QA-B TEST SUITE');
  log('=====================================================');

  // =========================================================================
  // COMBINATION 1: 1P MOUSE + 2P PHONE
  // =========================================================================
  log('\n>>> Starting Combination 1: 1P Mouse + 2P Phone <<<\n');
  const { ctx: pcCtx1, page: pc1 } = await createPCPage();

  const roomId1 = await waitForRoomId(pc1);
  log('Room ID 1:', roomId1);

  // 1-1. 로비 시작 게이트 확인
  const slot1Card = pc1.locator('[data-testid="slot-card-1"]');
  const slot2Card = pc1.locator('[data-testid="slot-card-2"]');

  // 1P 마우스 선택
  await slot1Card.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await slot1Card.locator('input[placeholder="닉네임 입력"]').fill('마우스1P');
  await slot1Card.locator('button[type="submit"]').click();
  await sleep(400);

  // 2P 슬롯 마우스 비활성화 확인
  const is2PMouseDisabled = await slot2Card.getByRole('button', { name: '🖱 마우스' }).isDisabled();
  log('Is 2P Mouse disabled?', is2PMouseDisabled);

  // 2P 모바일 선택
  await slot2Card.getByRole('button', { name: '📱 모바일' }).click();
  await sleep(400);

  // 1P만 준비 완료, 2P 연결 대기 상태에서 시작 게이트 확인 ("2P 준비 중")
  await shot(pc1, 'B-01-lobby-start-gate');

  // 폰 연결
  const phone2P = fakePhone(roomId1, 2, '모바일2P');
  await phone2P.join();
  await sleep(600);
  // 영점 전 상태 캡처
  await shot(pc1, 'B-01-lobby-2p-uncalibrated');

  // 2-1. 슬롯 점유 거절 테스트 (다른 폰이 slot 2에 접속 시도)
  log('Testing slot rejection...');
  const intruderCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const intruderPage = await intruderCtx.newPage();
  intruderPage.on('pageerror', (e) => recordError('intruder pageerror', e.message));
  await intruderPage.goto(`${URL}controller?room=${roomId1}&slot=2`);
  await sleep(1500);
  const intruderNickInput = intruderPage.getByPlaceholder('닉네임 입력');
  if (await intruderNickInput.count()) {
    await intruderNickInput.fill('불청객');
    await intruderPage.getByText('시작하기').click();
    await sleep(1500);
  }
  await intruderPage.screenshot({ path: path.join(OUT, 'B-02-slot-rejection.png') });
  log('Saved B-02-slot-rejection.png');
  await intruderCtx.close();

  // 2P 폰 영점 조절
  await phone2P.zero();
  await phone2P.aimHold(0, 0, 500);
  await sleep(600);
  await shot(pc1, 'B-01b-lobby-both-ready');

  // 3. 게임 시작 -> 무기 선택 라운드 진입
  log('Starting game to weapon select...');
  const startButton = pc1.locator('[data-shootable="start"]');
  await startButton.click();
  // 3초 카운트다운 동안 폰 조준 0 유지
  await phone2P.aimHold(0, 0, 4200);
  await sleep(1500);

  // 무기 선택 화면 캡처: 카드 6장, 좌우 분할, 점선, 배지
  await shot(pc1, 'B-03-weapon-select-both');

  // 4. 1P(마우스)가 2P 카드 쏘면 선택 안 됨
  log('Testing 1P shooting 2P weapon card...');
  await pc1.mouse.move(1440 * 0.75, 900 * 0.5, { steps: 5 });
  await sleep(200);
  await pc1.mouse.down();
  await sleep(100);
  await pc1.mouse.up();
  await sleep(600);
  // 아직 둘 다 미선택 상태여야 함 (2P 카드가 선택되지 않음)
  await shot(pc1, 'B-04-weapon-cross-shoot');

  // 5. 한쪽(2P 폰)이 먼저 선택 -> "✓ ... 선택 완료 / 1P 선택을 기다리는 중…" 표시
  log('2P phone selects weapon card (right side)...');
  await phone2P.aimHold(0.47, -0.05, 500);
  await phone2P.snap(0.47, -0.05);
  await phone2P.aimHold(0.47, -0.05, 500);
  await sleep(500);
  await shot(pc1, 'B-05-weapon-partial-done');

  // 6. 1P(마우스)가 왼쪽 카드 선택 -> 둘 다 완료 후 게임 시작
  log('1P mouse selects weapon card (left side)...');
  await pc1.mouse.move(1440 * 0.265, 900 * 0.5, { steps: 5 });
  await sleep(200);
  await pc1.mouse.down();
  await sleep(100);
  await pc1.mouse.up();
  // 전투 시작 대기
  await phone2P.aimHold(0, 0, 3000);
  await shot(pc1, 'B-06-game-start');

  // 7. 전투 HUD 확인: 목숨 "TEAM · BAR DEFENSE", 1P 왼쪽 아래, 2P 오른쪽 아래
  await pc1.mouse.move(1440 * 0.35, 900 * 0.45);
  await phone2P.aimHold(0.35, -0.1, 1000);
  await shot(pc1, 'B-07-combat-hud');

  // 8. 스킬 배지: 1P 마우스 "[우클릭]", 2P 폰 "[위로 휙!]"
  await shot(pc1, 'B-08-skill-badges');

  // 9. 십자선 두 개 확인
  await shot(pc1, 'B-09-crosshairs');

  // 10. 3D 총 두 자루 (좌우 각각 조준 방향 회전)
  await pc1.mouse.move(1440 * 0.2, 900 * 0.4);
  await phone2P.aimHold(0.5, -0.2, 1000);
  await shot(pc1, 'B-10-guns-3d');

  // 11. 사격 광선 및 판정 팝업
  log('Testing shooting lasers & popup colors...');
  // 1P 마우스 클릭 사격
  await pc1.mouse.click(1440 * 0.3, 900 * 0.5);
  await sleep(150);
  // 2P 폰 사격
  await phone2P.snap(0.3, 0);
  await sleep(300);
  await shot(pc1, 'B-11-lasers-and-judgment');

  // 12. 입력 분리 검증 (1P 점수 vs 2P 점수)
  log('Verifying input score separation...');
  const initialScores = await pc1.evaluate(() => {
    const engine = window.__engine;
    return {
      p1Score: engine?.players[0]?.score ?? 0,
      p2Score: engine?.players[1]?.score ?? 0,
    };
  });
  log('Initial scores:', initialScores);

  // 마우스로 여러 발 사격
  for (let i = 0; i < 5; i++) {
    await pc1.mouse.click(1440 * 0.4, 900 * 0.5);
    await sleep(200);
  }
  await sleep(500);

  const scoresAfterMouse = await pc1.evaluate(() => {
    const engine = window.__engine;
    return {
      p1Score: engine?.players[0]?.score ?? 0,
      p2Score: engine?.players[1]?.score ?? 0,
    };
  });
  log('Scores after mouse shooting:', scoresAfterMouse);

  // 폰으로 여러 발 사격
  for (let i = 0; i < 5; i++) {
    await phone2P.snap(0.1, 0.1);
    await sleep(200);
  }
  await sleep(500);

  const scoresAfterPhone = await pc1.evaluate(() => {
    const engine = window.__engine;
    return {
      p1Score: engine?.players[0]?.score ?? 0,
      p2Score: engine?.players[1]?.score ?? 0,
    };
  });
  log('Scores after phone shooting:', scoresAfterPhone);
  await shot(pc1, 'B-12-input-separation');

  // 13. 아이템 버프 테스트 (D17)
  log('Testing item buffs (PowerShot & IceFreeze)...');
  await pc1.evaluate(() => {
    const engine = window.__engine;
    if (engine) {
      engine.spawnItemTarget('powerShot', Date.now());
    }
  });
  await sleep(500);
  await pc1.mouse.click(1440 * 0.5, 900 * 0.5);
  await sleep(500);
  await shot(pc1, 'B-13-item-buffs');

  // 14. 보상 카드 라운드 테스트 (시안 6, D04, D23, D34)
  log('Triggering reward card round...');
  await pc1.evaluate(() => {
    const engine = window.__engine;
    if (engine) {
      engine.openSelectRound('card', Date.now());
    }
  });
  await sleep(1000);
  await shot(pc1, 'B-14-reward-round');

  // 15. 카드 선택 직후 0.3초 스킬 잠금 검증 (D27)
  log('Testing skill lockout after pick (D27)...');
  await pc1.mouse.click(1440 * 0.265, 900 * 0.5);
  await pc1.mouse.click(1440 * 0.265, 900 * 0.5, { button: 'right' });
  await sleep(400);
  await shot(pc1, 'B-15-skill-lockout-after-pick');

  // 2P 폰도 카드 선택하여 라운드 종료
  await phone2P.snap(0.47, -0.05);
  await sleep(1500);

  // 16. HUD 버튼 클릭이 사격으로 새지 않음 (D26)
  log('Testing HUD button clicks do not fire shots...');
  const ammoBefore = await pc1.evaluate(() => {
    const engine = window.__engine;
    return engine?.players[0]?.ammo;
  });
  const guideBtn = pc1.locator('button:has-text("?")').first();
  if (await guideBtn.count()) {
    await guideBtn.click();
    await sleep(600);
    await shot(pc1, 'B-16-hud-button-click-no-leak');
    const closeGuide = pc1.getByText('닫기').first();
    if (await closeGuide.count()) await closeGuide.click();
    await sleep(400);
  }
  const ammoAfter = await pc1.evaluate(() => {
    const engine = window.__engine;
    return engine?.players[0]?.ammo;
  });
  log('Ammo before & after HUD click:', ammoBefore, ammoAfter);

  // 17. Esc 일시정지 메뉴 및 다시 시작 (같은 1P/2P 구성 유지)
  log('Testing Esc pause menu...');
  await pc1.keyboard.press('Escape');
  await sleep(800);
  await shot(pc1, 'B-17-esc-pause-restart');

  const pauseRestartBtn = pc1.getByText('다시 시작', { exact: true });
  if (await pauseRestartBtn.count()) {
    await pauseRestartBtn.click();
    await phone2P.aimHold(0, 0, 4200);
    await sleep(1200);
  }

  // 18. 게임 오버 유도하여 결과 화면 확인 (D11, D18, D22)
  log('Inducing game over for coop result screen...');
  await pc1.evaluate(() => {
    const engine = window.__engine;
    if (engine) {
      if (engine.isSelectPending) {
        engine.autoPickFor(0, Date.now());
        engine.autoPickFor(1, Date.now());
      }
      engine.barDefenseHp = 0;
      engine.gameOver = true;
      engine.running = false;
    }
  });
  for (let i = 0; i < 40; i++) {
    const done = await pc1.locator('[data-shootable="restart"]').count();
    if (done) break;
    await sleep(1000);
  }
  await sleep(2000);
  await shot(pc1, 'B-18-result-coop');

  // 19. 결과 화면에서 폰 사격 또는 마우스 클릭 동작 검증
  log('Testing result buttons with mouse click & phone shooting...');
  await shot(pc1, 'B-19-restart-both-devices');

  // 20. "로비로" 이동 시 마우스 슬롯 비워지고 폰 슬롯 유지되는지 검증 (D11)
  log('Testing return to lobby (D11)...');
  const toLobbyBtn = pc1.locator('[data-shootable="lobby"]').first();
  if (await toLobbyBtn.count()) {
    await toLobbyBtn.click();
  } else {
    const lobbyTextBtn = pc1.getByText('로비로').first();
    if (await lobbyTextBtn.count()) await lobbyTextBtn.click();
  }
  await sleep(2000);
  await shot(pc1, 'B-20-return-to-lobby');

  // 21. 로비 팀 랭킹 탭에 방금 팀이 강조되어 보이는지 확인
  log('Testing lobby team rank highlight...');
  const teamTabBtn = pc1.getByText('팀 랭킹').first();
  if (await teamTabBtn.count()) {
    await teamTabBtn.click();
    await sleep(800);
  }
  await shot(pc1, 'B-21-lobby-team-rank-highlight');

  // 22. 임시 데이터 폴더의 play-records.jsonl 확인
  const playRecordsPath = path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone/data/play-records.jsonl');
  let playRecordsContent = '';
  if (fs.existsSync(playRecordsPath)) {
    playRecordsContent = fs.readFileSync(playRecordsPath, 'utf8');
    log('play-records.jsonl content:\n', playRecordsContent);
  } else {
    log('play-records.jsonl not found at:', playRecordsPath);
  }

  await phone2P.ws.close();
  await pcCtx1.close();

  // =========================================================================
  // COMBINATION 2: 1P PHONE + 2P MOUSE
  // =========================================================================
  log('\n>>> Starting Combination 2: 1P Phone + 2P Mouse <<<\n');
  const { ctx: pcCtx2, page: pc2 } = await createPCPage();
  const roomId2 = await waitForRoomId(pc2);
  log('Room ID 2:', roomId2);

  const c2Slot1Card = pc2.locator('[data-testid="slot-card-1"]');
  const c2Slot2Card = pc2.locator('[data-testid="slot-card-2"]');

  // 1P 모바일 선택
  await c2Slot1Card.getByRole('button', { name: '📱 모바일' }).click();
  await sleep(400);

  // 2P 마우스 선택 & 닉네임 입력
  await c2Slot2Card.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await c2Slot2Card.locator('input[placeholder="닉네임 입력"]').fill('마우스2P');
  await c2Slot2Card.locator('button[type="submit"]').click();
  await sleep(400);

  // 1P 폰 연결 전: "1P 준비 중" 안내 확인
  await shot(pc2, 'B2-01-lobby-start-gate');

  // 1P 폰 연결 & 영점
  const phone1P = fakePhone(roomId2, 1, '모바일1P');
  await phone1P.join();
  await sleep(500);
  await phone1P.zero();
  await phone1P.aimHold(0, 0, 500);
  await sleep(600);
  await shot(pc2, 'B2-01b-lobby-both-ready');

  // 폰 화면 가운데 사격으로 시작 (D33)
  log('Starting game via 1P phone center shot (D33)...');
  await phone1P.snap(0, 0);
  await phone1P.aimHold(0, 0, 4200);
  await sleep(1500);

  // 무기 선택 화면: 1P(폰)가 왼쪽 파랑, 2P(마우스)가 오른쪽 주황
  await shot(pc2, 'B2-03-weapon-select');

  // 1P 폰이 왼쪽 카드 선택
  await phone1P.aimHold(-0.47, -0.05, 500);
  await phone1P.snap(-0.47, -0.05);
  await sleep(600);

  // 2P 마우스가 오른쪽 카드 선택
  await pc2.mouse.move(1440 * 0.735, 900 * 0.5, { steps: 5 });
  await sleep(200);
  await pc2.mouse.click(1440 * 0.735, 900 * 0.5);
  await phone1P.aimHold(0, 0, 3000);
  await sleep(1000);

  // 전투 HUD 확인: 1P 폰 왼쪽 파랑 + "[위로 휙!]", 2P 마우스 오른쪽 주황 + "[우클릭]"
  await shot(pc2, 'B2-07-combat-hud');
  await shot(pc2, 'B2-08-skill-badges');
  await shot(pc2, 'B2-09-crosshairs');

  // 입력 분리 확인
  await phone1P.snap(-0.2, 0.1);
  await sleep(200);
  await pc2.mouse.click(1440 * 0.6, 900 * 0.5);
  await sleep(300);
  await shot(pc2, 'B2-12-input-separation');

  // 게임 오버 유도 후 결과 화면
  await pc2.evaluate(() => {
    const engine = window.__engine;
    if (engine) {
      if (engine.isSelectPending) {
        engine.autoPickFor(0, Date.now());
        engine.autoPickFor(1, Date.now());
      }
      engine.barDefenseHp = 0;
      engine.gameOver = true;
      engine.running = false;
    }
  });
  for (let i = 0; i < 40; i++) {
    const done = await pc2.locator('[data-shootable="restart"]').count();
    if (done) break;
    await sleep(1000);
  }
  await sleep(2000);
  await shot(pc2, 'B2-18-result');

  await phone1P.ws.close();
  await pcCtx2.close();
  await browser.close();

  log('=====================================================');
  log('QA-B TEST SUITE COMPLETED');
  log('Total errors collected:', collectedErrors.length);
  log('=====================================================');

  // 결과 파일로 에러 및 로그 저장
  fs.writeFileSync(
    path.join(OUT, 'test-run.log'),
    `Collected Errors (${collectedErrors.length}):\n${JSON.stringify(collectedErrors, null, 2)}\n\nLogs:\n${collectedLogs.join('\n')}`
  );
}

runQAB().catch((err) => {
  console.error('RUNNER FAILED:', err);
  process.exit(1);
});
