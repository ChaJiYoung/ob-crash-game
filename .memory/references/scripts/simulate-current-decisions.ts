// Balance simulation against the REAL engine (no runtime patches).
// Usage: npx tsx .memory/references/scripts/simulate-current-decisions.ts 60 [weapon] [bot-name-substring]
// All difficulty numbers come from src/shared/gameTuning.ts; edit them there and re-run.
import { BeerCrusherEngine } from '../../../src/pc/engine/BeerCrusherEngine';
import { JUDGMENT_SPECS, WEAPON_CONSTANTS } from '../../../src/shared/constants';
import { GAME_TUNING } from '../../../src/shared/gameTuning';

// Quick what-if runs without editing gameTuning.ts: TUNE='{"monsters":{"pilgood":{"chargeSpeedMult":1.5}}}'
// (deep merge, arrays are replaced; weapon table values are computed at import time, so edit gameTuning.ts for those)
const deepMerge = (target: any, patch: any): void => {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) deepMerge(target[key], value);
    else target[key] = value;
  }
};
if (process.env.TUNE) deepMerge(GAME_TUNING, JSON.parse(process.env.TUNE));
// JUDGE='{"perfectMaxError":0.15,"perfectScore":300,"perfectDamage":1.5}' mutates the judgment table at runtime
if (process.env.JUDGE) {
  const j = JSON.parse(process.env.JUDGE);
  if (j.perfectMaxError !== undefined) JUDGMENT_SPECS.PERFECT.maxErrorRatio = j.perfectMaxError;
  if (j.perfectScore !== undefined) JUDGMENT_SPECS.PERFECT.baseScore = j.perfectScore;
  if (j.perfectDamage !== undefined) JUDGMENT_SPECS.PERFECT.damageMultiplier = j.perfectDamage;
  if (j.greatMaxError !== undefined) JUDGMENT_SPECS.GREAT.maxErrorRatio = j.greatMaxError;
}
// BOSS_HP="40,35,45,110" -> wave 3 cooler, wave 5 coolers, wave 7 coolers, wave 7 king
if (process.env.BOSS_HP) {
  const [h3, h5, h7, hk] = process.env.BOSS_HP.split(',').map(Number);
  const w = GAME_TUNING.waves as any;
  w[2].boss.coolerHp = [h3];
  w[4].boss.coolerHp = [h5, h5];
  w[6].boss.coolerHp = [h7, h7];
  w[6].boss.kingHp = hk;
}

const WEAPONS = ['shotgun', 'revolver', 'gatling'] as const;
const MAX_GAME_MS = 6 * 60 * 1000;

interface Bot {
  name: string;
  mode: 'chase' | 'sweepMon' | 'sweep';
  tap?: number; // minimum ms between taps (press shots)
  hold?: boolean; // hold the trigger (hold shots)
  k?: number; // chase speed
  w?: number; // wobble amplitude (aim units)
}

const BOTS: Bot[] = [
  { name: '정확(탭)', mode: 'chase', tap: 150, k: 6, w: 0.02 },
  { name: '보통(탭)', mode: 'chase', tap: 150, k: 3, w: 0.06 },
  { name: '부정확(탭)', mode: 'chase', tap: 150, k: 2, w: 0.14 },
  { name: '아주부정확(탭)', mode: 'chase', tap: 150, k: 1.5, w: 0.25 },
  { name: '따라가며(누름)', mode: 'chase', hold: true, k: 3, w: 0.1 },
  { name: '몬스터쪽훑기(누름)', mode: 'sweepMon', hold: true },
  { name: '화면전체훑기(누름)', mode: 'sweep', hold: true },
];

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

interface GameResult {
  result: string;
  dur: number;
  lives: number;
  cards: number;
  fevers: number;
  skills: number;
  maxWave: number | null;
  gapSum: number;
  gapN: number;
  bossDur: Record<number, number>;
  timedOut: boolean;
  endWave: number;
  score: number;
  maxCombo: number;
  hits: number;
  grades: Record<string, number>;
  breakdown: { total: number; timeBonus: number; precisionBonus: number; base: number };
}

function play(kind: (typeof WEAPONS)[number], bot: Bot): GameResult {
  const e: any = new BeerCrusherEngine();
  e.aspect = 16 / 9;
  e.startGame({ withWeaponSelect: false });
  e.weaponSystem.selectWeapon(kind, 1);
  if (process.env.INVINCIBLE) e.lives = e.maxLives = 999; // score-vs-skill measurement: everyone finishes the game
  const ws = e.weaponSystem;
  const sm = e.scoreManager;

  const st = {
    cards: 0, fevers: 0, skills: 0, maxWave: null as number | null,
    gapSum: 0, gapN: 0, lastReady: null as number | null, prevReady: false,
    bossStart: 0, bossWave: 0, bossDur: {} as Record<number, number>,
    hits: 0, grades: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, BLOCK: 0 } as Record<string, number>, lastTap: 0, sx: 0, sd: 1, cx: 0, cy: 0,
  };

  let now = 1000;
  const dt = 1000 / 60;
  let tSec = Math.random() * 6;

  const pickCard = () => {
    const cards = e.activeTargets.filter((t: any) => t.rewardCardKind);
    if (cards.length === 0 || now - e.rewardCardsSpawnTimeMs < 850) return;
    // Prefer the weapon level-up card, otherwise a random one; picked with a real fresh press
    const target = cards.find((c: any) => c.rewardCardKind === 'weapon_level_up') ?? cards[Math.floor(Math.random() * cards.length)];
    const p = e.computeTargetAimCoords(target);
    const res = e.shootAt(p.targetNormX, p.targetNormY, now, 'press');
    if (res.selectedCard) {
      st.cards++;
      if (ws.getState().weaponLevel === 4 && st.maxWave === null) st.maxWave = e.currentWave;
    }
  };

  while (e.gamePhase === 'PLAYING' && now < MAX_GAME_MS) {
    e.update(now, dt / 1000);
    if (e.gamePhase !== 'PLAYING') break;

    // Boss fight timing
    if (e.isBossEncounterActive && st.bossWave === 0) {
      st.bossWave = e.currentWave;
      st.bossStart = now;
    } else if (!e.isBossEncounterActive && st.bossWave !== 0) {
      st.bossDur[st.bossWave] = (now - st.bossStart) / 1000;
      st.bossWave = 0;
    }

    if (e.isCardSelectPending) {
      pickCard();
      now += dt;
      continue;
    }

    const fs = sm.getState();
    if (fs.isFeverReady && !fs.isFeverActive) {
      if (!st.prevReady) {
        const t = now / 1000;
        if (st.lastReady !== null) {
          st.gapSum += t - st.lastReady;
          st.gapN++;
        }
        st.lastReady = t;
        st.prevReady = true;
      }
      if (e.activateFever(now)) {
        st.fevers++;
        st.prevReady = false;
      }
    }

    const monsters = e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);
    if (ws.getState().skillStock > 0 && monsters.length >= 2) {
      const r = e.triggerWeaponSkill(now);
      if (r.activated) st.skills++;
    }

    tSec += dt / 1000;
    const isFever = sm.getState().isFeverActive;
    const source = isFever ? 'fever' : bot.hold ? 'hold' : 'press';

    const shoot = (ax: number, ay: number) => {
      if (bot.tap && !isFever) {
        if (now - st.lastTap < bot.tap) return;
        st.lastTap = now;
      }
      const r = e.shootAt(ax, ay, now, source);
      if (r.fired) st.grades[r.shieldBlocked ? 'BLOCK' : r.grade]++;
      if (r.fired && r.grade !== 'MISS' && !r.shieldBlocked) st.hits++;
    };

    // A real player sees raised shields: skip targets that cannot be hurt right now
    const vulnerable = (t: any) => !t.isGuarding && !t.isShielded && e.isTargetLanded(t, now);
    const visible = e.activeTargets.filter((t: any) => !t.isItem && !t.rewardCardKind);
    const positions = visible.map((t: any) => {
      const p = e.computeTargetAimCoords(t);
      return { x: p.targetNormX, y: p.targetNormY, r: t.radiusM, ok: vulnerable(t) };
    });
    const meanY = positions.length ? positions.reduce((a: number, p: any) => a + p.y, 0) / positions.length : 0;

    if (bot.mode === 'sweep') {
      shoot(0.75 * Math.sin(tSec * 1.6), meanY);
    } else if (bot.mode === 'sweepMon') {
      if (positions.length) {
        const lo = Math.min(...positions.map((p: any) => p.x)) - 0.08;
        const hi = Math.max(...positions.map((p: any) => p.x)) + 0.08;
        st.sx += st.sd * 1.6 * dt / 1000;
        if (st.sx > hi) { st.sx = hi; st.sd = -1; }
        if (st.sx < lo) { st.sx = lo; st.sd = 1; }
      }
      shoot(st.sx, meanY);
    } else {
      const pool = positions.filter((p: any) => p.ok);
      const list = pool.length ? pool : positions;
      if (list.length) {
        const near = [...list].sort((a: any, b: any) => a.r - b.r)[0];
        const k = Math.min(1, (dt / 1000) * (bot.k ?? 3));
        st.cx += (near.x - st.cx) * k;
        st.cy += (near.y - st.cy) * k;
      }
      const w = bot.w ?? 0.1;
      shoot(st.cx + w * Math.sin(tSec * 5), st.cy + w * 0.8 * Math.sin(tSec * 7.3));
    }

    now += dt;
  }

  // The last boss fight ends the game (VICTORY) before the loop can record it
  if (st.bossWave !== 0) st.bossDur[st.bossWave] = (now - st.bossStart) / 1000;

  return {
    endWave: e.currentWave,
    score: sm.getState().totalScore,
    maxCombo: sm.getState().maxCombo,
    hits: st.hits,
    grades: st.grades,
    breakdown: e.getScoreBreakdown(),
    result: e.gamePhase,
    dur: now / 1000,
    lives: e.lives,
    cards: st.cards,
    fevers: st.fevers,
    skills: st.skills,
    maxWave: st.maxWave,
    gapSum: st.gapSum,
    gapN: st.gapN,
    bossDur: st.bossDur,
    timedOut: now >= MAX_GAME_MS,
  };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, d = 0) => (Number.isNaN(x) ? '-' : x.toFixed(d));
const lossHistogram = (rs: GameResult[]) => {
  const h: Record<number, number> = {};
  rs.filter((r) => r.result !== 'VICTORY').forEach((r) => (h[r.endWave] = (h[r.endWave] ?? 0) + 1));
  return Object.keys(h).length ? Object.entries(h).map(([w, c]) => `${w}:${c}`).join(' ') : '-';
};
const gradeMix = (rs: GameResult[]) => {
  const t: Record<string, number> = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  rs.forEach((r) => Object.keys(t).forEach((k) => (t[k] += r.grades[k])));
  const sum = t.PERFECT + t.GREAT + t.GOOD + t.MISS || 1;
  return ['PERFECT', 'GREAT', 'GOOD', 'MISS'].map((k) => Math.round((100 * t[k]) / sum)).join('/') + `% 발사${Math.round(sum / rs.length)}`;
};
const N = +(process.argv[2] || 40);
const onlyWeapon = process.argv[3];
const onlyBot = process.argv[4];

void WEAPON_CONSTANTS;
for (const k of WEAPONS) {
  if (onlyWeapon && onlyWeapon !== 'all' && onlyWeapon !== k) continue;
  for (const b of BOTS) {
    if (onlyBot && !b.name.includes(onlyBot)) continue;
    const rs = Array.from({ length: N }, () => play(k, b));
    const wins = rs.filter((r) => r.result === 'VICTORY');
    const to = rs.filter((r) => r.timedOut).length;
    const m = (fn: (r: GameResult) => number, d = 0) => f(avg(rs.map(fn)), d);
    const bossAvg = (w: number) => f(avg(rs.filter((r) => r.bossDur[w] !== undefined).map((r) => r.bossDur[w])));
    console.log(
      `${k.padEnd(9)}${b.name.padEnd(16)} 클리어 ${f((100 * wins.length) / N).padStart(3)}%${to ? `(초과${f((100 * to) / N)})` : ''}` +
        ` | 승리체력 ${wins.length ? f(avg(wins.map((r) => r.lives)), 1) : '-'} | ${m((r) => r.dur)}s` +
        ` | 점수 클리어 ${wins.length ? f(avg(wins.map((r) => r.score))) : '-'} / 전체 ${m((r) => r.score)} (기본 ${m((r) => r.breakdown.base)} + 시간 ${m((r) => r.breakdown.timeBonus)} + 정밀 ${m((r) => r.breakdown.precisionBonus)})` +
        ` | 최대콤보 ${m((r) => r.maxCombo)} 명중 ${m((r) => r.hits)} P/G/g/M ${gradeMix(rs)}` +
        ` | 피버 ${f(avg(rs.filter((r) => r.gapN).map((r) => r.gapSum / r.gapN)))}s간격 | 스킬 ${m((r) => r.skills, 1)}` +
        ` | 카드 ${m((r) => r.cards, 1)} | MAX ${f((100 * rs.filter((r) => r.maxWave !== null).length) / N)}%` +
        ` | 보스 ${bossAvg(3)}/${bossAvg(5)}/${bossAvg(7)}s` +
        ` | 패배웨이브 ${lossHistogram(rs)}`
    );
  }
}
