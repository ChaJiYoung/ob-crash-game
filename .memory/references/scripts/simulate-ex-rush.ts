// EX 무한 러시 사전 시뮬레이션 (구현 전 프로토타입).
// 실제 엔진(BeerCrusherEngine)을 쓰되, EX 규칙(러시 할당량·DANGER 배율·보스 난입)은 이 스크립트가 런타임에 흉내 낸다.
// 결정: .memory/decisions/2026-11-17-ex-endless-waves.md
// Usage: npx tsx .memory/references/scripts/simulate-ex-rush.ts 30 [shotgun|revolver|gatling|all] [봇이름 일부]
// NOSKILL=1 / NOFEVER=1: 봇이 스킬·피버를 쓰지 않음(원인 분리용).
// 빠른 실험: EX='{"quota":{"base":15,"perDanger":4},"hp":{"start":1.2}}' (아래 EX 기본값에 깊은 병합)
import { BeerCrusherEngine } from '../../../src/pc/engine/BeerCrusherEngine';
import { TARGET_SPECS, WEAPON_ARCHETYPE_SPECS } from '../../../src/shared/constants';
import { GAME_TUNING } from '../../../src/shared/gameTuning';

const EX: any = {
  rushDurationMs: 10000,
  rushesPerDanger: 3,
  quota: { base: 20, perDanger: 5 },
  speed: { start: 1.5, perDangerMult: 1.1, max: 2.0 },
  hp: { start: 1.5, perDangerMult: 1.1 },
  themeShare: 0.5,
  chalangShare: 0.1,
  /** 일반 몬스터 필드 상한(없으면 무제한). 걸리면 대기, 남은 몬스터는 다음 러시 앞으로 넘긴다. */
  fieldCap: undefined as number | undefined,
  boss: { intervalMs: 60000, coolerHp: 150, kingHp: 250, hpGrowth: 1.1 },
};
const deepMerge = (t: any, p: any): void => {
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) deepMerge(t[k], v);
    else t[k] = v;
  }
};
if (process.env.EX) deepMerge(EX, JSON.parse(process.env.EX));
// WEAPON4='{"revolver":{"pierceCount":1}}': Lv.4 무기 수치를 런타임에 덮어쓴다(EX는 항상 Lv.4).
if (process.env.WEAPON4) for (const [k, v] of Object.entries(JSON.parse(process.env.WEAPON4))) Object.assign((WEAPON_ARCHETYPE_SPECS as any)[k].levels[4], v);

const THEMES: Record<string, string> = { charge: 'pilgood', air: 'caslight', shield: 'obi', dive: 'chalang', blast: 'hanmac', split: 'bottle' };
const KINDS = Object.values(THEMES);
const BASE_BLAST = GAME_TUNING.monsters.hanmac.blastDamage;
const MAX_EX_MS = 6 * 60 * 1000;

const danger = (ms: number) => Math.floor(ms / (EX.rushDurationMs * EX.rushesPerDanger)) + 1;
const quota = (d: number) => EX.quota.base + EX.quota.perDanger * (d - 1);
const speedMult = (d: number) => Math.min(EX.speed.max, EX.speed.start * EX.speed.perDangerMult ** (d - 1));
const hpMult = (d: number) => EX.hp.start * EX.hp.perDangerMult ** (d - 1);

function buildQueue(theme: string, q: number): string[] {
  const main = THEMES[theme];
  const themeN = Math.round(q * EX.themeShare);
  const chalangN = theme === 'dive' ? 0 : Math.round(q * EX.chalangShare);
  const others = KINDS.filter((k) => k !== main && k !== 'chalang');
  const out: string[] = [];
  for (let i = 0; i < themeN; i++) out.push(main);
  for (let i = 0; i < chalangN; i++) out.push('chalang');
  while (out.length < q) out.push(others[Math.floor(Math.random() * others.length)]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Bot { name: string; mode: 'chase' | 'sweepMon' | 'sweep'; tap?: number; hold?: boolean; k?: number; w?: number }
const BOTS: Bot[] = [
  { name: '정확(탭)', mode: 'chase', tap: 150, k: 6, w: 0.02 },
  { name: '보통(탭)', mode: 'chase', tap: 150, k: 3, w: 0.06 },
  { name: '부정확(탭)', mode: 'chase', tap: 150, k: 2, w: 0.14 },
  { name: '따라가며(누름)', mode: 'chase', hold: true, k: 3, w: 0.1 },
  { name: '몬스터쪽훑기(누름)', mode: 'sweepMon', hold: true },
];
const WEAPONS = ['shotgun', 'revolver', 'gatling'] as const;

interface Result { carried: number; exSec: number; danger: number; bossesSpawned: number; bossesKilled: number; maxField: number; exScore: number; killedBy: string; timedOut: boolean; spawned: number }

function play(kind: (typeof WEAPONS)[number], bot: Bot): Result {
  const e: any = new BeerCrusherEngine();
  e.aspect = 16 / 9;
  e.startGame({ withWeaponSelect: false });
  e.getPlayer(0).weaponSystem.selectWeapon(kind, 1);
  e.currentWave = 7;
  // 강화 MAX(D04)
  const p = e.getPlayer(0);
  const c = GAME_TUNING.cards;
  const apply = (k: string, cond: () => boolean) => { for (let i = 0; i < 10 && cond(); i++) e.applyRewardCard(k, 0, 0); };
  apply('weapon_level_up', () => p.weaponSystem.getState().weaponLevel < 4);
  apply('rapid_reload', () => p.weaponSystem.getRapidReloadStacks() < c.rapidReloadMaxStacks);
  apply('lucky_drop', () => p.luckyDropStacks < c.luckyDropMaxStacks);
  apply('damage_up', () => p.cardStacks.damage_up < c.damageUp.maxStacks);
  apply('skill_cooldown', () => p.cardStacks.skill_cooldown < c.skillCooldown.maxStacks);
  apply('fever_extend', () => p.cardStacks.fever_extend < c.feverExtend.maxStacks);
  apply('hit_zone_up', () => p.cardStacks.hit_zone_up < c.hitZoneUp.maxStacks);
  p.weaponSystem.refillSkillInstant?.();

  // 엔진 패치: 본편 웨이브 스폰·보스 클리어 연출·중간 카드 끄기
  Object.defineProperty(e, 'modeRules', { get: () => ({ ...GAME_TUNING.modeRules.game, waveSpawning: false }) });
  e.startBossClearSequence = () => {};
  e.getCardKillTarget = () => null;

  const ws = p.weaponSystem;
  const sm = p.scoreManager;
  const scoreAtStart = sm.getState().totalScore;
  let now = 1000;
  const dt = 1000 / 60;
  let ex = 0;
  let rushIdx = -1;
  let theme = '';
  let queue: string[] = [];
  let spawned = 0;
  let totalSpawned = 0;
  let carried = 0;
  let bosses = 0;
  let bossKills = 0;
  let maxField = 0;
  let lastLives = e.lives;
  let killedBy = '';
  let tSec = Math.random() * 6;
  const st = { lastTap: 0, sx: 0, sd: 1, cx: 0, cy: 0 };
  let prevBossIds = new Set<string>();

  const spawnKind = (k: string, d: number) => {
    e.spawnNextTarget({ kinds: [k] }, now);
    const t = e.activeTargets[e.activeTargets.length - 1];
    const spec = (TARGET_SPECS as any)[k];
    t.maxHp = t.hp = Number((spec.maxHp * hpMult(d)).toFixed(3));
    t.speedMps = spec.speedMps * speedMult(d);
    totalSpawned++;
  };

  while (e.gamePhase === 'PLAYING' && ex < MAX_EX_MS) {
    // EX 시계와 러시
    ex += dt;
    const d = danger(ex);
    const ri = Math.floor(ex / EX.rushDurationMs);
    const fieldNow = () => e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && t.kind !== 'boss').length;
    const CAP = EX.fieldCap ?? Infinity;
    if (ri !== rushIdx) {
      const leftover = queue.slice(spawned);
      if (CAP === Infinity) { while (spawned < queue.length) spawnKind(queue[spawned++], danger(ex - dt)); leftover.length = 0; }
      carried += leftover.length;
      rushIdx = ri;
      const pool = Object.keys(THEMES).filter((x) => x !== theme);
      theme = ri === 0 ? 'dive' : pool[Math.floor(Math.random() * pool.length)];
      queue = [...leftover, ...buildQueue(theme, quota(d))];
      spawned = 0;
    }
    const interval = EX.rushDurationMs / queue.length;
    const inRush = ex - ri * EX.rushDurationMs;
    while (spawned < queue.length && inRush >= spawned * interval && fieldNow() < CAP) spawnKind(queue[spawned++], d);
    (GAME_TUNING.monsters.hanmac as any).blastDamage = BASE_BLAST * hpMult(d);

    // 보스 난입
    while (bosses < Math.floor(ex / EX.boss.intervalMs)) {
      bosses++;
      const isKing = bosses % 2 === 0;
      const hp = Number(((isKing ? EX.boss.kingHp : EX.boss.coolerHp) * EX.boss.hpGrowth ** (bosses - 1)).toFixed(3));
      const w = e.waveDefinitions[7];
      const saved = w.boss;
      w.boss = { coolerHp: isKing ? [] : [hp], kingHp: isKing ? hp : null, summonKinds: [] };
      e.spawnBossEncounter(now);
      w.boss = saved;
      e.isBossEncounterActive = false;
      const nb = e.activeTargets[e.activeTargets.length - 1];
      const others = e.getBossEntities().filter((b: any) => b !== nb).length;
      const s = GAME_TUNING.boss.coolerSpreadRad;
      const theta = [0, -s, s, -2 * s, 2 * s][others % 5];
      nb.thetaRad = nb.initialThetaRad = nb.bossBaseThetaRad = theta;
    }

    e.update(now, dt / 1000);
    // 보스 포탄(본편 update는 waveSpawning=false라 쏘지 않으므로 여기서)
    const bs = e.getBossEntities();
    if (bs.length && now - e.lastBossProjectileMs >= e.getBossShellIntervalMs(now)) {
      const sh = bs[e.bossShooterIndex % bs.length];
      e.bossShooterIndex++;
      e.lastBossProjectileMs = now;
      e.spawnMonsterProjectile(now, 'boss', { thetaRad: sh.thetaRad, radiusM: sh.radiusM });
    }
    const ids = new Set<string>(bs.map((b: any) => b.id));
    for (const id of prevBossIds) if (!ids.has(id)) bossKills++;
    prevBossIds = ids;

    const monsters = e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);
    maxField = Math.max(maxField, monsters.filter((t: any) => t.kind !== 'boss').length);
    if (e.lives < lastLives) killedBy = theme;
    lastLives = e.lives;
    if (e.gamePhase !== 'PLAYING') break;

    // 봇 (simulate-current-decisions.ts와 같은 조준 모델)
    const fs = sm.getState();
    if (!process.env.NOFEVER && fs.isFeverReady && !fs.isFeverActive) e.activateFever(now);
    if (!process.env.NOSKILL && ws.getState().skillStock > 0 && monsters.length >= 2) e.triggerWeaponSkill(now);
    tSec += dt / 1000;
    const isFever = sm.getState().isFeverActive;
    const source = isFever ? 'fever' : bot.hold ? 'hold' : 'press';
    const shoot = (ax: number, ay: number) => {
      if (bot.tap && !isFever) {
        if (now - st.lastTap < bot.tap) return;
        st.lastTap = now;
      }
      e.shootAt(ax, ay, now, source);
    };
    const vulnerable = (t: any) => !t.isGuarding && !t.isShielded && e.isTargetLanded(t, now) && e.isTargetable(t, now);
    const visible = e.activeTargets.filter((t: any) => !t.isItem && !t.rewardCardKind);
    const pos = visible.map((t: any) => {
      const q = e.computeTargetAimCoords(t);
      return { x: q.targetNormX, y: q.targetNormY, r: t.radiusM, ok: vulnerable(t) };
    });
    const meanY = pos.length ? pos.reduce((a: number, q: any) => a + q.y, 0) / pos.length : 0;
    if (bot.mode === 'sweep') shoot(0.75 * Math.sin(tSec * 1.6), meanY);
    else if (bot.mode === 'sweepMon') {
      if (pos.length) {
        const lo = Math.min(...pos.map((q: any) => q.x)) - 0.08;
        const hi = Math.max(...pos.map((q: any) => q.x)) + 0.08;
        st.sx += st.sd * 1.6 * dt / 1000;
        if (st.sx > hi) { st.sx = hi; st.sd = -1; }
        if (st.sx < lo) { st.sx = lo; st.sd = 1; }
      }
      shoot(st.sx, meanY);
    } else {
      const pool = pos.filter((q: any) => q.ok);
      const list = pool.length ? pool : pos;
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
  (GAME_TUNING.monsters.hanmac as any).blastDamage = BASE_BLAST;
  return {
    exSec: ex / 1000, danger: danger(ex), bossesSpawned: bosses, bossesKilled: bossKills, maxField,
    exScore: sm.getState().totalScore - scoreAtStart, killedBy, timedOut: ex >= MAX_EX_MS, spawned: totalSpawned, carried,
  };
}

const N = +(process.argv[2] || 30);
const onlyWeapon = process.argv[3];
const onlyBot = process.argv[4];
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

console.log(`EX 시뮬레이션 N=${N}  EX=${JSON.stringify(EX)}`);
console.log('무기\t봇\t생존 평균(초)\t중앙\t상위10%\tDANGER 평균\t최고\t보스 처치/등장\t필드 최대\tEX 점수\t6분 생존\t넘긴 몬스터');
for (const w of WEAPONS) {
  if (onlyWeapon && onlyWeapon !== 'all' && onlyWeapon !== w) continue;
  for (const b of BOTS) {
    if (onlyBot && !b.name.includes(onlyBot)) continue;
    const rs = Array.from({ length: N }, () => play(w, b));
    const secs = rs.map((r) => r.exSec);
    console.log([
      w, b.name, avg(secs).toFixed(0), pct(secs, 0.5).toFixed(0), pct(secs, 0.9).toFixed(0),
      avg(rs.map((r) => r.danger)).toFixed(1), Math.max(...rs.map((r) => r.danger)),
      `${avg(rs.map((r) => r.bossesKilled)).toFixed(1)}/${avg(rs.map((r) => r.bossesSpawned)).toFixed(1)}`,
      Math.max(...rs.map((r) => r.maxField)), avg(rs.map((r) => r.exScore)).toFixed(0),
      `${rs.filter((r) => r.timedOut).length}/${N}`, avg(rs.map((r) => r.carried)).toFixed(0),
    ].join('\t'));
  }
}
