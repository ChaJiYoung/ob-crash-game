// Per-wave clear time by weapon and bot skill (used to set GAME_TUNING.waves[i].parTimeSec).
// Usage: npx tsx .memory/references/scripts/measure-wave-times.ts [games=30] [weapon|all] [skill-name-substring]
// Everyone is kept alive (lives 999) so every game reaches wave 7; times are game-clock seconds from
// engine.lastWaveClear (card selection and pauses are excluded, as in real scoring).
import { BeerCrusherEngine } from '../../../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../../../src/shared/gameTuning';

const WEAPONS = ['shotgun', 'revolver', 'gatling'] as const;
const SKILLS = [
  { name: '정확', k: 6, w: 0.02 },
  { name: '보통', k: 3, w: 0.06 },
  { name: '부정확', k: 2, w: 0.14 },
];
const MAX_GAME_MS = 8 * 60 * 1000;
const N = +(process.argv[2] || 30);
const onlyWeapon = process.argv[3];
const onlySkill = process.argv[4];

function play(kind: (typeof WEAPONS)[number], k: number, w: number): { times: Record<number, number>; score: number; total: number } {
  const e: any = new BeerCrusherEngine();
  e.aspect = 16 / 9;
  e.startGame({ withWeaponSelect: false });
  e.getPlayer(0).weaponSystem.selectWeapon(kind, 1);
  e.lives = e.maxLives = 999;
  const sm = e.getPlayer(0).scoreManager;
  const times: Record<number, number> = {};
  let now = 1000;
  const dt = 1000 / 60;
  let tSec = Math.random() * 6;
  let cx = 0, cy = 0, lastTap = 0;
  let lastSeen = 0;

  while (e.gamePhase === 'PLAYING' && now < MAX_GAME_MS) {
    e.update(now, dt / 1000);
    if (e.lastWaveClear && e.lastWaveClear.wave !== lastSeen) {
      lastSeen = e.lastWaveClear.wave;
      times[lastSeen] = e.lastWaveClear.seconds;
    }
    if (e.gamePhase !== 'PLAYING') break;
    if (e.isCardSelectPending) {
      const cards = e.activeTargets.filter((t: any) => t.rewardCardKind);
      if (cards.length && now - e.rewardCardsSpawnTimeMs >= 850) {
        const t = cards.find((c: any) => c.rewardCardKind === 'weapon_level_up') ?? cards[Math.floor(Math.random() * cards.length)];
        const p = e.computeTargetAimCoords(t);
        e.shootAt(p.targetNormX, p.targetNormY, now, 'press');
      }
      now += dt;
      continue;
    }
    const fs = sm.getState();
    if (fs.isFeverReady && !fs.isFeverActive) e.activateFever(now);
    const mons = e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);
    if (e.getPlayer(0).weaponSystem.getState().skillStock > 0 && mons.length >= 2) e.triggerWeaponSkill(now);
    tSec += dt / 1000;
    const pos = e.activeTargets
      .filter((t: any) => !t.isItem && !t.rewardCardKind)
      .map((t: any) => {
        const p = e.computeTargetAimCoords(t);
        return { x: p.targetNormX, y: p.targetNormY, r: t.radiusM, ok: !t.isGuarding && !t.isShielded && e.isTargetLanded(t, now) };
      });
    const pool = pos.filter((p: any) => p.ok);
    const list = pool.length ? pool : pos;
    if (list.length) {
      const near = [...list].sort((a: any, b: any) => a.r - b.r)[0];
      const kk = Math.min(1, (dt / 1000) * k);
      cx += (near.x - cx) * kk;
      cy += (near.y - cy) * kk;
    }
    const fever = sm.getState().isFeverActive;
    if (fever || now - lastTap >= 150) {
      lastTap = now;
      e.shootAt(cx + w * Math.sin(tSec * 5), cy + w * 0.8 * Math.sin(tSec * 7.3), now, fever ? 'fever' : 'press');
    }
    now += dt;
  }
  // The last wave ends the game inside a shot, so the loop exits before it can record that clear
  if (e.lastWaveClear && e.lastWaveClear.wave !== lastSeen) times[e.lastWaveClear.wave] = e.lastWaveClear.seconds;
  return { times, score: e.getScoreBreakdown().total, total: now / 1000 };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};
const f = (x: number) => (Number.isNaN(x) ? '  - ' : x.toFixed(0).padStart(4));
const par = (GAME_TUNING.waves as readonly any[]).map((w) => w.parTimeSec);

console.log(`웨이브 클리어 시간(초, 게임 시계). 현재 parTimeSec: ${par.join(' / ')}`);
const byWave: Record<string, number[][]> = {};
for (const kind of WEAPONS) {
  if (onlyWeapon && onlyWeapon !== 'all' && onlyWeapon !== kind) continue;
  for (const sk of SKILLS) {
    if (onlySkill && sk.name !== onlySkill) continue; // exact match: '정확' must not also select '부정확'
    const rs = Array.from({ length: N }, () => play(kind, sk.k, sk.w));
    const perWave = [1, 2, 3, 4, 5, 6, 7].map((w) => rs.map((r) => r.times[w]).filter((x) => x !== undefined));
    (byWave[sk.name] ??= [[], [], [], [], [], [], []]).forEach((arr, i) => arr.push(...perWave[i]));
    console.log(
      `${kind.padEnd(9)}${sk.name.padEnd(4)} 평균 ${perWave.map((a) => f(avg(a))).join('')} | p25 ${perWave.map((a) => f(pct(a, 0.25))).join('')} | p75 ${perWave.map((a) => f(pct(a, 0.75))).join('')} | 점수 ${f(avg(rs.map((r) => r.score)))}`
    );
  }
}
console.log('\n무기 합산 평균(초): W1  W2  W3  W4  W5  W6  W7');
for (const [name, waves] of Object.entries(byWave)) {
  console.log(`${name.padEnd(4)} ${waves.map((a) => f(avg(a))).join('')}`);
}
