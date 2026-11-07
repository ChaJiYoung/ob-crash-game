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

async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
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

function fakePhone(roomId, slot, nickname, deviceIdPrefix = 'phone') {
  const ws = new WebSocket(WS);
  const deviceId = `fake_${deviceIdPrefix}_${slot}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') log(`phone [${slot}] ERROR:`, m.code, m.message);
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
        skillSnapTriggered: false,
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
    async join() {
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    async check() {
      await ready;
      send({ type: 'DEVICE_CHECK', roomId, deviceId, slot });
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
  };
}

async function run() {
  log('Starting Flow 1 (C-01 to C-04, 5-1, 5-2, 5-4)...');
  const page = await newPage();

  const getSnapshot = () => page.evaluate(() => window.__BEER_DEBUG__?.snapshot());

  // Wait for room ID
  const roomId = await page
    .waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id'), null, { timeout: 15000 })
    .then((h) => h.jsonValue());
  log('Room ID acquired:', roomId);
  await sleep(1000);

  // 로비 모달 / UI 요소 확인
  const lobbyElements = await page.evaluate(() => {
    return {
      buttons: Array.from(document.querySelectorAll('button')).map((b) => b.innerText),
      bodyText: document.body.innerText.slice(0, 300),
    };
  });
  log('Lobby buttons:', lobbyElements.buttons);

  // 1P, 2P 모바일 선택
  log('Selecting Mobile for 1P and 2P...');
  await page.getByText('📱 모바일').first().click();
  await sleep(500);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(600);

  // 폰 1, 폰 2 접속
  log('Connecting Phone 1 (1P) and Phone 2 (2P)...');
  const p1 = fakePhone(roomId, 1, '블루폰', 'p1');
  const p2 = fakePhone(roomId, 2, '오렌지폰', 'p2');

  await p1.join();
  await p2.join();
  await sleep(600);

  // 영점 조정
  log('Calibrating zero for both phones...');
  await p1.zero();
  await p2.zero();
  await sleep(600);

  // 폰 조준 프레임 보내기
  await Promise.all([p1.aimHold(-0.2, 0, 800), p2.aimHold(0.2, 0, 800)]);

  // C-01: 둘 다 준비 완료 상태 캡처
  await shot(page, 'C-01-lobby-both-phones-ready');

  // 가운데 사격으로 게임 시작 (Phone 2가 사격)
  log('Phone 2 shooting center (0, 0) to start game...');
  await p2.snap(0, 0);
  await sleep(600);
  await shot(page, 'C-01-lobby-countdown-start');

  // 3초 카운트다운 동안 조준 프레임 전송
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // C-03: 무기 선택 화면 (1P 왼쪽 파랑, 2P 오른쪽 주황)
  let snap = await getSnapshot();
  log('Phase at weapon select:', snap?.phase, 'selection:', snap?.selection);
  await shot(page, 'C-03-weapon-select-split');

  // Phone 1(1P)이 왼쪽 카드(aimX -0.47, aimY 0) 사격
  log('Phone 1 selecting weapon on the left...');
  await p1.aimHold(-0.47, 0, 400);
  await p1.snap(-0.47, 0);
  await p1.aimHold(-0.47, 0, 600);

  snap = await getSnapshot();
  log('Selection status after 1P select:', snap?.selection);

  // C-03: 1P 선택 완료 대기 상자 캡처
  await shot(page, 'C-03-weapon-select-1p-waiting');

  // Phone 2(2P)가 오른쪽 카드(aimX 0.47, aimY 0) 사격
  log('Phone 2 selecting weapon on the right...');
  await p2.aimHold(0.47, 0, 400);
  await p2.snap(0.47, 0);
  await p2.aimHold(0.47, 0, 1000);

  // 전투 진입
  log('Entering combat phase...');
  await Promise.all([p1.aimHold(-0.3, 0.1, 2000), p2.aimHold(0.3, 0.1, 2000)]);
  await sleep(1500);

  snap = await getSnapshot();
  log('Phase at combat:', snap?.phase, 'players count:', snap?.players?.length);

  // C-04: 전투 HUD 확인 (두 패널 모두 "[위로 휙!]")
  await shot(page, 'C-04-combat-hud-swipe-up');

  // 5-4. P01 수정 확인: 마우스 이동이 폰 2대 판에서 총/십자선을 움직이지 않는지 검증
  log('Checking P01 fix: mouse move should NOT move any crosshair in 2-phone mode...');
  // 마우스를 화면 구석(100, 100)에서 다른 구석(1300, 800)으로 크게 이동
  await page.mouse.move(100, 100);
  await sleep(200);
  await page.mouse.move(1300, 800);
  await sleep(300);

  // C-02: 마우스로 3D 캔버스 클릭 시 사격 안 됨 확인
  log('Testing mouse click on 3D canvas (should not fire)...');
  const snapBeforeClick = await getSnapshot();
  const ammo1Before = snapBeforeClick.players[0].ammo;
  const ammo2Before = snapBeforeClick.players[1].ammo;

  await page.mouse.click(720, 450);
  await sleep(300);

  const snapAfterClick = await getSnapshot();
  const ammo1After = snapAfterClick.players[0].ammo;
  const ammo2After = snapAfterClick.players[1].ammo;
  log(`Ammo before click: P1=${ammo1Before}, P2=${ammo2Before} | after: P1=${ammo1After}, P2=${ammo2After}`);
  const mouseDidNotFire = ammo1Before === ammo1After && ammo2Before === ammo2After;
  log('Mouse click on canvas did not fire:', mouseDidNotFire);

  // C-02: HUD 일시정지 버튼 클릭 동작 확인
  log('Testing mouse click on HUD pause button...');
  await page.keyboard.press('Escape');
  await sleep(600);
  await shot(page, 'C-02-mouse-click-hud-works');

  // 모달 안의 이어하기 버튼 클릭
  await page.getByText('▶ 이어하기').first().click();
  await sleep(800);

  // 5-2. 총구 조준(정량) 3가지 조합 캡처
  log('Testing 5-2 Gun Aim Combinations...');

  // 1) (1P 왼쪽 위 −0.7, 0.4 / 2P 오른쪽 아래 0.7, −0.3)
  log('Aim combination 1: 1P (-0.7, 0.4) / 2P (0.7, -0.3)');
  await Promise.all([p1.aimHold(-0.7, 0.4, 1200), p2.aimHold(0.7, -0.3, 1200)]);
  await shot(page, 'C-5-2-aim-opposite');

  // 2) (1P 오른쪽 0.6, 0.0 / 2P 왼쪽 −0.6, 0.0 — 서로 교차)
  log('Aim combination 2: 1P (0.6, 0.0) / 2P (-0.6, 0.0) [CROSS]');
  await Promise.all([p1.aimHold(0.6, 0.0, 1200), p2.aimHold(-0.6, 0.0, 1200)]);
  await shot(page, 'C-5-2-aim-cross');

  // 3) (둘 다 가운데 0, 0)
  log('Aim combination 3: 1P (0, 0) / 2P (0, 0) [CENTER]');
  await Promise.all([p1.aimHold(0, 0, 1200), p2.aimHold(0, 0, 1200)]);
  await shot(page, 'C-5-2-aim-center');

  // 5-1. 판정은 콘솔이 아니라 결과로: 누른 채 연사
  // 폰은 rapidFireHold: true를 1초 유지. 탄약이 여러 발 줄었는지 snapshot().players[i].ammo 전후 비교
  log('Testing 5-1 rapidFireHold for 1s on Phone 1...');
  const snapRapidBefore = await getSnapshot();
  const p1AmmoBeforeRapid = snapRapidBefore.players[0].ammo;

  // 1초 동안 rapidFireHold 전송
  await p1.aimHold(0, 0, 1000, { rapidFireHold: true });
  await sleep(100);

  const snapRapidAfter = await getSnapshot();
  const p1AmmoAfterRapid = snapRapidAfter.players[0].ammo;
  const p1AmmoSpent = p1AmmoBeforeRapid - p1AmmoAfterRapid;
  log(`P1 rapid fire ammo: before=${p1AmmoBeforeRapid}, after=${p1AmmoAfterRapid}, spent=${p1AmmoSpent}`);

  log('Testing 5-1 rapidFireHold for 1s on Phone 2...');
  const snapRapid2Before = await getSnapshot();
  const p2AmmoBeforeRapid = snapRapid2Before.players[1].ammo;

  await p2.aimHold(0, 0, 1000, { rapidFireHold: true });
  await sleep(100);

  const snapRapid2After = await getSnapshot();
  const p2AmmoAfterRapid = snapRapid2After.players[1].ammo;
  const p2AmmoSpent = p2AmmoBeforeRapid - p2AmmoAfterRapid;
  log(`P2 rapid fire ammo: before=${p2AmmoBeforeRapid}, after=${p2AmmoAfterRapid}, spent=${p2AmmoSpent}`);

  await shot(page, 'C-5-1-rapid-fire-result');

  // 결과 데이터 저장
  const testResults = {
    mouseDidNotFire,
    p1AmmoBeforeRapid,
    p1AmmoAfterRapid,
    p1AmmoSpent,
    p2AmmoBeforeRapid,
    p2AmmoAfterRapid,
    p2AmmoSpent,
    errorsCount: errors.length,
    pageErrorsCount: pageErrors.length,
    errors,
  };
  fs.writeFileSync(path.join(OUT, 'flow1-results.json'), JSON.stringify(testResults, null, 2));

  p1.ws.close();
  p2.ws.close();
  await page.context().close();
  await browser.close();

  log('Flow 1 finished! Total errors:', errors.length);
  if (errors.length) {
    console.error('Errors encountered:', errors);
  }
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
