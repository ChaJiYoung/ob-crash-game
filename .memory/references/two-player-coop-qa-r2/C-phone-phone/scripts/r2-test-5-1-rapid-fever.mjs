import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/C-phone-phone';
const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    pageErrors.push(e.message);
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

function createFakePhone(roomId, slot, nickname, deviceIdPrefix = 'phone') {
  let ws = new WebSocket(WS);
  const deviceId = `fake_${deviceIdPrefix}_${slot}`;
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
        skillSnapTriggered: false,
        isCocked: false,
        timestamp: Date.now(),
        ...extra,
      },
    });

  return {
    get ws() {
      return ws;
    },
    deviceId,
    frame,
    async join() {
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async zero(resume = false) {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot, ...(resume ? { resume: true } : {}) });
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
      await sleep(50);
      frame(aimX, aimY);
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
}

async function run() {
  log('Starting 5-1 and 5-2 precision test (Rapid fire, Fever auto fire, Gun Aim 정량)...');
  const page = await newPage();
  const getSnapshot = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());

  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 로비 1P, 2P 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = createFakePhone(roomId, 1, '블루폰', 'rf_p1');
  const p2 = createFakePhone(roomId, 2, '오렌지폰', 'rf_p2');

  await p1.join();
  await p2.join();
  await sleep(500);
  await p1.zero();
  await p2.zero();
  await sleep(500);

  // 로비 시작 사격
  await p1.aimHold(0, 0, 300);
  await p1.snap(0, 0);
  // 카운트다운 3.5초 대기
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // 무기 선택: 1P는 개틀링(왼쪽 카드 aimX -0.47, aimY 0), 2P는 샷건(오른쪽 카드 aimX 0.47, aimY 0)
  log('Selecting weapons: 1P Gatling, 2P Shotgun...');
  await p1.aimHold(-0.47, 0, 300);
  await p1.snap(-0.47, 0);
  await sleep(300);
  await p2.aimHold(0.47, 0, 300);
  await p2.snap(0.47, 0);
  await sleep(1500);

  // 전투 진입
  log('Combat active. Verifying snapshot phase and paused state...');
  let snap = await getSnapshot();
  log('Initial combat state:', { phase: snap?.phase, isPaused: snap?.isPaused, players: snap?.players });

  // 5-2. 총구 조준(정량) 3가지 조합 캡처 및 정량 측정
  log('--- 5-2 Gun Aim Combinations 정량 캡처 ---');

  // 1) (1P 왼쪽 위 −0.7, 0.4 / 2P 오른쪽 아래 0.7, −0.3)
  log('Aim combination 1: 1P (-0.7, 0.4) / 2P (0.7, -0.3)');
  await Promise.all([p1.aimHold(-0.7, 0.4, 1500), p2.aimHold(0.7, -0.3, 1500)]);
  await shot(page, 'C-5-2-aim-opposite');

  // 2) (1P 오른쪽 0.6, 0.0 / 2P 왼쪽 −0.6, 0.0 — 서로 교차)
  log('Aim combination 2: 1P (0.6, 0.0) / 2P (-0.6, 0.0) [CROSS]');
  await Promise.all([p1.aimHold(0.6, 0.0, 1500), p2.aimHold(-0.6, 0.0, 1500)]);
  await shot(page, 'C-5-2-aim-cross');

  // 3) (둘 다 가운데 0, 0)
  log('Aim combination 3: 1P (0, 0) / 2P (0, 0) [CENTER]');
  await Promise.all([p1.aimHold(0, 0, 1500), p2.aimHold(0, 0, 1500)]);
  await shot(page, 'C-5-2-aim-center');

  // 5-1. 판정은 콘솔이 아니라 결과로: 누른 채 연사
  log('--- 5-1 누른 채 연사 검증 ---');
  // 1P: 개틀링 (최대 30발, 발사간격 128ms)
  // rapidFireHold를 1초 동안 유지하면서 탄약 변화를 측정
  const p1BeforeSnap = await getSnapshot();
  const p1AmmoBefore = p1BeforeSnap.players[0].ammo;
  log(`P1 Gatling Ammo before rapidFireHold: ${p1AmmoBefore}`);

  // 1초 동안 rapidFireHold 전송
  const startP1 = Date.now();
  while (Date.now() - startP1 < 1000) {
    p1.frame(0, 0, { rapidFireHold: true });
    p2.frame(0.5, 0); // 2P는 대기
    await sleep(25);
  }
  // hold 해제 신호 (rapidFireHold: false)
  p1.frame(0, 0, { rapidFireHold: false });
  await sleep(150);

  const p1AfterSnap = await getSnapshot();
  const p1AmmoAfter = p1AfterSnap.players[0].ammo;
  const p1Spent = p1AmmoBefore - p1AmmoAfter;
  log(`P1 Gatling rapid fire result: before=${p1AmmoBefore}, after=${p1AmmoAfter}, spent=${p1Spent}발`);

  // 2P: 샷건 (최대 10발, 발사간격 약 220ms)
  const p2BeforeSnap = await getSnapshot();
  const p2AmmoBefore = p2BeforeSnap.players[1].ammo;
  log(`P2 Shotgun Ammo before rapidFireHold: ${p2AmmoBefore}`);

  const startP2 = Date.now();
  while (Date.now() - startP2 < 1000) {
    p2.frame(0, 0, { rapidFireHold: true });
    p1.frame(-0.5, 0);
    await sleep(25);
  }
  p2.frame(0, 0, { rapidFireHold: false });
  await sleep(150);

  const p2AfterSnap = await getSnapshot();
  const p2AmmoAfter = p2AfterSnap.players[1].ammo;
  const p2Spent = p2AmmoBefore - p2AmmoAfter;
  log(`P2 Shotgun rapid fire result: before=${p2AmmoBefore}, after=${p2AmmoAfter}, spent=${p2Spent}발`);

  await shot(page, 'C-5-1-rapid-fire-verified');

  // 5-1. 피버 자동 연사: 피버 발동 후 2초 동안 해당 플레이어 점수·처치가 늘고 사격 효과가 나오는지 snapshot 확인
  log('--- 5-1 피버 자동 연사 검증 ---');
  // 피버 게이지를 채우기 위해 타겟들을 사격
  log('Aiming and shooting targets to build fever gauge...');
  for (let i = 0; i < 40; i++) {
    const s = await getSnapshot();
    if (s.players[0].isFeverReady || s.players[1].isFeverReady) {
      log('A player reached FEVER READY!');
      break;
    }
    // 타겟이 있으면 타겟 위치로 사격
    if (s.targets && s.targets.length > 0) {
      const t = s.targets[0];
      await p1.snap(t.aimX, t.aimY);
      await sleep(100);
      if (s.targets[1]) {
        await p2.snap(s.targets[1].aimX, s.targets[1].aimY);
      } else {
        await p2.snap(t.aimX, t.aimY);
      }
    } else {
      await p1.snap(0, 0);
      await p2.snap(0, 0);
    }
    await sleep(150);
  }

  snap = await getSnapshot();
  log('Fever status after shooting:', {
    P1_feverReady: snap.players[0].isFeverReady,
    P1_score: snap.players[0].score,
    P2_feverReady: snap.players[1].isFeverReady,
    P2_score: snap.players[1].score,
  });

  // 피버 트리거 (만약 피버 레디가 안 됐더라도 feverTriggered 신호 전송 확인 및 snapshot 확인)
  if (snap.players[0].isFeverReady) {
    log('Triggering fever on 1P...');
    p1.frame(0, 0, { feverTriggered: true });
    await sleep(200);

    const feverSnapStart = await getSnapshot();
    log('P1 Fever started:', { isFeverActive: feverSnapStart.players[0].isFeverActive, score: feverSnapStart.players[0].score });

    // 2초 동안 점수 / 처치 / 탄약(무한) 확인
    await Promise.all([p1.aimHold(0, 0, 2000), p2.aimHold(0.5, 0, 2000)]);
    const feverSnap2s = await getSnapshot();
    log('P1 Fever after 2s:', {
      isFeverActive: feverSnap2s.players[0].isFeverActive,
      score: feverSnap2s.players[0].score,
      scoreDelta: feverSnap2s.players[0].score - feverSnapStart.players[0].score,
    });
    await shot(page, 'C-5-1-fever-active');
  }

  // 결과 저장
  const precisionResults = {
    p1Gatling: { before: p1AmmoBefore, after: p1AmmoAfter, spent: p1Spent, pass: p1Spent > 1 },
    p2Shotgun: { before: p2AmmoBefore, after: p2AmmoAfter, spent: p2Spent, pass: p2Spent > 1 },
    pageErrorsCount: pageErrors.length,
    errorsCount: errors.length,
    errors,
  };
  fs.writeFileSync(path.join(OUT, 'precision-results.json'), JSON.stringify(precisionResults, null, 2));

  p1.close();
  p2.close();
  await page.context().close();
  await browser.close();

  log('5-1 & 5-2 Precision test completed! Total errors:', errors.length);
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
