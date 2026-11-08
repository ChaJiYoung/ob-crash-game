// 1인 판과 2인 판(같은 무기 두 명 또는 지정 조합)을 같은 정확 봇으로 비교한다.
// Usage: [COOP_BOSS_HP=x COOP_SUMMON=x COOP_SPAWN=y] npx tsx .memory/references/scripts/coop-bot-compare.ts [games=40] [weapon|all|mix|coop]
// 봇 규칙은 boss-strategy-compare.ts의 minions-first와 같다(가장 가까운 표적, 150ms 탭, 피버 즉시, 스킬은 몬스터 2마리 이상일 때).
// 2인 판에서는 플레이어마다 따로 조준·사격하고, 2P는 1P와 다른 표적(가까운 순 두 번째)을 우선한다.
import { BeerCrusherEngine } from '../../../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../../../src/shared/gameTuning';

// 배율 실험: COOP_BOSS_HP=2 COOP_SUMMON=2 COOP_SPAWN=2 COOP_CARD=2 npx tsx ... (값을 주지 않으면 gameTuning 그대로)
const coopRules: any = (GAME_TUNING as any).playerCountRules[2];
if (process.env.COOP_BOSS_HP) coopRules.bossHpMult = +process.env.COOP_BOSS_HP;
if (process.env.COOP_SUMMON) coopRules.summonCountMult = +process.env.COOP_SUMMON;
if (process.env.COOP_SPAWN) coopRules.spawnCountMult = +process.env.COOP_SPAWN;

type Weapon = 'shotgun' | 'revolver' | 'gatling';
const WEAPONS: Weapon[] = ['shotgun', 'revolver', 'gatling'];
const MAX_GAME_MS = 10 * 60 * 1000;
const N = +(process.argv[2] || 40);
const which = process.argv[3] || 'all';

function play(weapons: Weapon[]) {
  const e: any = new BeerCrusherEngine();
  e.aspect = 16 / 9;
  const n = weapons.length as 1 | 2;
  e.startGame({ withWeaponSelect: false, playerCount: n });
  weapons.forEach((w, i) => e.getPlayer(i).weaponSystem.selectWeapon(w, 1));
  let now = 1000;
  const dt = 1000 / 60;
  const aim = weapons.map(() => ({ x: 0, y: 0, lastTap: 0, t: Math.random() * 6 }));

  while (e.gamePhase === 'PLAYING' && now < MAX_GAME_MS) {
    e.update(now, dt / 1000);
    if (e.gamePhase !== 'PLAYING') break;
    if (e.isSelectPending) {
      if (now - e.rewardCardsSpawnTimeMs >= 850) {
        for (let i = 0; i < n; i++) {
          if (e.getPlayer(i).selectionDone) continue;
          const mine = e.activeTargets.filter((t: any) => (t.rewardCardKind || t.weaponSelectKind) && t.ownerIndex === i);
          const c = mine.find((x: any) => x.rewardCardKind === 'weapon_level_up') ?? mine[0];
          if (!c) continue;
          const p = e.computeTargetAimCoords(c, 1, i);
          e.shootAt(p.targetNormX, p.targetNormY, now, 'press', i);
        }
      }
      now += dt;
      continue;
    }
    const pool = e.activeTargets
      .filter((t: any) => !t.isItem && !t.rewardCardKind && !t.weaponSelectKind && !t.isGuarding && e.isTargetLanded(t, now))
      .sort((a: any, b: any) => a.radiusM - b.radiusM);
    const bosses = pool.filter((t: any) => t.kind === 'boss');
    const others = pool.filter((t: any) => t.kind !== 'boss');
    const ordered = e.isBossEncounterActive ? (others.length ? others : bosses) : pool;
    const mons = e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);

    for (let i = 0; i < n; i++) {
      const p = e.getPlayer(i);
      const fs = p.scoreManager.getState();
      if (fs.isFeverReady && !fs.isFeverActive) e.activateFever(now, i);
      if (p.weaponSystem.getState().skillStock > 0 && mons.length >= 2) e.triggerWeaponSkill(now, i);
      const a = aim[i];
      a.t += dt / 1000;
      const target = ordered[Math.min(i, ordered.length - 1)];
      if (target) {
        const pr = e.computeTargetAimCoords(target, 1, i);
        const kk = Math.min(1, (dt / 1000) * 6);
        a.x += (pr.targetNormX - a.x) * kk;
        a.y += (pr.targetNormY - a.y) * kk;
      }
      const fever = p.scoreManager.getState().isFeverActive;
      if (fever || now - a.lastTap >= 150) {
        a.lastTap = now;
        e.shootAt(a.x + 0.02 * Math.sin(a.t * 5), a.y + 0.016 * Math.sin(a.t * 7.3), now, fever ? 'fever' : 'press', i);
      }
    }
    now += dt;
  }
  const scores = weapons.map((_, i) => e.getScoreBreakdown(i).total);
  const firstMonster = null;
  return { win: e.gamePhase === 'VICTORY', wave: e.currentWave, lives: e.lives, dur: now / 1000, scores, timeout: now >= MAX_GAME_MS, firstMonster };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
function report(label: string, weapons: Weapon[]) {
  const rs = Array.from({ length: N }, () => play(weapons));
  const win = (100 * rs.filter((r) => r.win).length) / N;
  const waves = avg(rs.map((r) => r.wave));
  const dur = avg(rs.map((r) => r.dur));
  const per = weapons.map((_, i) => avg(rs.map((r) => r.scores[i])).toFixed(0)).join(' / ');
  const to = rs.filter((r) => r.timeout).length;
  console.log(`${label.padEnd(26)} 클리어 ${win.toFixed(0).padStart(3)}% | 평균 도달 웨이브 ${waves.toFixed(1)} | 평균 ${dur.toFixed(0)}s | 개인 점수 ${per}${to ? ` | 시간초과 ${to}` : ''}`);
}

// 체력 배율 확인(첫 웨이브 첫 몬스터)
{
  for (const n of [1, 2] as const) {
    const e: any = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false, playerCount: n });
    e.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
    e.update(1000, 0.016);
    const m = e.activeTargets.find((t: any) => !t.isItem);
    console.log(`${n}인 규칙: monsterHpMult ${e.rules.monsterHpMult}, bossHpMult ${e.rules.bossHpMult}, summonCountMult ${e.rules.summonCountMult}, spawnCountMult ${e.rules.spawnCountMult}, cardTarget(4) ${e.getCardKillTarget(4)}, 1웨이브 스폰 ${e.getWaveProgress().totalSpawns}, 첫 몬스터 ${m?.kind} maxHp ${m?.maxHp}`);
  }
}

const list: [string, Weapon[]][] = [];
for (const w of WEAPONS) {
  if (which !== 'all' && which !== 'coop' && which !== w) continue;
  if (which !== 'coop') list.push([`1인 ${w}`, [w]]);
  list.push([`2인 ${w}+${w}`, [w, w]]);
}
if (which === 'all' || which === 'mix' || which === 'coop') list.push(['2인 shotgun+gatling', ['shotgun', 'gatling']], ['2인 revolver+gatling', ['revolver', 'gatling']]);
for (const [label, ws] of list) report(label, ws);
