import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, '..');
const URL = 'https://127.0.0.1:5205/';
const WS = 'ws://localhost:8805';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function createFakePhone(roomId, slot, nickname) {
  const ws = new WebSocket(WS);
  const deviceId = `phone_qa_e_${slot}_${Date.now()}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') log(`[Phone ${slot}] ERROR:`, m.code, m.message);
    } catch {}
  });

  let currentAimX = 0;
  let currentAimY = 0;

  const frame = (aimX, aimY, extra = {}) => {
    currentAimX = aimX;
    currentAimY = aimY;
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
        skillSnapTriggered: false,
        timestamp: Date.now(),
        ...extra,
      },
    });
  };

  return {
    ws,
    deviceId,
    frame,
    getAim: () => ({ aimX: currentAimX, aimY: currentAimY }),
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
      frame(aimX, aimY);
      await sleep(30);
      frame(aimX, aimY, { snapFire: true });
      await sleep(30);
      frame(aimX, aimY);
    },
    async holdRapid(aimX, aimY, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        frame(aimX, aimY, { rapidFireHold: true });
        await sleep(30);
      }
      frame(aimX, aimY, { rapidFireHold: false });
      await sleep(30);
    },
    skill(aimX, aimY) {
      frame(aimX, aimY, { skillSnapTriggered: true });
    },
    fever(aimX, aimY) {
      frame(aimX, aimY, { feverTriggered: true });
    },
    close() {
      try {
        ws.close();
      } catch {}
    },
  };
}

async function playOneGame(browser, weaponKind, gameIndex) {
  log(`\n======================================================`);
  log(`>>> STARTING GAME ${gameIndex}: Weapon [${weaponKind.toUpperCase()}] <<<`);
  log(`======================================================\n`);

  const pageErrors = [];
  const consoleErrors = [];

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  page.on('pageerror', (err) => {
    log(`[${weaponKind}] PAGE ERROR:`, err.message);
    pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log(`[${weaponKind}] CONSOLE ERROR:`, msg.text());
      consoleErrors.push(msg.text());
    }
  });

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    log(`[${weaponKind}] Saved screenshot: ${name}.png`);
  };

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(2500);

  if (gameIndex === 1) {
    await shot(`E-01-lobby-initial`);
  }

  // 1P 📱 모바일 선택
  log(`[${weaponKind}] Selecting 1P Mobile slot...`);
  await page.getByText('📱 모바일').first().click();
  await sleep(1000);

  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  log(`[${weaponKind}] Room ID: ${roomId}`);

  const phone = createFakePhone(roomId, 1, `폰_${weaponKind}`);
  await phone.join();
  await sleep(600);

  if (gameIndex === 1) {
    await shot(`E-02-lobby-phone-paired`);
  }

  log(`[${weaponKind}] Calibrating Zero...`);
  await phone.zero();
  await phone.aimHold(0, 0, 600);

  if (gameIndex === 1) {
    await shot(`E-03-lobby-phone-ready`);
  }

  // 폰으로 화면 가운데 사격하여 게임 시작 (D33)
  log(`[${weaponKind}] Phone shooting center to trigger start countdown...`);
  await phone.snap(0, 0);
  await phone.aimHold(0, 0, 4200); // 3초 카운트다운 동안 조준 유지

  // 무기 카드 선택 화면 대기
  log(`[${weaponKind}] Waiting for weapon select screen...`);
  let weaponSelectReady = false;
  for (let i = 0; i < 30; i++) {
    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap && snap.selection && snap.selection.kind === 'weapon') {
      weaponSelectReady = true;
      break;
    }
    await sleep(200);
  }

  if (!weaponSelectReady) {
    throw new Error(`Weapon select screen did not appear for ${weaponKind}`);
  }

  await sleep(800);
  await shot(`E-04-weapon-select-${weaponKind}`);

  // 해당 무기 카드 표적 찾기
  const weaponSnap = await page.evaluate(() => window.__BEER_DEBUG__.snapshot());
  const weaponTarget = weaponSnap.targets.find(
    (t) => t.selectKind === 'weapon' && t.selectValue === weaponKind
  );
  if (!weaponTarget) {
    throw new Error(`Could not find weapon target for ${weaponKind}`);
  }
  log(`[${weaponKind}] Found weapon card at aimX=${weaponTarget.aimX}, aimY=${weaponTarget.aimY}`);

  // 카드 위치로 조준 및 사격
  await phone.aimHold(weaponTarget.aimX, weaponTarget.aimY, 500);
  await phone.snap(weaponTarget.aimX, weaponTarget.aimY);
  await sleep(1500);

  // 전투 시작 확인
  let inCombat = false;
  for (let i = 0; i < 30; i++) {
    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap && snap.phase === 'PLAYING' && !snap.selection.kind) {
      inCombat = true;
      break;
    }
    await sleep(200);
  }
  log(`[${weaponKind}] In combat: ${inCombat}`);
  await shot(`E-05-combat-start-${weaponKind}`);

  // 게임 진행 데이터 구조
  const gameStats = {
    weapon: weaponKind,
    totalDurationSec: 0,
    resultPhase: '',
    finalWave: 1,
    finalScore: 0,
    finalLives: 0,
    waveLogs: {}, // wave -> { startTime, endTime, durSec, startLives, endLives, bossSeen, bossKilled, cards: [] }
    rapidFireHoldTest: null,
    feverTest: null,
    skillUsedCount: 0,
    pageErrors,
    consoleErrors,
  };

  const gameStartTime = Date.now();
  let currentWave = 1;
  let waveStartTime = Date.now();
  let waveStartLives = 5;

  gameStats.waveLogs[1] = {
    wave: 1,
    startLives: 5,
    endLives: 5,
    bossSeen: false,
    bossKilled: false,
    cards: [],
  };

  let lastShotTime = 0;
  let rapidHoldTested = false;
  let feverTested = false;
  let lastSkillTime = Date.now();
  let isCardSelectPending = false;
  let cardSelectStartTime = 0;
  let lastProgressCheck = Date.now();
  let lastScoreCheck = 0;

  // 메인 전투 루프
  while (true) {
    const now = Date.now();
    if (now - gameStartTime > 10 * 60 * 1000) {
      log(`[${weaponKind}] GAME TIMEOUT (10 min)`);
      break;
    }

    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (!snap) {
      await sleep(100);
      continue;
    }

    // 게임 종료 확인
    if (snap.phase === 'VICTORY' || snap.phase === 'GAME_OVER') {
      log(`[${weaponKind}] Game ended with phase: ${snap.phase}`);
      gameStats.resultPhase = snap.phase;
      gameStats.finalWave = snap.wave;
      gameStats.finalScore = snap.players[0]?.score ?? 0;
      gameStats.finalLives = snap.lives;
      break;
    }

    // 결과 화면 모달 확인
    const restartBtnCount = await page.locator('[data-shootable="restart"]').count();
    if (restartBtnCount > 0) {
      log(`[${weaponKind}] Result screen detected via restart button`);
      gameStats.resultPhase = snap.phase || 'RESULT';
      gameStats.finalWave = snap.wave;
      gameStats.finalScore = snap.players[0]?.score ?? 0;
      gameStats.finalLives = snap.lives;
      break;
    }

    // 웨이브 전환 확인
    if (snap.wave !== currentWave) {
      const prevWave = currentWave;
      const waveDur = (now - waveStartTime) / 1000;
      log(`[${weaponKind}] Wave ${prevWave} finished in ${waveDur.toFixed(1)}s! Entering Wave ${snap.wave}`);

      if (gameStats.waveLogs[prevWave]) {
        gameStats.waveLogs[prevWave].durSec = waveDur;
        gameStats.waveLogs[prevWave].endLives = snap.lives;
      }

      currentWave = snap.wave;
      waveStartTime = now;
      waveStartLives = snap.lives;
      gameStats.waveLogs[currentWave] = {
        wave: currentWave,
        startLives: snap.lives,
        endLives: snap.lives,
        bossSeen: false,
        bossKilled: false,
        cards: [],
      };

      await shot(`E-wave-${currentWave}-start-${weaponKind}`);
    }

    const player = snap.players[0];
    if (!player) {
      await sleep(100);
      continue;
    }

    // 5-1 테스트: rapidFireHold (웨이브 1에서 1회 수행)
    if (!rapidHoldTested && currentWave === 1 && snap.targets.some((t) => t.landed && !t.isItem)) {
      rapidHoldTested = true;
      log(`[${weaponKind}] >>> Testing 5-1: rapidFireHold for 1000ms <<<`);
      const target = snap.targets.find((t) => t.landed && !t.isItem);
      const aimX = target ? target.aimX : 0;
      const aimY = target ? target.aimY : 0;

      const ammoBefore = player.ammo;
      await phone.holdRapid(aimX, aimY, 1000);

      const snapAfter = await page.evaluate(() => window.__BEER_DEBUG__.snapshot());
      const ammoAfter = snapAfter.players[0]?.ammo ?? ammoBefore;
      const ammoDiff = ammoBefore - ammoAfter;

      log(`[${weaponKind}] rapidFireHold result: ammoBefore=${ammoBefore}, ammoAfter=${ammoAfter}, diff=${ammoDiff}`);
      gameStats.rapidFireHoldTest = {
        ammoBefore,
        ammoAfter,
        ammoDiff,
        pass: ammoDiff > 1 || (ammoAfter === snapAfter.players[0]?.maxAmmo && snapAfter.players[0]?.isReloading),
      };
      await shot(`E-rapidfire-test-${weaponKind}`);
    }

    // 보상 카드 선택 라운드 처리
    if (snap.selection && snap.selection.kind === 'card' && !snap.selection.done[0]) {
      if (!isCardSelectPending) {
        isCardSelectPending = true;
        cardSelectStartTime = now;
        log(`[${weaponKind}] Reward Card selection appeared in Wave ${currentWave}`);
        await shot(`E-wave-${currentWave}-reward-cards-${weaponKind}`);
      }

      // 카드 생성 후 900ms 대기 (펼침 애니메이션)
      if (now - cardSelectStartTime >= 900) {
        const cards = snap.targets.filter((t) => t.selectKind === 'card');
        if (cards.length > 0) {
          const chosen = cards.find((c) => c.selectValue === 'weapon_level_up') || cards[0];
          log(`[${weaponKind}] Selecting card: ${chosen.selectValue} at (${chosen.aimX}, ${chosen.aimY})`);
          gameStats.waveLogs[currentWave]?.cards.push(chosen.selectValue);

          await phone.aimHold(chosen.aimX, chosen.aimY, 300);
          await phone.snap(chosen.aimX, chosen.aimY);
          await sleep(600);
          isCardSelectPending = false;
        }
      }
      await sleep(50);
      continue;
    } else {
      isCardSelectPending = false;
    }

    // 피버 발동 및 5-1 피버 검증
    if (player.isFeverReady && !player.isFeverActive) {
      log(`[${weaponKind}] Triggering FEVER!`);
      const aim = phone.getAim();
      phone.fever(aim.aimX, aim.aimY);

      if (!feverTested) {
        feverTested = true;
        log(`[${weaponKind}] >>> Testing 5-1: Fever 2s tracking <<<`);
        const scoreBefore = player.score;
        await shot(`E-fever-activated-${weaponKind}`);

        await sleep(2000);
        const feverSnap = await page.evaluate(() => window.__BEER_DEBUG__.snapshot());
        const scoreAfter = feverSnap.players[0]?.score ?? scoreBefore;
        const scoreDiff = scoreAfter - scoreBefore;
        log(`[${weaponKind}] Fever 2s result: scoreBefore=${scoreBefore}, scoreAfter=${scoreAfter}, diff=${scoreDiff}`);
        gameStats.feverTest = {
          scoreBefore,
          scoreAfter,
          scoreDiff,
          pass: scoreDiff > 0,
        };
      }
    }

    // 보스 등장 확인
    const bossTarget = snap.targets.find((t) => t.kind === 'boss');
    if (bossTarget) {
      if (!gameStats.waveLogs[currentWave]?.bossSeen) {
        gameStats.waveLogs[currentWave].bossSeen = true;
        log(`[${weaponKind}] BOSS ENCOUNTER STARTED in Wave ${currentWave}!`);
        await shot(`E-wave-${currentWave}-boss-encounter-${weaponKind}`);
      }
    } else if (gameStats.waveLogs[currentWave]?.bossSeen && !gameStats.waveLogs[currentWave]?.bossKilled) {
      gameStats.waveLogs[currentWave].bossKilled = true;
      log(`[${weaponKind}] BOSS KILLED in Wave ${currentWave}!`);
      await shot(`E-wave-${currentWave}-boss-killed-${weaponKind}`);
    }

    // 스킬 사용 검증 (일반 몬스터 2마리 이상, 1.5초 쿨다운 등)
    const activeMonsters = snap.targets.filter((t) => !t.isItem && !t.rewardCardKind && t.landed);
    if (player.skillStock > 0 && activeMonsters.length >= 2 && now - lastSkillTime >= 2000) {
      log(`[${weaponKind}] Using Weapon Skill! (stock: ${player.skillStock})`);
      const aim = phone.getAim();
      phone.skill(aim.aimX, aim.aimY);
      gameStats.skillUsedCount++;
      lastSkillTime = now;
      if (gameStats.skillUsedCount === 1) {
        await shot(`E-skill-triggered-${weaponKind}`);
      }
    }

    // 표적 선정 및 조준/사격 (minions-first)
    let pool = snap.targets.filter(
      (t) => !t.isItem && !t.rewardCardKind && !t.isGuarding && t.landed
    );

    if (bossTarget) {
      const minions = pool.filter((t) => t.kind !== 'boss');
      const bosses = pool.filter((t) => t.kind === 'boss');
      // minions-first: 부하가 있으면 부하 먼저, 없으면 보스
      pool = minions.length > 0 ? minions : bosses;
    }

    if (pool.length > 0) {
      // 가장 가까운 표적 (radiusM 최소)
      const target = [...pool].sort((a, b) => a.radiusM - b.radiusM)[0];
      const targetAimX = target.aimX;
      const targetAimY = target.aimY;

      // 조준 프레임 전송
      phone.frame(targetAimX, targetAimY);

      // 발사 제어
      if (player.isFeverActive) {
        // 피버 중: 엔진 자동 발사이므로 조준만 유지
        await sleep(25);
      } else if (weaponKind === 'gatling') {
        // 개틀링: 홀드 연사
        if (!player.isReloading) {
          phone.frame(targetAimX, targetAimY, { rapidFireHold: true });
        } else {
          phone.frame(targetAimX, targetAimY, { rapidFireHold: false });
        }
        await sleep(30);
      } else if (weaponKind === 'shotgun') {
        // 샷건: 단발 사격 (간격 약 450ms)
        if (now - lastShotTime >= 450 && !player.isReloading) {
          lastShotTime = now;
          phone.frame(targetAimX, targetAimY, { snapFire: true });
        }
        await sleep(30);
      } else if (weaponKind === 'revolver') {
        // 리볼버: 단발 사격 (간격 약 180ms)
        if (now - lastShotTime >= 180 && !player.isReloading) {
          lastShotTime = now;
          phone.frame(targetAimX, targetAimY, { snapFire: true });
        }
        await sleep(30);
      }
    } else {
      // 표적이 없을 때: 중앙 조준 유지
      phone.frame(0, 0);
      await sleep(30);
    }
  }

  // 게임 종료 처리 및 결과 화면 확인
  gameStats.totalDurationSec = (Date.now() - gameStartTime) / 1000;
  log(`[${weaponKind}] Game finished in ${gameStats.totalDurationSec.toFixed(1)}s. Waiting for result screen...`);
  await sleep(3000);
  await shot(`E-06-result-${weaponKind}`);

  // 폰 조준으로 "다시 시작" 버튼 사격 테스트
  const restartBtn = page.locator('[data-shootable="restart"]').first();
  if ((await restartBtn.count()) > 0) {
    const box = await restartBtn.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const normX = (centerX / 1440) * 2 - 1;
      const normY = 1 - (centerY / 900) * 2;
      log(`[${weaponKind}] Aiming at restart button: normX=${normX.toFixed(3)}, normY=${normY.toFixed(3)}`);

      // 1. 버튼 밖 사격 (허공: 0.8, -0.8)
      await phone.aimHold(0.8, -0.8, 500);
      await phone.snap(0.8, -0.8);
      await sleep(800);
      const stillOnResult = (await page.locator('[data-shootable="restart"]').count()) > 0;
      log(`[${weaponKind}] Still on result screen after outside shot: ${stillOnResult}`);

      // 2. 버튼 조준 및 사격
      await phone.aimHold(normX, normY, 800);
      await shot(`E-07-result-aim-restart-${weaponKind}`);
      await phone.snap(normX, normY);
      await sleep(2500);
      await shot(`E-08-result-restart-triggered-${weaponKind}`);
    }
  }

  phone.close();
  await ctx.close();

  log(`[${weaponKind}] Completed with stats:`, JSON.stringify(gameStats, null, 2));
  return gameStats;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const weapons = ['shotgun', 'revolver', 'gatling'];
  const allResults = [];

  for (let i = 0; i < weapons.length; i++) {
    const weapon = weapons[i];
    try {
      const result = await playOneGame(browser, weapon, i + 1);
      allResults.push(result);
    } catch (err) {
      log(`Error playing game for ${weapon}:`, err);
      allResults.push({
        weapon,
        error: err.message,
        stack: err.stack,
      });
    }
    await sleep(2000);
  }

  await browser.close();

  // 결과 json 저장
  fs.writeFileSync(
    path.join(OUT, 'fullplay-summary.json'),
    JSON.stringify(allResults, null, 2),
    'utf-8'
  );
  log(`All 3 games completed. Saved fullplay-summary.json`);
}

run().catch((e) => {
  log('FATAL ERROR:', e);
  process.exit(1);
});
