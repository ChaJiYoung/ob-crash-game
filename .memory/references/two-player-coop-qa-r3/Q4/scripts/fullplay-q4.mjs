import fs from 'node:fs';
import path from 'node:path';
import {
  launch,
  snap,
  sleep,
  toScreenX,
  toScreenY,
  measureRaf1s,
  getSystemLoad,
  enterCombat,
  VW,
  VH,
} from './lib-q4.mjs';

const OUT = path.resolve(import.meta.dirname, '..');
const WEAPON = process.argv[2] || 'shotgun';
const LIMIT_MS = Number(process.argv[3] || 25) * 60 * 1000; // 최대 25분
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] [${WEAPON}]`, ...a);

const { browser, page, pageErrors, consoleErrors } = await launch();

const shot = async (name) => {
  const filename = `${WEAPON}-${name}.png`;
  const filePath = path.join(OUT, filename);
  await page.screenshot({ path: filePath });
  log(`Screenshot saved: ${filename}`);
  return filename;
};

const rec = {
  weapon: WEAPON,
  renderer: 'chromium headless, --use-angle=metal --enable-webgl',
  startedAt: new Date().toISOString(),
  pick: null,
  waves: {},
  waveRafChecks: {},
  bossEncounters: [],
  cardRounds: [],
  fever: [],
  skill: [],
  stalls: [],
  shots: { ammoDrops: 0 },
  viewport: `${VW}x${VH}`,
  kills: 0,
  result: null,
  pageErrors,
  consoleErrors,
};

const ev = (msg) => log(msg);

// 로비 진입 및 무기 선택
rec.pick = await enterCombat(page, {
  nickname: `QA-Q4-${WEAPON.toUpperCase()}`,
  weapon: WEAPON,
  shot: async (tag) => await shot(tag),
});
ev(`Picked weapon: ${rec.pick}`);
await shot('03-combat-start');

let holding = false;
const hold = async (on) => {
  if (on && !holding) {
    await page.mouse.down();
    holding = true;
  }
  if (!on && holding) {
    await page.mouse.up();
    holding = false;
  }
};

let s = await snap(page);
let wave = s.wave;
let lastAmmo = s.players[0].ammo;
let lastScore = s.players[0].score;
let lastChangeT = Date.now();
let bossActive = false;
let bossStartT = 0;
let cardOpen = false;
let cardRound = null;
let feverWatch = null;
let lastSkillT = 0;
let lastFeverT = 0;
let loops = 0;
let prevTargetIds = new Set();
let waveStartT = Date.now();
let endPhase = null;

// 웨이브 1 시작 기록 및 rAF 측정
const load1 = getSystemLoad();
const raf1 = await measureRaf1s(page);
rec.waveRafChecks[wave] = {
  wave,
  raf1s: raf1,
  loadavg: load1.loadavg,
  uptime: load1.uptime,
  measuredAtSec: Math.round((Date.now() - T0) / 1000),
};
ev(`Wave ${wave} start rAF: ${raf1} (load: ${load1.loadavg.join(', ')})`);

rec.waves[wave] = {
  wave,
  startT: Math.round((Date.now() - T0) / 1000),
  startLives: s.lives,
  endLives: null,
  durationSec: null,
  bossSpawned: false,
  bossKilled: false,
  cardRounds: 0,
};
await shot(`wave${wave}-start`);

try {
  while (Date.now() - T0 < LIMIT_MS) {
    s = await snap(page);
    if (!s) {
      await sleep(50);
      continue;
    }
    loops += 1;
    const now = Date.now();
    const p = s.players[0];

    if (s.phase === 'VICTORY' || s.phase === 'GAMEOVER') {
      endPhase = s.phase;
      await hold(false);
      break;
    }

    // ── 보상 카드 라운드 ─────────────────────────────
    if (s.selection.kind === 'card') {
      await hold(false);
      const cards = s.targets.filter((t) => t.selectKind === 'card');
      if (!cardOpen && cards.length) {
        cardOpen = true;
        const f = await shot(`wave${s.wave}-cards`);
        cardRound = {
          wave: s.wave,
          offered: cards.map((c) => c.selectValue),
          chosen: null,
          screenshot: f,
          t: Math.round((now - T0) / 1000),
        };
        if (rec.waves[s.wave]) rec.waves[s.wave].cardRounds += 1;
        ev(`Card round wave ${s.wave}: offered ${cards.map((c) => c.selectValue).join(', ')}`);
      }
      if (cards.length) {
        const c = cards.find((x) => x.selectValue === 'weapon_level_up') || cards[0];
        const cx = toScreenX(c.aimX);
        const cy = toScreenY(c.aimY);
        await page.mouse.move(cx, cy);
        await sleep(60);
        await page.mouse.click(cx, cy);
        if (cardRound) {
          cardRound.chosen = c.selectValue;
          rec.cardRounds.push(cardRound);
          cardRound = null;
        }
        ev(`Picked card: ${c.selectValue}`);
        await sleep(500); // 카드 선택 직후 스킬 잠금(D27) 지나도록
      }
      continue;
    }
    cardOpen = false;

    // ── 웨이브 전환 ─────────────────────────────────
    if (s.wave !== wave) {
      await hold(false);
      const w = rec.waves[wave];
      if (w) {
        w.endLives = s.lives;
        w.durationSec = Math.round((now - waveStartT) / 1000);
      }
      ev(`Wave ${wave} -> ${s.wave} (lives ${s.lives}, score ${p.score})`);
      wave = s.wave;
      waveStartT = now;
      rec.waves[wave] = {
        wave,
        startT: Math.round((now - T0) / 1000),
        startLives: s.lives,
        endLives: null,
        durationSec: null,
        bossSpawned: false,
        bossKilled: false,
        cardRounds: 0,
      };

      // 각 웨이브 시작 시 rAF 및 부하 측정
      const wLoad = getSystemLoad();
      const wRaf = await measureRaf1s(page);
      rec.waveRafChecks[wave] = {
        wave,
        raf1s: wRaf,
        loadavg: wLoad.loadavg,
        uptime: wLoad.uptime,
        measuredAtSec: Math.round((now - T0) / 1000),
      };
      ev(`Wave ${wave} start rAF: ${wRaf} (load: ${wLoad.loadavg.join(', ')})`);

      await shot(`wave${wave}-start`);
      lastChangeT = now;
    }

    if (s.phase !== 'PLAYING') {
      await sleep(50);
      continue;
    }

    // ── 보스 조우 & 부하 규칙 (보스전은 부하 먼저) ───────────────────
    const boss = s.targets.find((t) => t.kind === 'boss');
    if (boss && !bossActive) {
      bossActive = true;
      await hold(false);

      // 보스전 시간 측정 직전 rAF 측정 및 부하 규칙 확인
      ev(`Boss spawned wave ${wave}, maxHp ${boss.maxHp}. Checking load rule before measuring boss fight...`);
      let checkAttempts = 0;
      let bRaf = 0;
      let bLoad = getSystemLoad();
      let skippedDueToLoad = false;

      while (checkAttempts < 20) {
        checkAttempts++;
        bLoad = getSystemLoad();
        bRaf = await measureRaf1s(page);
        ev(`Boss pre-fight check #${checkAttempts}: rAF=${bRaf}, loadavg=[${bLoad.loadavg.join(', ')}], uptime=${bLoad.uptime}`);

        if (bRaf >= 30) {
          break;
        } else {
          ev(`WARNING: rAF ${bRaf} < 30! Pausing and waiting 30s before recheck (${checkAttempts}/20)...`);
          // Escape 눌러 일시정지
          await page.keyboard.press('Escape');
          await sleep(30000);
          // Escape 눌러 재개
          await page.keyboard.press('Escape');
          await sleep(500);
        }
      }

      if (bRaf < 30) {
        ev(`SKIP: rAF did not reach 30 within 10 minutes (last rAF: ${bRaf})`);
        skippedDueToLoad = true;
      }

      bossStartT = Date.now();
      if (rec.waves[wave]) rec.waves[wave].bossSpawned = true;
      await shot(`wave${wave}-boss-spawn`);

      rec.bossEncounters.push({
        wave,
        maxHp: boss.maxHp,
        preRaf: bRaf,
        preLoadavg: bLoad.loadavg,
        preUptime: bLoad.uptime,
        skippedDueToLoad,
        startedAtSec: Math.round((bossStartT - T0) / 1000),
        durationSec: null,
        outcome: null,
      });
    } else if (!boss && bossActive) {
      bossActive = false;
      const dur = Math.round((now - bossStartT) / 1000);
      if (rec.waves[wave]) rec.waves[wave].bossKilled = true;
      const currentEncounter = rec.bossEncounters[rec.bossEncounters.length - 1];
      if (currentEncounter) {
        currentEncounter.durationSec = dur;
        currentEncounter.outcome = 'boss killed';
      }
      ev(`Boss killed wave ${wave} after ${dur}s`);
    }

    // ── 탄약·점수 추적 ─────────────────────────────
    if (p.ammo < lastAmmo && !p.isFeverActive) {
      rec.shots.ammoDrops += lastAmmo - p.ammo;
    }
    lastAmmo = p.ammo;
    const ids = new Set(s.targets.map((t) => t.id));
    for (const id of prevTargetIds) {
      if (!ids.has(id)) rec.kills += 1;
    }
    prevTargetIds = ids;

    if (p.score !== lastScore) {
      lastScore = p.score;
      lastChangeT = now;
    } else if (now - lastChangeT > 30000) {
      rec.stalls.push({
        wave,
        atSec: Math.round((now - T0) / 1000),
        scoreStuckSec: Math.round((now - lastChangeT) / 1000),
      });
      ev(`STALL: no score change for ${Math.round((now - lastChangeT) / 1000)}s in wave ${wave}`);
      await shot(`stall-wave${wave}-${Math.round((now - T0) / 1000)}s`);
      lastChangeT = now;
    }

    // ── 피버 (더블클릭) ──────────────────────────────
    if (p.isFeverReady && !p.isFeverActive && now - lastFeverT > 1500) {
      lastFeverT = now;
      const tg = s.targets
        .filter((t) => t.landed && !t.isItem && !t.selectKind)
        .sort((a, b) => a.radiusM - b.radiusM)[0];
      const fx = tg ? toScreenX(tg.aimX) : 720;
      const fy = tg ? toScreenY(tg.aimY) : 450;
      await hold(false);
      await page.mouse.move(fx, fy);
      const scoreBefore = p.score;
      await page.mouse.dblclick(fx, fy);
      await sleep(150);
      const s2 = await snap(page);
      if (s2?.players[0].isFeverActive) {
        ev(`Fever activated wave ${wave}`);
        const feverShot = await shot(`wave${wave}-fever-on`);
        feverWatch = {
          wave,
          t: now,
          scoreBefore,
          shotFile: feverShot,
          done: false,
        };
        rec.fever.push({
          wave,
          activatedAtSec: Math.round((now - T0) / 1000),
          scoreBefore,
        });
      } else {
        ev(`Fever double-click did not activate (ready=${p.isFeverReady})`);
      }
    }

    if (feverWatch && !feverWatch.done && now - feverWatch.t >= 2000) {
      feverWatch.done = true;
      const f2 = (await snap(page))?.players[0];
      const gain = f2 ? f2.score - feverWatch.scoreBefore : null;
      const last = rec.fever[rec.fever.length - 1];
      if (last) {
        last.scoreAfter2s = f2?.score ?? null;
        last.scoreGainIn2s = gain;
        last.feverStillActive = Boolean(f2?.isFeverActive);
      }
      ev(`Fever +2s: score gain ${gain}, still active ${f2?.isFeverActive}`);
    }

    // ── 스킬 (우클릭) ─────────────────────────────
    const mons = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isProjectile).length;
    if (p.skillStock > 0 && mons >= 2 && now - lastSkillT > 800) {
      lastSkillT = now;
      const sk = s.targets.find((t) => t.landed) || s.targets[0];
      const sx = sk ? toScreenX(sk.aimX) : 720;
      const sy = sk ? toScreenY(sk.aimY) : 450;
      await hold(false);
      await page.mouse.move(sx, sy);
      await page.mouse.click(sx, sy, { button: 'right' });
      const s3 = await snap(page);
      const used = s3 ? s3.players[0].skillStock < p.skillStock : null;
      rec.skill.push({
        wave,
        stockBefore: p.skillStock,
        stockAfter: s3?.players[0].skillStock ?? null,
        used,
      });
      if (rec.skill.length === 1) {
        await shot(`wave${wave}-skill-first`);
      }
    }

    // ── 일반 사격: 착지 표적 조준 (minions-first: 보스전은 부하 먼저) ──────────────
    let pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.landed);
    if (s.targets.some((t) => t.kind === 'boss')) {
      const minions = pool.filter((t) => t.kind !== 'boss');
      const bosses = pool.filter((t) => t.kind === 'boss');
      pool = minions.length ? minions : bosses;
    }
    if (pool.length === 0) {
      pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding);
    }

    if (pool.length) {
      const near = [...pool].sort((a, b) => a.radiusM - b.radiusM)[0];
      const tx = toScreenX(near.aimX);
      const ty = toScreenY(near.aimY);
      await page.mouse.move(tx, ty);

      if (p.ammo > 0 || p.isFeverActive) {
        await hold(true);
      } else {
        await hold(false);
      }
    } else {
      await hold(false);
      await page.mouse.move(720, 450);
    }

    await sleep(15);
  }
} catch (err) {
  ev(`LOOP ERROR: ${err?.message ?? err}`);
  rec.loopError = String(err?.stack ?? err);
}

await hold(false);

if (rec.waves[wave] && rec.waves[wave].endLives === null) {
  rec.waves[wave].endLives = s?.lives ?? null;
  rec.waves[wave].durationSec = Math.round((Date.now() - waveStartT) / 1000);
}

// 결과 화면 처리
await sleep(1500);
const endState = await snap(page);
const resultFile = await shot(`result-${endPhase ?? 'timeout'}`);
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 900));

rec.result = {
  phase: endPhase ?? `NOT_ENDED(${endState?.phase})`,
  finalWave: endState?.wave ?? null,
  finalLives: endState?.lives ?? null,
  finalScore: endState?.players[0].score ?? null,
  durationSec: Math.round((Date.now() - T0) / 1000),
  loops,
  screenshot: resultFile,
  bodyTextSnippet: bodyText,
};
rec.finishedAt = new Date().toISOString();
rec.pageErrors = pageErrors;
rec.consoleErrors = consoleErrors;

const jsonPath = path.join(OUT, `fullplay-${WEAPON}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(rec, null, 2));
log(`DONE: phase=${rec.result.phase} wave=${rec.result.finalWave} lives=${rec.result.finalLives} score=${rec.result.finalScore} pageErr=${pageErrors.length} consoleErr=${consoleErrors.length}`);
log(`Saved json record to ${jsonPath}`);

await browser.close();
