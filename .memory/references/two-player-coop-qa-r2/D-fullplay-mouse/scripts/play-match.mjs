import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/D-fullplay-mouse';
const URL = 'https://127.0.0.1:5204/';
const WEAPON = process.argv[2] || 'shotgun'; // 'shotgun' | 'revolver' | 'gatling'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}] [${WEAPON}]`, ...args);

// viewportRatioToAim의 완벽한 역변환:
// normX = aimX * 0.94, normY = aimY * 0.84
const toScreenX = (aimX) => Math.round(((Math.max(-1, Math.min(1, aimX)) * 0.94 + 1) / 2) * 1440);
const toScreenY = (aimY) => Math.round(((1 - Math.max(-1, Math.min(1, aimY)) * 0.84) / 2) * 900);

async function runMatch() {
  log(`=== Starting Full Play Match: ${WEAPON} ===`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await ctx.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    pageErrors.push(e.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', msg.text());
      consoleErrors.push(msg.text());
    }
  });

  const shot = async (name) => {
    const filePath = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath });
    log(`Saved screenshot: ${name}.png`);
    return filePath;
  };

  // 1. 페이지 로드 및 초기화
  log('Loading game page...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1000);

  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1500);

  // 2. 1P 마우스 선택
  log('Selecting 1P Mouse...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const mouseBtn = btns.find((b) => b.textContent && b.textContent.includes('마우스'));
    mouseBtn?.click();
  });
  await sleep(800);

  // 3. 닉네임 입력 및 확인
  const nickInput = page.locator('input[placeholder="닉네임 입력"]');
  const hasInput = await nickInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasInput) {
    log('Filling nickname and confirming...');
    await nickInput.fill(`QA-D-${WEAPON.toUpperCase()}`);
    await sleep(200);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find((b) => b.textContent && b.textContent.trim() === '확인');
      confirmBtn?.click();
    });
    await sleep(800);
  }

  await shot(`D-${WEAPON}-01-lobby-ready`);

  // 4. 게임 시작 버튼 클릭
  log('Clicking Game Start button...');
  const startBtn = page.locator('[data-shootable="start"]');
  await startBtn.click();
  await sleep(1500);

  // 5. 무기 카드 선택 대기 및 선택
  log(`Waiting for weapon select phase for ${WEAPON}...`);
  let weaponSelected = false;
  for (let i = 0; i < 40; i++) {
    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap && snap.selection && snap.selection.kind === 'weapon') {
      log('Weapon select phase active. Targets:', snap.targets.length);
      await shot(`D-${WEAPON}-02-weapon-select-screen`);

      const targetCard =
        snap.targets.find((t) => t.selectKind === 'weapon' && t.selectValue === WEAPON) ||
        snap.targets.find((t) => t.selectKind === 'weapon') ||
        snap.targets[0];

      if (targetCard) {
        const sx = toScreenX(targetCard.aimX);
        const sy = toScreenY(targetCard.aimY);
        log(`Clicking ${WEAPON} card at (${sx}, ${sy})...`);
        await page.mouse.move(sx, sy);
        await sleep(100);
        await page.mouse.click(sx, sy);
        await sleep(600);
        weaponSelected = true;
        break;
      }
    }
    await sleep(200);
  }

  if (!weaponSelected) {
    log('WARNING: Failed to select weapon card automatically, continuing...');
  }

  // 6. 메인 전투 루프
  log('Starting combat loop...');
  const matchRecord = {
    weapon: WEAPON,
    startTime: Date.now(),
    endTime: 0,
    durationSec: 0,
    waves: {},
    bossEncounters: [],
    cardSelections: [],
    rapidFireTest: null,
    feverTest: null,
    pageErrors,
    consoleErrors,
    finalResult: null,
  };

  let currentWave = 1;
  let waveStartTime = Date.now();
  let lastStateChangeTime = Date.now();
  let lastSeenScore = 0;
  let lastSeenWave = 1;
  let rapidTestDone = false;
  let feverTestDone = false;
  let bossActive = false;
  let bossSpawnTime = 0;
  let cardRoundCaptured = false;
  let lastPeriodicLogTime = Date.now();

  // 초기 웨이브 1 기록 초기화
  matchRecord.waves[1] = {
    wave: 1,
    startLives: 3,
    endLives: 3,
    durationSec: 0,
    bossSpawned: false,
    bossKilled: false,
    cardsOffered: [],
    cardChosen: null,
  };

  const loopStartTime = Date.now();
  const MAX_MATCH_MS = 12 * 60 * 1000; // 최대 12분

  while (Date.now() - loopStartTime < MAX_MATCH_MS) {
    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (!snap) {
      await sleep(100);
      continue;
    }

    const now = Date.now();
    const player = snap.players[0];

    // 주기적 상태 로그 (매 5초)
    if (now - lastPeriodicLogTime >= 5000) {
      lastPeriodicLogTime = now;
      log(`[STATUS] Wave: ${snap.wave}, Lives: ${snap.lives}, Score: ${player.score}, Ammo: ${player.ammo}/${player.maxAmmo}, Fever: ${player.isFeverActive ? 'ACTIVE' : player.isFeverReady ? 'READY' : 'CHARGING'}, Skill: ${player.skillStock}, Targets: ${snap.targets.length}`);
    }

    // 결과 화면 감지 (VICTORY or GAMEOVER)
    if (snap.phase === 'VICTORY' || snap.phase === 'GAMEOVER') {
      log(`Match ended with phase: ${snap.phase}! Final Wave: ${snap.wave}, Lives: ${snap.lives}, Score: ${player.score}`);
      await sleep(1500);
      const resultShot = await shot(`D-${WEAPON}-07-result-${snap.phase.toLowerCase()}`);

      const finalStats = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          bodyTextSnippet: bodyText.slice(0, 500),
          snapshot: window.__BEER_DEBUG__?.snapshot(),
        };
      });

      matchRecord.endTime = now;
      matchRecord.durationSec = Math.round((now - matchRecord.startTime) / 1000);
      matchRecord.finalResult = {
        phase: snap.phase,
        wave: snap.wave,
        lives: snap.lives,
        score: player.score,
        weaponLevel: player.weaponLevel,
        screenshot: resultShot,
        finalStats,
      };

      if (matchRecord.waves[currentWave]) {
        matchRecord.waves[currentWave].endLives = snap.lives;
        matchRecord.waves[currentWave].durationSec = Math.round((now - waveStartTime) / 1000);
      }
      break;
    }

    // 보상 카드 선택 단계 감지
    if (snap.selection && snap.selection.kind === 'card') {
      if (!cardRoundCaptured) {
        log(`Reward card round pending for wave ${snap.wave}!`);
        await shot(`D-${WEAPON}-wave-${snap.wave}-reward-cards`);
        cardRoundCaptured = true;
      }

      const cards = snap.targets.filter((t) => t.selectKind === 'card');
      if (cards.length > 0) {
        // minions-first 규칙: weapon_level_up 우선, 없으면 첫 번째
        const chosenCard = cards.find((c) => c.selectValue === 'weapon_level_up') || cards[0];
        const cx = toScreenX(chosenCard.aimX);
        const cy = toScreenY(chosenCard.aimY);
        log(`Picking reward card: ${chosenCard.selectValue} at (${cx}, ${cy})`);

        matchRecord.cardSelections.push({
          wave: snap.wave,
          cardChosen: chosenCard.selectValue,
          available: cards.map((c) => c.selectValue),
        });

        if (matchRecord.waves[snap.wave]) {
          matchRecord.waves[snap.wave].cardChosen = chosenCard.selectValue;
          matchRecord.waves[snap.wave].cardsOffered = cards.map((c) => c.selectValue);
        }

        await page.mouse.move(cx, cy);
        await sleep(100);
        await page.mouse.click(cx, cy);
        await sleep(600); // 카드 선택 후 잠시 대기 (D27)
        cardRoundCaptured = false;
        continue;
      }
    }

    // 전투 중 (PLAYING)
    if (snap.phase === 'PLAYING') {
      // 웨이브 전환 감지
      if (snap.wave !== currentWave) {
        log(`Wave changed from ${currentWave} to ${snap.wave}! Lives: ${snap.lives}, Score: ${player.score}`);
        if (matchRecord.waves[currentWave]) {
          matchRecord.waves[currentWave].endLives = snap.lives;
          matchRecord.waves[currentWave].durationSec = Math.round((now - waveStartTime) / 1000);
        }

        currentWave = snap.wave;
        waveStartTime = now;
        lastStateChangeTime = now;
        cardRoundCaptured = false;

        matchRecord.waves[currentWave] = {
          wave: currentWave,
          startLives: snap.lives,
          endLives: snap.lives,
          durationSec: 0,
          bossSpawned: false,
          bossKilled: false,
          cardsOffered: [],
          cardChosen: null,
        };

        await shot(`D-${WEAPON}-wave-${currentWave}-start`);
      }

      // 보스 조우 감지
      const bossTarget = snap.targets.find((t) => t.kind === 'boss');
      if (bossTarget && !bossActive) {
        bossActive = true;
        bossSpawnTime = now;
        log(`Boss spawned in Wave ${currentWave}! Max HP: ${bossTarget.maxHp}`);
        if (matchRecord.waves[currentWave]) {
          matchRecord.waves[currentWave].bossSpawned = true;
        }
        await shot(`D-${WEAPON}-wave-${currentWave}-boss-spawn`);
      } else if (!bossTarget && bossActive) {
        bossActive = false;
        const bossDurationSec = Math.round((now - bossSpawnTime) / 1000);
        log(`Boss defeated in Wave ${currentWave} after ${bossDurationSec}s!`);
        if (matchRecord.waves[currentWave]) {
          matchRecord.waves[currentWave].bossKilled = true;
        }
        matchRecord.bossEncounters.push({
          wave: currentWave,
          durationSec: bossDurationSec,
          timestamp: now,
        });
        await shot(`D-${WEAPON}-wave-${currentWave}-boss-killed`);
      }

      // 정체 감지 (30초 이상 웨이브와 점수 변화 없음)
      if (snap.wave !== lastSeenWave || player.score !== lastSeenScore) {
        lastSeenWave = snap.wave;
        lastSeenScore = player.score;
        lastStateChangeTime = now;
      } else if (now - lastStateChangeTime > 30000) {
        log(`STALL DETECTED! No change for ${(now - lastStateChangeTime) / 1000}s`);
        await shot(`D-${WEAPON}-stall-detected`);
      }

      // 5-1 누른 채 연사 테스트 (웨이브 1 초반 1회 수행)
      if (!rapidTestDone && currentWave === 1 && now - loopStartTime > 2000 && !player.isReloading) {
        log('Performing 5-1 Rapid Fire Hold Test (1s mouse down)...');
        const beforeSnap = snap;
        const beforeAmmo = beforeSnap.players[0].ammo;

        // 화면 중앙에 조준 후 1초간 누름
        await page.mouse.move(720, 450);
        await page.mouse.down();
        await sleep(1000);
        await page.mouse.up();

        const afterSnap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
        const afterAmmo = afterSnap?.players[0].ammo ?? beforeAmmo;
        const ammoDiff = beforeAmmo - afterAmmo;
        log(`Rapid fire hold test: beforeAmmo=${beforeAmmo}, afterAmmo=${afterAmmo}, diff=${ammoDiff}`);

        await shot(`D-${WEAPON}-03-rapid-fire-test`);
        matchRecord.rapidFireTest = {
          beforeAmmo,
          afterAmmo,
          diff: ammoDiff,
          passed: ammoDiff >= 1 || afterSnap?.players[0].isReloading,
        };
        rapidTestDone = true;
        continue;
      }

      // 5-1 피버 발동 및 자동 연사 테스트
      if (player.isFeverReady && !player.isFeverActive) {
        log('Fever is READY! Triggering double-click...');
        const feverTarget = snap.targets[0];
        const fx = feverTarget ? toScreenX(feverTarget.aimX) : 720;
        const fy = feverTarget ? toScreenY(feverTarget.aimY) : 450;

        const scoreBefore = player.score;
        await page.mouse.move(fx, fy);
        await page.mouse.dblclick(fx, fy);
        await sleep(200);

        const checkFeverSnap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
        if (checkFeverSnap?.players[0].isFeverActive) {
          log('Fever successfully activated!');
          await shot(`D-${WEAPON}-04-fever-activated`);

          if (!feverTestDone) {
            log('Testing Fever 2s auto-fire score gain...');
            await sleep(2000);
            const feverAfterSnap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
            const scoreAfter = feverAfterSnap?.players[0].score ?? scoreBefore;
            const scoreGain = scoreAfter - scoreBefore;
            log(`Fever 2s score gain: ${scoreGain} (before: ${scoreBefore}, after: ${scoreAfter})`);
            await shot(`D-${WEAPON}-05-fever-autofire-progress`);
            matchRecord.feverTest = {
              scoreBefore,
              scoreAfter,
              scoreGain,
              passed: scoreGain > 0,
            };
            feverTestDone = true;
          }
        }
      }

      // 우클릭 스킬 사용 검사
      const monsCount = snap.targets.filter((t) => !t.isItem && !t.selectKind && !t.isProjectile).length;
      if (player.skillStock > 0 && monsCount >= 2 && now - loopStartTime > 3000) {
        log(`Skill stock: ${player.skillStock}, mons: ${monsCount}. Triggering right-click skill...`);
        const skillTarget = snap.targets.find((t) => t.landed) || snap.targets[0];
        const sx = skillTarget ? toScreenX(skillTarget.aimX) : 720;
        const sy = skillTarget ? toScreenY(skillTarget.aimY) : 450;
        await page.mouse.move(sx, sy);
        await page.mouse.click(sx, sy, { button: 'right' });
        await shot(`D-${WEAPON}-06-skill-fired`);
        await sleep(150);
      }

      // 일반 사격 (minions-first 봇 전략)
      // 1. 착지된 표적 중 보호/가드/아이템/선택카드 제외
      let pool = snap.targets.filter(
        (t) => !t.isItem && !t.selectKind && !t.isGuarding && t.landed
      );

      // 보스전인 경우: 부하 먼저(minions-first)
      if (snap.targets.some((t) => t.kind === 'boss')) {
        const bosses = pool.filter((t) => t.kind === 'boss');
        const others = pool.filter((t) => t.kind !== 'boss');
        pool = others.length > 0 ? others : bosses;
      }

      // 착지된 타깃이 없으면 공중 몬스터라도 조준
      if (pool.length === 0) {
        pool = snap.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding);
      }

      if (pool.length > 0) {
        // 가장 가까운 타깃 (radiusM 최소)
        const near = [...pool].sort((a, b) => a.radiusM - b.radiusM)[0];
        const tx = toScreenX(near.aimX);
        const ty = toScreenY(near.aimY);

        await page.mouse.move(tx, ty);

        if (!player.isReloading) {
          // Playwright에서 탭 발사: mousedown -> 짧은 딜레이 -> mouseup
          await page.mouse.down();
          await sleep(WEAPON === 'gatling' ? 60 : 30);
          await page.mouse.up();
        }
      } else {
        // 타깃 없음 -> 화면 중앙 대기
        await page.mouse.move(720, 450);
      }
    }

    await sleep(20); // 틱 간격
  }

  // 매치 요약 파일 저장
  const recordPath = path.join(OUT_DIR, `match-record-${WEAPON}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(matchRecord, null, 2));
  log(`Match record saved to ${recordPath}`);

  await browser.close();
  return matchRecord;
}

runMatch().catch((err) => {
  log('FATAL ERROR:', err);
  process.exit(1);
});
