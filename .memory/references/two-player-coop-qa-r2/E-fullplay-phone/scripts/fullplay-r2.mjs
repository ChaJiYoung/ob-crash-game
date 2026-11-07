// QA-E (R2) 폰 1인 풀플레이 스크립트. 실제 브라우저(Playwright) + 가짜 폰(WebSocket 30ms 스트림).
// 사용: node fullplay-r2.mjs [weapon,weapon,...]  (기본 shotgun,revolver,gatling)
// 게임 서버 8805, 개발 서버 5205 (산출물 폴더 바로 아래에 캡처·JSON 저장)
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..');
const URL_ = 'https://127.0.0.1:5205/';
const WS = 'ws://localhost:8805';
const WEAPONS = (process.argv[2] || 'shotgun,revolver,gatling').split(',');
const TIME_LIMIT_MS = 20 * 60 * 1000;
const STALL_MS = 30000;
const SNAP_INTERVAL = { shotgun: 450, revolver: 180 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const SUMMARY = path.join(OUT, 'fullplay-r2-summary.json');

// ---- 가짜 폰: SENSOR_FRAME을 30ms마다 보내고, 일회성 이벤트는 즉시 별도 프레임으로 보낸다 ----
function createPhone(roomId, slot, nickname, tag) {
  const ws = new WebSocket(WS);
  const deviceId = `phone_qa_e_r2_${tag}_${slot}_${Date.now()}`;
  const st = { aimX: 0, aimY: 0, hold: false };
  const errors = [];
  let streamTimer = null;
  const ready = new Promise((res, rej) => {
    ws.on('open', res);
    ws.on('error', rej);
  });
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ERROR') errors.push(`${m.code}: ${m.message}`);
    } catch {}
  });
  const send = (m) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(m));
  };
  const frame = (extra = {}) =>
    send({
      type: 'SENSOR_FRAME',
      roomId,
      deviceId,
      slot,
      payload: {
        aimX: st.aimX,
        aimY: st.aimY,
        pitchDeg: 0,
        yawDeg: 0,
        rollDeg: 0,
        snapFire: false,
        rapidFireHold: st.hold,
        feverTriggered: false,
        isCocked: false,
        skillSnapTriggered: false,
        timestamp: Date.now(),
        ...extra,
      },
    });
  return {
    deviceId,
    errors,
    async join() {
      await ready;
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
      await sleep(400);
    },
    startStream() {
      if (!streamTimer) streamTimer = setInterval(() => frame(), 30);
    },
    async zero() {
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot });
      await sleep(400);
    },
    setAim(x, y) {
      st.aimX = x;
      st.aimY = y;
    },
    setHold(v) {
      st.hold = v;
    },
    aim() {
      return { aimX: st.aimX, aimY: st.aimY };
    },
    snap() {
      frame({ snapFire: true });
    },
    fever() {
      frame({ feverTriggered: true });
    },
    skill() {
      frame({ skillSnapTriggered: true });
    },
    close() {
      if (streamTimer) clearInterval(streamTimer);
      try {
        ws.close();
      } catch {}
    },
  };
}

async function evalSnap(page) {
  try {
    return await page.evaluate(() => (window.__BEER_DEBUG__ ? window.__BEER_DEBUG__.snapshot() : null));
  } catch (e) {
    return null;
  }
}

async function playGame(browser, weapon, gameIndex) {
  log(`\n===== GAME ${gameIndex}: ${weapon.toUpperCase()} =====`);
  const G = {
    weapon,
    end: null,
    waves: {},
    cardRounds: [],
    rapidFireHoldTest: null,
    feverTest: null,
    skillUsed: 0,
    shotsSent: 0,
    stall: null,
    pageErrors: [],
    consoleErrors: [],
    phoneErrors: [],
  };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log(`[${weapon}] PAGE ERROR: ${e.message}`);
    G.pageErrors.push(e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      log(`[${weapon}] CONSOLE ERROR: ${m.text()}`);
      G.consoleErrors.push(m.text());
    }
  });
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `E-${weapon}-${name}.png`) });
    log(`[${weapon}] shot ${name}`);
  };
  const t0 = Date.now();
  const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1);

  await page.goto(URL_, { waitUntil: 'load' });
  await sleep(2500);
  const mobile = page.getByText('📱 모바일').first();
  await mobile.waitFor({ state: 'visible', timeout: 30000 });
  await mobile.click();
  await sleep(1000);
  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  log(`[${weapon}] roomId=${roomId}`);

  const phone = createPhone(roomId, 1, `폰_${weapon}`, weapon);
  await phone.join();
  phone.startStream();
  await sleep(600);
  phone.setAim(0, 0);
  await sleep(600);
  await phone.zero();
  await sleep(300);
  await shot('01-lobby-paired');

  // 가운데 사격 → 카운트다운 → 무기 선택
  phone.snap();
  await sleep(4200);
  let ok = false;
  for (let i = 0; i < 150; i++) {
    const s = await evalSnap(page);
    if (s && s.selection && s.selection.kind === 'weapon') {
      ok = true;
      break;
    }
    await sleep(200);
  }
  if (!ok) throw new Error(`weapon select did not appear (${weapon})`);
  await sleep(800);
  await shot('02-weapon-select');
  const ws0 = await evalSnap(page);
  const wt = ws0.targets.find((t) => t.selectKind === 'weapon' && t.selectValue === weapon);
  if (!wt) throw new Error(`weapon card not found (${weapon})`);
  phone.setAim(wt.aimX, wt.aimY);
  await sleep(500);
  phone.snap();
  await sleep(1500);
  let inCombat = false;
  for (let i = 0; i < 100; i++) {
    const s = await evalSnap(page);
    if (s && s.phase === 'PLAYING' && !s.selection.kind) {
      inCombat = true;
      break;
    }
    await sleep(200);
  }
  G.combatStartSec = elapsed();
  log(`[${weapon}] combat started=${inCombat} at ${G.combatStartSec}s`);
  await shot('03-combat-start');
  const tStart = Date.now(); // 판 시간 제한 기준

  // ---- 메인 루프 ----
  let wave = 0;
  let lastShot = 0;
  let rapidDone = false;
  let feverPending = null; // { t, scoreBefore }
  let feverFiredAt = 0;
  let lastSkillAt = 0;
  let cardRound = null;
  let prevAmmo = null;
  let prevScore = null;
  let lastSig = '';
  let lastSigAt = Date.now();

  const openWave = (w, s) => {
    G.waves[w] = {
      wave: w,
      startSec: ((Date.now() - tStart) / 1000).toFixed(1),
      startLives: s.lives,
      endLives: null,
      bossSeen: false,
      bossFirstSec: null,
      bossGone: false,
      cards: [],
      shotsFiredProxy: 0,
      scoreGain: 0,
      scoreGainSamples: 0,
      lastScore: null,
    };
  };
  const closeWave = (w, s) => {
    const W = G.waves[w];
    if (!W) return;
    W.endLives = s.lives;
    W.durSec = Number(((Date.now() - tStart) / 1000 - Number(W.startSec)).toFixed(1));
  };

  while (true) {
    const now = Date.now();
    if (now - tStart > TIME_LIMIT_MS) {
      G.end = 'TIME_LIMIT_20MIN';
      break;
    }
    const s = await evalSnap(page);
    if (!s) {
      await sleep(80);
      continue;
    }
    if (s.phase === 'VICTORY' || s.phase === 'GAME_OVER') {
      G.end = s.phase;
      break;
    }
    if ((await page.locator('[data-shootable="restart"]').count()) > 0) {
      G.end = 'RESULT_SCREEN';
      break;
    }

    // 웨이브 전환
    if (s.wave !== wave) {
      if (wave) closeWave(wave, s);
      wave = s.wave;
      openWave(wave, s);
      log(`[${weapon}] wave ${wave} at ${elapsed()}s lives=${s.lives}`);
      await shot(`w${wave}-start`);
    }
    const W = G.waves[wave];
    const player = s.players[0];

    // 진행 정지 감시(선택 중 제외)
    const sig = JSON.stringify([
      s.phase,
      s.wave,
      s.lives,
      player.score,
      s.targets.length,
      s.targets.reduce((a, t) => a + (t.aimX || 0) + (t.hp || 0), 0).toFixed(3),
      s.selection.kind,
    ]);
    if (sig !== lastSig) {
      lastSig = sig;
      lastSigAt = now;
    } else if (!s.selection.kind && now - lastSigAt > STALL_MS && !s.isPaused) {
      G.stall = { atSec: elapsed(), wave, sig };
      log(`[${weapon}] STALL: no state change for 30s at wave ${wave}`);
      await shot(`stall-w${wave}`);
      G.end = 'STALL';
      break;
    }

    // 집계: 탄 감소(발사 근사), 점수 증가(명중 근사)
    if (prevAmmo !== null && player.ammo < prevAmmo) W.shotsFiredProxy += prevAmmo - player.ammo;
    if (prevScore !== null && player.score > prevScore) {
      W.scoreGain += player.score - prevScore;
      W.scoreGainSamples++;
    }
    prevAmmo = player.ammo;
    prevScore = player.score;

    // 보스 추적
    const boss = s.targets.find((t) => t.kind === 'boss');
    if (boss && !W.bossSeen) {
      W.bossSeen = true;
      W.bossFirstSec = ((Date.now() - tStart) / 1000).toFixed(1);
      log(`[${weapon}] boss seen in wave ${wave}`);
      await shot(`w${wave}-boss`);
    }
    if (!boss && W.bossSeen && !W.bossGone) {
      W.bossGone = true;
      log(`[${weapon}] boss gone in wave ${wave}`);
    }

    // 보상 카드 라운드
    if (s.selection.kind === 'card') {
      if (!cardRound) {
        const offered = s.targets.filter((t) => t.selectKind === 'card');
        cardRound = { wave, startMs: now, offered: offered.map((t) => t.selectValue), chosen: null };
        G.cardRounds.push(cardRound);
        W.cards.push(cardRound);
        log(`[${weapon}] card round wave ${wave} offered=${cardRound.offered.join(',')}`);
        await shot(`w${wave}-cards`);
      }
      phone.setHold(false);
      if (!s.selection.done[0] && !cardRound.chosen && now - cardRound.startMs >= 900) {
        const cards = s.targets.filter((t) => t.selectKind === 'card');
        const pick = cards.find((c) => c.selectValue === 'weapon_level_up') || cards[0];
        if (pick) {
          cardRound.chosen = pick.selectValue;
          phone.setAim(pick.aimX, pick.aimY);
          await sleep(300);
          phone.snap();
          log(`[${weapon}] picked card ${pick.selectValue}`);
        }
      }
      await sleep(60);
      continue;
    }
    if (cardRound && !cardRound.done) {
      cardRound.done = true;
      cardRound.endSec = ((Date.now() - tStart) / 1000).toFixed(1);
      cardRound = null;
    }

    // 5-1: 누른 채 연사 1초 (웨이브 1, 표적이 있을 때 한 번)
    if (!rapidDone && wave === 1 && s.targets.some((t) => t.landed && !t.isItem && !t.selectKind)) {
      rapidDone = true;
      const tgt = s.targets.find((t) => t.landed && !t.isItem && !t.selectKind);
      phone.setAim(tgt.aimX, tgt.aimY);
      await sleep(150);
      const samples = [];
      const b = await evalSnap(page);
      samples.push({ ms: 0, ammo: b.players[0].ammo, reloading: b.players[0].isReloading });
      phone.setHold(true);
      const tEnd = Date.now() + 1000;
      while (Date.now() < tEnd) {
        await sleep(100);
        const q = await evalSnap(page);
        samples.push({ ms: Date.now() - (tEnd - 1000), ammo: q.players[0].ammo, reloading: q.players[0].isReloading });
      }
      phone.setHold(false);
      await sleep(200);
      let drops = 0;
      for (let i = 1; i < samples.length; i++) if (samples[i].ammo < samples[i - 1].ammo) drops += samples[i - 1].ammo - samples[i].ammo;
      G.rapidFireHoldTest = {
        ammoBefore: samples[0].ammo,
        ammoAfter: samples[samples.length - 1].ammo,
        firedByAmmoDrop: drops,
        samples,
        pass: drops >= 2,
        rule: 'PASS if 1초 홀드 동안 탄약이 2발 이상 감소',
      };
      log(`[${weapon}] RAPID HOLD 1s: fired=${drops} pass=${drops >= 2}`);
      await shot(`rapidfire-test`);
      continue;
    }

    // 피버: 준비되면 한 번 발동(같은 프레임 반복 금지), 2초 뒤 점수 확인
    if (player.isFeverReady && !player.isFeverActive && now - feverFiredAt > 600) {
      feverFiredAt = now;
      phone.fever();
      if (!G.feverTest) {
        feverPending = { t: now, scoreBefore: player.score };
        log(`[${weapon}] FEVER triggered`);
        await shot(`fever-trigger`);
      }
    }
    if (feverPending && now - feverPending.t >= 2000) {
      const q = await evalSnap(page);
      G.feverTest = {
        scoreBefore: feverPending.scoreBefore,
        scoreAfter: q.players[0].score,
        feverActiveAfter2s: q.players[0].isFeverActive,
        scoreDiff: q.players[0].score - feverPending.scoreBefore,
        pass: q.players[0].score > feverPending.scoreBefore,
        rule: 'PASS if 피버 발동 후 2초 동안 점수 증가',
      };
      feverPending = null;
      log(`[${weapon}] fever 2s diff=${G.feverTest.scoreDiff}`);
      await shot(`fever-after-2s`);
    }

    // 스킬: 스톡이 있고 일반 몬스터 2마리 이상, 2초 간격
    const monsters = s.targets.filter((t) => !t.isItem && !t.rewardCardKind && !t.selectKind && t.landed);
    if (player.skillStock > 0 && monsters.length >= 2 && now - lastSkillAt >= 2000) {
      lastSkillAt = now;
      phone.skill();
      G.skillUsed++;
      if (G.skillUsed === 1) await shot(`skill-first`);
    }

    // 표적 선정: minions-first, 가장 가까운(radiusM 최소)
    let pool = s.targets.filter((t) => !t.isItem && !t.rewardCardKind && !t.selectKind && !t.isGuarding && t.landed);
    if (boss) {
      const minions = pool.filter((t) => t.kind !== 'boss');
      const bosses = pool.filter((t) => t.kind === 'boss');
      pool = minions.length > 0 ? minions : bosses;
    }
    if (pool.length > 0) {
      const tgt = [...pool].sort((a, b) => a.radiusM - b.radiusM)[0];
      phone.setAim(tgt.aimX, tgt.aimY);
      if (player.isFeverActive) {
        phone.setHold(false); // 피버 중엔 엔진이 자동 사격
      } else if (weapon === 'gatling') {
        phone.setHold(!player.isReloading);
      } else {
        const interval = SNAP_INTERVAL[weapon] ?? 450;
        if (!player.isReloading && now - lastShot >= interval) {
          lastShot = now;
          G.shotsSent++;
          phone.snap();
        }
      }
    } else {
      phone.setAim(0, 0);
      phone.setHold(false);
    }
    await sleep(40);
  }

  // ---- 종료 처리 ----
  G.totalSec = Number(((Date.now() - tStart) / 1000).toFixed(1));
  const finalSnap = await evalSnap(page);
  if (wave && finalSnap) closeWave(wave, finalSnap);
  G.finalPhase = finalSnap ? finalSnap.phase : null;
  G.finalWave = finalSnap ? finalSnap.wave : null;
  G.finalLives = finalSnap ? finalSnap.lives : null;
  G.finalScore = finalSnap ? finalSnap.players[0].score : null;
  log(`[${weapon}] END=${G.end} phase=${G.finalPhase} wave=${G.finalWave} total=${G.totalSec}s`);
  if (G.end !== 'STALL') {
    await sleep(3000);
    await shot('result');
    G.resultText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 600);
    // 폰 조준으로 "다시 시작" 버튼 쏘기: 바깥 → 버튼
    const restart = page.locator('[data-shootable="restart"]').first();
    if ((await restart.count()) > 0) {
      const box = await restart.boundingBox();
      const nx = ((box.x + box.width / 2) / 1440) * 2 - 1;
      const ny = 1 - ((box.y + box.height / 2) / 900) * 2;
      phone.setAim(0.8, -0.8);
      await sleep(400);
      phone.snap();
      await sleep(800);
      G.restartOutsideShotStillOnResult = (await page.locator('[data-shootable="restart"]').count()) > 0;
      phone.setAim(nx, ny);
      await sleep(600);
      G.restartAim = { nx: Number(nx.toFixed(3)), ny: Number(ny.toFixed(3)) };
      await shot('result-aim-restart');
      phone.snap();
      await sleep(2500);
      G.restartTriggered = (await page.locator('[data-shootable="restart"]').count()) === 0;
      await shot('after-restart-shot');
    }
  }
  G.phoneErrors = phone.errors;
  phone.close();
  await ctx.close();
  return G;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const results = [];
  for (let i = 0; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    try {
      results.push(await playGame(browser, w, i + 1));
    } catch (e) {
      log(`[${w}] ERROR: ${e.message}`);
      results.push({ weapon: w, error: e.message });
    }
    fs.writeFileSync(SUMMARY, JSON.stringify(results, null, 2), 'utf-8');
    await sleep(1500);
  }
  await browser.close();
  log(`done -> ${SUMMARY}`);
}

main().catch((e) => {
  log('FATAL', e);
  process.exit(1);
});
