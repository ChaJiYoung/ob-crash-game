// QA-D 풀플레이(마우스 1인): 실제 브라우저 입력만 사용한다(엔진 직접 조작 없음).
//  - 조준: snapshot().targets의 aimX/aimY를 화면 좌표로 바꿔 mouse.move (aimMapping 역변환)
//  - 사격: 누른 채 유지(홀드 연사). 카드 선택 때만 mouse.up 후 클릭
//  - 스킬: 우클릭, 피버: 더블클릭
//  - 봇 전략: 가장 가까운 착지 표적, 보스전은 부하 먼저, 카드는 weapon_level_up 우선(boss-strategy-compare의 minions-first와 같은 규칙)
// 사용: node fullplay-mouse.mjs <shotgun|revolver|gatling> [limitMin=20]
import fs from 'node:fs';
import path from 'node:path';
import { launch, snap, sleep, toScreenX, toScreenY, overflowScan, VW, VH } from './lib-d.mjs';
import { enterCombat } from './lib-d.mjs';

const OUT = path.resolve(import.meta.dirname, '..');
const WEAPON = process.argv[2] || 'shotgun';
const LIMIT_MS = Number(process.argv[3] || 20) * 60 * 1000;
const tag = VW === 1440 && VH === 900 ? `fullplay-${WEAPON}` : `fullplay-${WEAPON}-${VW}x${VH}`;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] [${WEAPON}]`, ...a);

const { browser, page, pageErrors, consoleErrors } = await launch();
const shot = async (name) => {
  const f = `${tag}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, f) });
  return f;
};

const rec = {
  weapon: WEAPON,
  renderer: 'chromium headless, --use-angle=metal (see report: swiftshader was 0.3fps)',
  startedAt: new Date().toISOString(),
  pick: null,
  waves: {},
  events: [],
  cardRounds: [],
  bossEncounters: [],
  fever: [],
  skill: [],
  stalls: [],
  hudBlocks: { checks: 0, blocked: 0, samples: [] },
  shots: { ammoDrops: 0 },
  viewport: `${VW}x${VH}`,
  overflow: {},
  kills: 0,
  result: null,
  pageErrors,
  consoleErrors,
};
const ev = (msg) => {
  rec.events.push({ t: Math.round((Date.now() - T0) / 1000), msg });
  log(msg);
};

rec.pick = await enterCombat(page, { nickname: `QA-D-${WEAPON.toUpperCase()}`, weapon: WEAPON, shot: null });
ev(`picked weapon: ${rec.pick}`);
await shot('01-combat-start');
rec.overflow.combatStart = await overflowScan(page);

let holding = false;
const hold = async (on) => {
  if (on && !holding) { await page.mouse.down(); holding = true; }
  if (!on && holding) { await page.mouse.up(); holding = false; }
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
rec.waves[wave] = { wave, startT: Math.round((Date.now() - T0) / 1000), startLives: s.lives, endLives: null, durationSec: null, bossSpawned: false, bossKilled: false, cardRounds: 0 };
let waveStartT = Date.now();
let endPhase = null;

try {
  while (Date.now() - T0 < LIMIT_MS) {
    s = await snap(page);
    if (!s) { await sleep(50); continue; }
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
        if (!rec.overflow.cards) rec.overflow.cards = await overflowScan(page);
        cardRound = { wave: s.wave, offered: cards.map((c) => c.selectValue), chosen: null, screenshot: f, t: Math.round((now - T0) / 1000) };
        if (rec.waves[s.wave]) rec.waves[s.wave].cardRounds += 1;
        ev(`card round wave ${s.wave}: offered ${cards.map((c) => c.selectValue).join(', ')}`);
      }
      if (cards.length) {
        const c = cards.find((x) => x.selectValue === 'weapon_level_up') || cards[0];
        const cx = toScreenX(c.aimX), cy = toScreenY(c.aimY);
        await page.mouse.move(cx, cy);
        await sleep(60);
        await page.mouse.click(cx, cy);
        if (cardRound) { cardRound.chosen = c.selectValue; rec.cardRounds.push(cardRound); cardRound = null; }
        ev(`picked card ${c.selectValue}`);
        await sleep(500); // 카드 선택 직후 스킬 잠금(D27) 지나도록
      }
      continue;
    }
    cardOpen = false;

    // ── 웨이브 전환 ─────────────────────────────────
    if (s.wave !== wave) {
      await hold(false);
      const w = rec.waves[wave];
      if (w) { w.endLives = s.lives; w.durationSec = Math.round((now - waveStartT) / 1000); }
      ev(`wave ${wave} -> ${s.wave} (lives ${s.lives}, score ${p.score})`);
      wave = s.wave;
      waveStartT = now;
      rec.waves[wave] = { wave, startT: Math.round((now - T0) / 1000), startLives: s.lives, endLives: null, durationSec: null, bossSpawned: false, bossKilled: false, cardRounds: 0 };
      await shot(`wave${wave}-start`);
      lastChangeT = now;
    }

    if (s.phase !== 'PLAYING') { await sleep(50); continue; }

    // ── 보스 조우 ────────────────────────────────────
    const boss = s.targets.find((t) => t.kind === 'boss');
    if (boss && !bossActive) {
      bossActive = true;
      bossStartT = now;
      if (rec.waves[wave]) rec.waves[wave].bossSpawned = true;
      ev(`boss spawned wave ${wave}, maxHp ${boss.maxHp}`);
      await shot(`wave${wave}-boss-spawn`);
    } else if (!boss && bossActive) {
      bossActive = false;
      const dur = Math.round((now - bossStartT) / 1000);
      if (rec.waves[wave]) rec.waves[wave].bossKilled = true;
      rec.bossEncounters.push({ wave, durationSec: dur, outcome: 'boss gone (killed or wave ended)' });
      ev(`boss gone wave ${wave} after ${dur}s`);
    }

    // ── 탄약·점수 추적 ─────────────────────────────
    if (p.ammo < lastAmmo && !p.isFeverActive) rec.shots.ammoDrops += lastAmmo - p.ammo;
    lastAmmo = p.ammo;
    const ids = new Set(s.targets.map((t) => t.id));
    // 사라진 표적 = 처치 또는 도달(엔진 스냅샷만으로는 구분 불가): 처치 추정치로만 쓴다
    for (const id of prevTargetIds) if (!ids.has(id)) rec.kills += 1;
    prevTargetIds = ids;
    if (p.score !== lastScore) { lastScore = p.score; lastChangeT = now; }
    else if (now - lastChangeT > 30000) {
      rec.stalls.push({ wave, atSec: Math.round((now - T0) / 1000), scoreStuckSec: Math.round((now - lastChangeT) / 1000) });
      ev(`STALL: no score change for ${Math.round((now - lastChangeT) / 1000)}s in wave ${wave}`);
      await shot(`stall-wave${wave}-${Math.round((now - T0) / 1000)}s`);
      lastChangeT = now;
    }

    // ── 피버 ──────────────────────────────────────
    if (p.isFeverReady && !p.isFeverActive && now - lastFeverT > 1500) {
      lastFeverT = now;
      const tg = s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
      const fx = tg ? toScreenX(tg.aimX) : 720, fy = tg ? toScreenY(tg.aimY) : 450;
      await hold(false);
      await page.mouse.move(fx, fy);
      const scoreBefore = p.score;
      await page.mouse.dblclick(fx, fy);
      await sleep(150);
      const s2 = await snap(page);
      if (s2?.players[0].isFeverActive) {
        ev(`fever activated wave ${wave}`);
        feverWatch = { wave, t: now, scoreBefore, shotFile: await shot(`wave${wave}-fever-on`), done: false };
        rec.fever.push({ wave, activatedAtSec: Math.round((now - T0) / 1000), scoreBefore });
      } else {
        ev(`fever double-click did not activate (ready=${p.isFeverReady})`);
      }
    }
    if (feverWatch && !feverWatch.done && now - feverWatch.t >= 2000) {
      feverWatch.done = true;
      const f2 = (await snap(page))?.players[0];
      const gain = f2 ? f2.score - feverWatch.scoreBefore : null;
      const last = rec.fever[rec.fever.length - 1];
      last.scoreAfter2s = f2?.score ?? null;
      last.scoreGainIn2s = gain;
      last.feverStillActive = Boolean(f2?.isFeverActive);
      ev(`fever +2s: score gain ${gain}, still active ${f2?.isFeverActive}`);
    }

    // ── 스킬 (우클릭) ─────────────────────────────
    const mons = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isProjectile).length;
    if (p.skillStock > 0 && mons >= 2 && now - lastSkillT > 800) {
      lastSkillT = now;
      const sk = s.targets.find((t) => t.landed) || s.targets[0];
      const sx = sk ? toScreenX(sk.aimX) : 720, sy = sk ? toScreenY(sk.aimY) : 450;
      await hold(false);
      await page.mouse.move(sx, sy);
      await page.mouse.click(sx, sy, { button: 'right' });
      const s3 = await snap(page);
      const used = s3 ? s3.players[0].skillStock < p.skillStock : null;
      rec.skill.push({ wave, stockBefore: p.skillStock, stockAfter: s3?.players[0].skillStock ?? null, used });
      if (rec.skill.length === 1) await shot(`wave${wave}-skill-first`);
    }

    // ── 일반 사격: 가장 가까운 착지 표적 ──────────────
    let pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.landed);
    if (s.targets.some((t) => t.kind === 'boss')) {
      const others = pool.filter((t) => t.kind !== 'boss');
      const bosses = pool.filter((t) => t.kind === 'boss');
      pool = others.length ? others : bosses;
    }
    if (pool.length === 0) pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding);
    if (pool.length) {
      const near = [...pool].sort((a, b) => a.radiusM - b.radiusM)[0];
      const tx = toScreenX(near.aimX), ty = toScreenY(near.aimY);
      await page.mouse.move(tx, ty);
      // 10번째 루프마다 조준 지점이 HUD·버튼에 가려지는지 확인(elementFromPoint)
      if (loops % 10 === 0) {
        const info = await page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return { tag: null };
          const canvasLike = el.tagName === 'CANVAS';
          return { tag: el.tagName, cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 80), canvas: canvasLike, text: (el.textContent || '').trim().slice(0, 30) };
        }, [tx, ty]);
        rec.hudBlocks.checks += 1;
        if (!info.canvas) {
          rec.hudBlocks.blocked += 1;
          if (rec.hudBlocks.samples.length < 20) rec.hudBlocks.samples.push({ wave, x: tx, y: ty, ...info });
        }
      }
      if (p.ammo > 0 || p.isFeverActive) await hold(true);
      else await hold(false);
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

// 결과 화면
await sleep(1200);
const endState = await snap(page);
const resultFile = await shot(`result-${endPhase ?? 'timeout'}`);
rec.overflow.result = await overflowScan(page);
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
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rec, null, 2));
log(`DONE phase=${rec.result.phase} wave=${rec.result.finalWave} lives=${rec.result.finalLives} score=${rec.result.finalScore} pageErr=${pageErrors.length} consoleErr=${consoleErrors.length}`);
await browser.close();
