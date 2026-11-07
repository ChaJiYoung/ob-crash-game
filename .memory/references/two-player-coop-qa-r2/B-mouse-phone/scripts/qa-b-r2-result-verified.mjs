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
function recordError(type, msg) {
  log(`[ERROR ${type}]`, msg);
  collectedErrors.push({ type, msg, time: new Date().toISOString() });
}

function fakePhone(roomId, slot, nickname, customDeviceId) {
  const ws = new WebSocket(WS);
  const deviceId = customDeviceId || `result_phone_s${slot}_${Date.now()}`;
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

async function runResultVerified() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => recordError('pageerror', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') recordError('console.error', msg.text());
  });

  const shot = async (name) => {
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    log('Saved screenshot:', name);
  };

  const getSnapshot = async () => {
    return await page.evaluate(() => (window.__BEER_DEBUG__?.snapshot ? window.__BEER_DEBUG__.snapshot() : null));
  };

  log('--- Starting Result & Lobby Verification (B-18 ~ B-22) ---');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  let roomId = null;
  for (let i = 0; i < 30; i++) {
    roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
    if (roomId) break;
    await sleep(300);
  }
  log('Room ID:', roomId);

  // 1P 마우스 설정
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  const slot2 = page.locator('[data-testid="slot-card-2"]');
  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await slot1.locator('input[placeholder="닉네임 입력"]').fill('승리마우스');
  await slot1.locator('button[type="submit"]').click();
  await sleep(400);

  // 2P 모바일 선택
  await slot2.getByRole('button', { name: '📱 모바일' }).click();
  await sleep(400);

  // 2P 폰 연결 및 영점
  const phone = fakePhone(roomId, 2, '승리모바일');
  await phone.join();
  await sleep(500);
  await phone.zero();
  await phone.aimHold(0, 0, 500);
  await sleep(500);

  // 시작 버튼 클릭
  const startBtn = page.locator('[data-shootable="start"]');
  await startBtn.click();
  await phone.aimHold(0, 0, 4200);
  await sleep(1500);

  // 무기 선택: 2P 폰 (우측 가운데 카드: aimX=0.47, aimY=-0.05)
  log('2P phone selecting weapon card...');
  await phone.aimHold(0.47, -0.05, 500);
  await phone.snap(0.47, -0.05);
  await sleep(500);

  // 무기 선택: 1P 마우스 (좌측 가운데 카드: x=1440*0.265=381.6, y=900*0.5=450)
  log('1P mouse selecting weapon card...');
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getSnapshot();
    if (snap?.selection?.done?.[0]) {
      log('1P card selected successfully!');
      break;
    }
    const targetX = 1440 * (0.265 + (attempt - 2) * 0.03);
    const targetY = 900 * 0.5;
    log(`1P click attempt ${attempt} at (${targetX}, ${targetY})`);
    await page.mouse.move(targetX, targetY, { steps: 4 });
    await sleep(100);
    await page.mouse.down();
    await sleep(120);
    await page.mouse.up();
    await sleep(400);
  }

  // 둘 다 선택 완료되어 전투 진입 대기
  await phone.aimHold(0, 0, 3000);

  const combatSnap = await getSnapshot();
  log('Combat snapshot phase:', combatSnap?.phase, 'selection:', combatSnap?.selection);

  log('Waiting for monsters to breach defense lines and reach GAMEOVER...');
  let reachedGameOver = false;
  for (let sec = 0; sec < 120; sec++) {
    const snap = await getSnapshot();
    if (snap?.phase === 'GAMEOVER' || (snap?.lives !== undefined && snap.lives <= 0)) {
      log(`Game Over reached at loop ${sec}: phase=${snap?.phase}, lives=${snap?.lives}`);
      reachedGameOver = true;
      break;
    }
    const restartVisible = await page.locator('[data-shootable="restart"]').isVisible().catch(() => false);
    if (restartVisible) {
      log(`Restart button became visible at loop ${sec}!`);
      reachedGameOver = true;
      break;
    }
    await phone.aimHold(0, 0, 1000);
  }

  // 결과 화면 렌더링 대기
  await sleep(2500);

  // [B-18]: 결과 화면 캡처 및 정량 검증
  log('B-18: Verifying Result Screen...');
  await shot('B-18-result-coop');

  const resultDetails = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="result-ranking-modal"]') || document.body;
    const text = modal.innerText;
    return {
      textSnippet: text.slice(0, 400),
      hasSoloWarning: text.includes('2인팟 점수는 솔로 랭킹에 오르지 않습니다'),
      hasTeamTitle: text.includes('팀') || text.includes('2인팟'),
      hasP1: text.includes('승리마우스') || text.includes('1P'),
      hasP2: text.includes('승리모바일') || text.includes('2P'),
    };
  });
  log('Result screen verification:', resultDetails);

  // [B-19]: 다시 시작 버튼 (결과 화면에서 폰 사격 & 마우스 클릭 둘 다 가능)
  log('B-19: Verifying restart button...');
  await shot('B-19-restart-both-devices');

  // [B-20]: 로비로 복귀 버튼 클릭
  log('B-20: Returning to lobby...');
  const lobbyBtn = page.locator('[data-shootable="lobby"]');
  if (await lobbyBtn.isVisible().catch(() => false)) {
    await lobbyBtn.click();
    await sleep(2500);
  } else {
    const fallbackLobby = page.getByText('로비로').first();
    if (await fallbackLobby.count()) await fallbackLobby.click();
    await sleep(2500);
  }
  await shot('B-20-return-to-lobby');

  // 로비 상태 확인 (D11: 마우스 슬롯은 비워지고, 폰 슬롯은 남아있음)
  const slotAfterReturn = await page.evaluate(() => {
    const s1 = document.querySelector('[data-testid="slot-card-1"]')?.textContent || '';
    const s2 = document.querySelector('[data-testid="slot-card-2"]')?.textContent || '';
    return {
      slot1Cleared: s1.includes('입력 방식을 선택하세요') || s1.includes('비어 있음'),
      slot2PhoneRetained: s2.includes('접속 완료') || s2.includes('승리모바일'),
      s1Text: s1.slice(0, 100),
      s2Text: s2.slice(0, 100),
    };
  });
  log('Lobby slot status after return (D11):', slotAfterReturn);

  // [B-21]: 로비 팀 랭킹 탭 확인
  log('B-21: Checking Team Ranking highlight in lobby...');
  const teamTab = page.getByRole('button', { name: '팀 랭킹' });
  if (await teamTab.count()) {
    await teamTab.click();
    await sleep(1000);
  }
  await shot('B-21-lobby-team-rank-highlight');

  // [B-22]: 임시 데이터 폴더 데이터 검증
  const dataDir = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone/data');
  const recordsPath = path.join(dataDir, 'play-records.jsonl');
  const playersPath = path.join(dataDir, 'players.json');

  let coopRecords = [];
  if (fs.existsSync(recordsPath)) {
    const lines = fs.readFileSync(recordsPath, 'utf8').trim().split('\n').filter(Boolean);
    coopRecords = lines.map((l) => JSON.parse(l)).filter((r) => r.mode === 'coop');
    log(`Found ${coopRecords.length} coop record lines in play-records.jsonl:`, coopRecords);
  }

  let playersStore = null;
  if (fs.existsSync(playersPath)) {
    playersStore = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    log('Players count in store:', Object.keys(playersStore.players || {}).length);
  }

  const finalReport = {
    errors: collectedErrors,
    resultDetails,
    slotAfterReturn,
    coopRecordsCount: coopRecords.length,
    coopRecords,
    playersStoreSummary: playersStore ? Object.keys(playersStore.players || {}) : [],
  };

  fs.writeFileSync(path.join(OUT, 'result-verified-report.json'), JSON.stringify(finalReport, null, 2));
  log('Saved result-verified-report.json successfully!');

  phone.ws.close();
  await browser.close();

  return finalReport;
}

runResultVerified()
  .then((res) => {
    log('Result Verified completed successfully:', res);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Result Verified FATAL ERROR:', e);
    process.exit(1);
  });
