import * as THREE from 'three';
import {
  ActiveBuffState,
  GamePhase,
  ItemBuffKind,
  JudgmentGrade,
  RewardCardKind,
  TargetKind,
  TutorialStep,
  WeaponKind,
  WeaponLevel,
  WeaponLevelSpec,
  PlayRunStats,
} from '../../shared/types';
import {
  ITEM_BUFF_SPECS,
  REWARD_CARD_SPECS,
  STAGE_CONSTANTS,
  TARGET_SPECS,
  WEAPON_ARCHETYPE_SPECS,
} from '../../shared/constants';
import { advanceRadialTarget, computeHorizontalHalfFovRad, sampleFanSpawnPoint } from './FanSpawner';
import { evaluateHitJudgment, HitJudgmentResult } from './HitJudgment';
import { GAME_TUNING } from '../../shared/gameTuning';
import type { ShotSource } from '../../shared/types';
import { ScoreAndFeverManager } from './ScoreAndFeverManager';
import { WeaponSystem } from './WeaponSystem';
import { getTargetBaseY } from '../three/TargetModels3D';

export interface ActiveTargetEntity {
  id: string;
  kind: TargetKind;
  hp: number;
  maxHp: number;
  radiusM: number;
  thetaRad: number;
  x: number;
  z: number;
  speedMps: number;
  hitRadiusM: number;
  killBonusScore: number;
  breached: boolean;
  isItem?: boolean;
  itemKind?: ItemBuffKind;
  customNormY?: number;
  customBaseY?: number;
  initialThetaRad?: number;
  // Hanmac artillery
  // Obi shield / bottle split
  guardPhaseMs?: number;
  isGuarding?: boolean;
  isSplitChild?: boolean;
  modelScaleMult?: number;
  isSummonedMinion?: boolean;
  /** Boss minions fall in from above: untargetable and idle until this game-clock time. */
  dropLandAtMs?: number;
  // Roguelike & Gimmick extensions
  stunUntilMs?: number;
  slowUntilMs?: number;
  slowRatio?: number;
  stuckPlungerCount?: number;
  /** 밀려난 거리만큼 흔들림 위상을 되돌려, 밀어내기가 카스 라이트 좌우 위치를 튀게 하지 않는다. */
  swayPhaseOffsetRad?: number;
  /** 아직 밀려나야 할 거리. 0보다 크면 전진하지 않고 뒤로 미끄러진다. */
  slideRemainingM?: number;
  isGoldenCan?: boolean;
  isProjectile?: boolean;
  weaponSelectKind?: WeaponKind;
  rewardCardKind?: RewardCardKind;
  // Boss encounter
  bossRole?: 'cooler' | 'king';
  bossBaseThetaRad?: number;
}

export interface TargetAimProjection {
  targetNormX: number;
  targetNormY: number;
  apparentHitRadius: number;
}

export type { ShotSource };

export interface EngineShootResult {
  fired: boolean;
  grade: JudgmentGrade;
  target?: ActiveTargetEntity;
  killed?: boolean;
  earnedScore?: number;
  errorRatio?: number;
  activatedItem?: ItemBuffKind;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  hitTargets?: ActiveTargetEntity[];
  selectedWeapon?: WeaponKind;
  selectedCard?: RewardCardKind;
  interceptedProjectile?: boolean;
  goldenCanKilled?: boolean;
  shieldBlocked?: boolean;
}

export interface SkillExecuteResult {
  activated: boolean;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  affectedTargets: ActiveTargetEntity[];
  plungerCount?: number;
  bladeCount?: number;
  foamCount?: number;
}

export interface SkillFoamWave {
  id: string;
  /** 파도 앞면의 거리. */
  radiusM: number;
  /** 지난 프레임의 앞면 거리. 이번 프레임에 앞면이 훑고 지나간 구간만 맞힌다. */
  prevRadiusM: number;
  hitTargetIds: Set<string>;
  damage: number;
  bossDamage: number;
  knockbackM: number;
  slowRatio: number;
  slowMs: number;
  /** 화면에 그릴 거품 수. */
  count: number;
}

export interface SkillBlade {
  id: string;
  thetaRad: number;
  /** 칼날 앞면의 거리. */
  radiusM: number;
  /** 지난 프레임의 앞면 거리. 이번 프레임에 앞면이 훑고 지나간 구간만 맞힌다. */
  prevRadiusM: number;
  /** 남은 타격 수(관통 + 1). 포탄은 줄이지 않는다. */
  hitsLeft: number;
  hitTargetIds: Set<string>;
  /** 시전 시점에 고정한 피해. 날아가는 도중 카드를 받아도 이 칼날의 피해는 바뀌지 않는다. */
  damage: number;
  bossDamage: number;
}

export interface ProjectileLaunchEvent {
  source: 'boss';
  x: number;
  z: number;
  y: number;
}

export type BossClearEvent =
  | { type: 'defeated'; x: number; z: number; y: number }
  | { type: 'cascade'; target: ActiveTargetEntity };

export type SkillHitSource = 'blade' | 'foam' | 'blast';

export interface PassiveCardStack {
  kind: RewardCardKind;
  count: number;
}

export interface HanmacBlastEvent {
  x: number;
  y: number;
  z: number;
}

export interface SkillHitEvent {
  source: SkillHitSource;
  target: ActiveTargetEntity;
  killed: boolean;
}

export interface WaveDefinition {
  waveIndex: number;
  totalSpawns: number;
  maxSimultaneous: number;
  spawnIntervalMs: number;
  /** Par clear time in seconds: the time bonus is full at or under it and reaches 0 at zeroAtParMult x par. */
  parTimeSec: number;
  kinds: TargetKind[];
  allowedItems: ItemBuffKind[];
  boss: { coolerHp: readonly number[]; kingHp: number | null; summonKinds: readonly TargetKind[] } | null;
}

export interface SandboxSpawnOptions {
  stationary?: boolean;
  thetaRad?: number;
  radiusM?: number;
  customNormY?: number;
  customBaseY?: number;
  initialThetaRad?: number;
}

export interface WaveProgressInfo {
  wave: number;
  totalWaves: number;
  killedInWave: number;
  totalSpawns: number;
  remainingInWave: number;
  progressPercent: number;
  cardKillCount: number;
  cardKillTarget: number | null;
  luckyDropMultiplier: number;
}

export class BeerCrusherEngine {
  public gamePhase: GamePhase = 'PAIRING';
  public currentWave = 1;
  public lives: number = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
  public maxLives: number = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
  public activeTargets: ActiveTargetEntity[] = [];

  public isTutorialMode = false;
  public tutorialStep: TutorialStep = 1;
  public tutorialCompleted = false;

  public isSandboxMode = false;
  public infiniteAmmo = false;

  public isPaused = false;

  /** 날아가는 리볼버 칼날. 엔진이 매 프레임 전진시키고 화면은 이 상태를 그린다. */
  public activeSkillBlades: SkillBlade[] = [];

  /** 마지막 보스를 잡은 뒤 연출이 끝나는 게임 시각. 0이면 연출 중이 아니다. */
  private bossClearUntilMs = 0;
  private bossClearNextCascadeMs = 0;
  private bossClearEvents: BossClearEvent[] = [];
  private projectileLaunchEvents: ProjectileLaunchEvent[] = [];
  private pendingHanmacBlasts: { x: number; z: number }[] = [];
  private hanmacBlastEvents: HanmacBlastEvent[] = [];
  public activeSkillFoamWaves: SkillFoamWave[] = [];
  private skillHitEvents: SkillHitEvent[] = [];
  private skillEntityCounter = 0;
  private pausedAtMs: number | null = null;

  public readonly scoreManager = new ScoreAndFeverManager();
  /** Game-clock start of the current wave; null until the wave's first running tick (shifted by freezeTimers). */
  private waveStartMs: number | null = null;
  public waveTimeBonusTotal = 0;
  public lastWaveClear: { wave: number; seconds: number; bonus: number; atMs: number } | null = null;
  private shotStats: Record<'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', number> = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  private precisionBonusApplied = 0;
  private levelBonusApplied = 0;
  public readonly weaponSystem = new WeaponSystem();

  private activeBuffUntilMs: Map<ItemBuffKind, number> = new Map();

  // Roguelike card & item drop state
  public luckyDropStacks = 0;
  public cardKillCount = 0;
  public pendingWaveAdvance = false;
  private waveCardKillTargets: Record<number, number | null> = Object.fromEntries(
    GAME_TUNING.waves.map((w) => [w.waveIndex, w.cardKillTarget])
  );
  public dropRng: () => number = () => Math.random();

  // Boss summon state
  public bossSummonActionUntilMs = 0;
  /** 보스 id별로 지나간 체력 구간 소환 횟수. */
  private bossSummonCrossed: Map<string, number> = new Map();
  public bossWarningUntilMs = 0;
  private bossShooterIndex = 0;

  // Wave definitions
  private waveDefinitions: Record<number, WaveDefinition> = Object.fromEntries(
    GAME_TUNING.waves.map((w) => [
      w.waveIndex,
      {
        waveIndex: w.waveIndex,
        totalSpawns: w.totalSpawns,
        maxSimultaneous: w.maxSimultaneous,
        spawnIntervalMs: w.spawnIntervalMs,
        parTimeSec: w.parTimeSec,
        kinds: [...w.kinds] as TargetKind[],
        allowedItems: [],
        boss: w.boss
          ? {
              coolerHp: w.boss.coolerHp,
              kingHp: w.boss.kingHp,
              summonKinds: w.boss.summonKinds as readonly TargetKind[],
            }
          : null,
      } satisfies WaveDefinition,
    ])
  ) as Record<number, WaveDefinition>;

  public isBossEncounterActive = false;

  private spawnedInWave = 0;
  private itemsSpawnedInWave = 0;
  private killedInWave = 0;
  /** 판 전체 처치 수. killedInWave와 달리 웨이브가 바뀌어도 유지된다. */
  private totalKills = 0;
  /** 판 전체 게임 시계. 일시정지와 카드 정지는 빠진다. */
  private playTimeSec = 0;
  private damageTaken = 0;
  private healedLives = 0;
  private itemsCollected = 0;
  private waveClears: { wave: number; seconds: number; bonus: number }[] = [];
  private bossSpawned = false;
  private cardStacks: Record<'damage_up' | 'skill_cooldown' | 'fever_extend' | 'hit_zone_up', number> = {
    damage_up: 0,
    skill_cooldown: 0,
    fever_extend: 0,
    hit_zone_up: 0,
  };
  private lastSpawnTimeMs = 0;
  private lastUpdateNowMs = 0;
  private targetCounter = 0;

  // Roguelike card & gimmick flags
  public isWeaponSelectPending = false;
  public isRewardCardPending = false;

  public get isCardSelectPending(): boolean {
    return this.isWeaponSelectPending || this.isRewardCardPending;
  }
  public rewardCardsSpawnTimeMs = 0;
  private goldenCanSpawnedInWave = false;
  private lastProjectileSpawnTimeMs = 0;
  private lastBossProjectileMs = 0;

  public aspect = 16 / 9;
  public vFovDeg = STAGE_CONSTANTS.CAMERA_FOV_DEG;
  public readonly projCamera = new THREE.PerspectiveCamera(STAGE_CONSTANTS.CAMERA_FOV_DEG, 16 / 9, 0.1, 100);

  public syncProjectionCamera(): void {
    this.projCamera.fov = this.vFovDeg;
    this.projCamera.aspect = this.aspect;
    this.projCamera.position.set(0, 1.65, 2.2);
    this.projCamera.lookAt(0, 1.35, -12);
    this.projCamera.updateProjectionMatrix();
    this.projCamera.updateMatrixWorld(true);
  }

  public getCardKillTarget(waveIndex: number = this.currentWave): number | null {
    const target = this.waveCardKillTargets[waveIndex];
    return target === undefined ? null : target;
  }

  public getLuckyDropMultiplier(): number {
    return 1 + this.luckyDropStacks;
  }

  public getNextLuckyDropMultiplier(): number {
    return Math.min(4, 1 + this.luckyDropStacks + 1);
  }

  public isBossSummoning(nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()): boolean {
    return nowMs < this.bossSummonActionUntilMs;
  }

  public getWaveProgress(): WaveProgressInfo {
    const currentDef = this.waveDefinitions[this.currentWave];
    const totalSpawns = currentDef ? currentDef.totalSpawns : 1;
    // Split bottles, boss minions and bosses are kills too; keep the counter within the wave's spawn count
    const killed = Math.min(this.killedInWave, totalSpawns);
    const remaining = Math.max(0, totalSpawns - killed);
    const progressPercent = Math.min(100, Math.round((killed / totalSpawns) * 100));

    return {
      wave: this.currentWave,
      totalWaves: STAGE_CONSTANTS.TOTAL_WAVES,
      killedInWave: killed,
      totalSpawns,
      remainingInWave: remaining,
      progressPercent,
      cardKillCount: this.cardKillCount,
      cardKillTarget: this.getCardKillTarget(),
      luckyDropMultiplier: this.getLuckyDropMultiplier(),
    };
  }

  /** The clock the world is drawn with: held at the pause moment while paused (timers are shifted on resume). */
  public getEffectiveNowMs(nowMs: number): number {
    return this.isPaused && this.pausedAtMs !== null ? this.pausedAtMs : nowMs;
  }

  public setPaused(paused: boolean, nowMs: number = performance.now()): void {
    if (paused && !this.isPaused) {
      this.isPaused = true;
      this.pausedAtMs = nowMs;
    } else if (!paused && this.isPaused) {
      const pauseDurationMs = this.pausedAtMs !== null ? Math.max(0, nowMs - this.pausedAtMs) : 0;
      // Same set of timers as the card-select freeze: buffs, fever, reload, spawns, boss summon,
      // projectile timers, stun and slow
      this.freezeTimers(pauseDurationMs);
      this.isPaused = false;
      this.pausedAtMs = null;
    }
  }

  public startGame(options?: { withWeaponSelect?: boolean }): void {
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.gamePhase = 'PLAYING';
    this.currentWave = 1;
    this.maxLives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.lives = this.maxLives;
    this.activeTargets = [];
    this.spawnedInWave = 0;
    this.itemsSpawnedInWave = 0;
    this.killedInWave = 0;
    this.bossSpawned = false;
    this.isBossEncounterActive = false;
    this.lastSpawnTimeMs = 0;
    this.goldenCanSpawnedInWave = false;
    this.lastProjectileSpawnTimeMs = 0;
    this.lastBossProjectileMs = 0;
    this.bossWarningUntilMs = 0;
    this.isTutorialMode = false;
    this.isSandboxMode = false;
    this.luckyDropStacks = 0;
    this.cardKillCount = 0;
    this.pendingWaveAdvance = false;
    this.bossSummonActionUntilMs = 0;
    this.bossSummonCrossed.clear();
    this.scoreManager.reset();
    this.shotStats = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.totalKills = 0;
    this.playTimeSec = 0;
    this.damageTaken = 0;
    this.healedLives = 0;
    this.itemsCollected = 0;
    this.waveClears = [];
    this.precisionBonusApplied = 0;
    this.levelBonusApplied = 0;
    this.waveStartMs = null;
    this.waveTimeBonusTotal = 0;
    this.lastWaveClear = null;
    this.weaponSystem.reset();
    this.resetCardStacks();
    this.activeBuffUntilMs.clear();
    this.isWeaponSelectPending = false;
    this.isRewardCardPending = false;
    this.lastUpdateNowMs = 0;
    this.resetCardStacks();

    if (options?.withWeaponSelect) {
      this.spawnWeaponSelectTargets();
    }
  }

  public startWave(waveIndex: number): void {
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.currentWave = Math.max(1, Math.min(STAGE_CONSTANTS.TOTAL_WAVES, waveIndex));
    this.spawnedInWave = 0;
    this.itemsSpawnedInWave = 0;
    this.killedInWave = 0;
    this.bossSpawned = false;
    this.isBossEncounterActive = false;
    this.lastSpawnTimeMs = 0;
    this.goldenCanSpawnedInWave = false;
    this.lastProjectileSpawnTimeMs = 0;
    this.lastBossProjectileMs = 0;
    this.bossWarningUntilMs = 0;
    this.isRewardCardPending = false;
    this.pendingWaveAdvance = false;
    this.cardKillCount = 0;
    this.bossSummonActionUntilMs = 0;
    this.bossSummonCrossed.clear();
    this.waveStartMs = null;
  }

  public spawnWeaponSelectTargets(nowMs = 0): void {
    this.isWeaponSelectPending = true;
    this.rewardCardsSpawnTimeMs = nowMs;
    const weaponKinds: WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
    const xPositions = [-1.85, 0, 1.85];

    weaponKinds.forEach((kind, idx) => {
      this.targetCounter += 1;
      const x = xPositions[idx];
      const z = -3.5;
      const theta = Math.atan2(x, -z);
      const radius = Math.hypot(x, z);

      this.activeTargets.push({
        id: `weapon_select_${kind}`,
        kind: 'obi',
        hp: 1,
        maxHp: 1,
        radiusM: radius,
        thetaRad: theta,
        x,
        z,
        speedMps: 0,
        hitRadiusM: 1.75,
        killBonusScore: 50,
        breached: false,
        customBaseY: 1.50,
        weaponSelectKind: kind,
      });
    });
  }

  private resetCardStacks(): void {
    this.cardStacks = { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 };
    this.weaponSystem.setSkillCooldownScale(1.0);
    this.scoreManager.setFeverDurationBonusMs(0);
  }

  /** 지금 상태에서 나올 수 있는 카드 풀. 최대치에 도달했거나 의미 없는 카드는 제외한다. */
  public buildRewardCardPool(): RewardCardKind[] {
    const cards = GAME_TUNING.cards;
    const weapon = this.weaponSystem.getState();
    const fever = this.scoreManager.getState();
    const waveCap = (GAME_TUNING.weaponLevelCapByWave as Record<number, number>)[this.currentWave] ?? 4;
    const pool: RewardCardKind[] = [];

    if (weapon.weaponLevel < 4 && weapon.weaponLevel < waveCap) pool.push('weapon_level_up');
    if (this.luckyDropStacks < cards.luckyDropMaxStacks) pool.push('lucky_drop');
    if (this.weaponSystem.getRapidReloadStacks() < cards.rapidReloadMaxStacks) pool.push('rapid_reload');
    if (!fever.isFeverReady && !fever.isFeverActive) pool.push('fever_boost');
    if (this.lives < this.maxLives) pool.push('bar_repair');
    if (this.cardStacks.damage_up < cards.damageUp.maxStacks) pool.push('damage_up');
    if (this.cardStacks.skill_cooldown < cards.skillCooldown.maxStacks) pool.push('skill_cooldown');
    if (this.cardStacks.fever_extend < cards.feverExtend.maxStacks) pool.push('fever_extend');
    if (this.cardStacks.hit_zone_up < cards.hitZoneUp.maxStacks) pool.push('hit_zone_up');
    return pool;
  }

  /** 풀에서 중복 없이 count장을 뽑는다. 풀이 모자라면 수리·부스터·장전으로 채워 항상 count장을 만든다. */
  private drawRewardCards(count: number): RewardCardKind[] {
    const pool = this.buildRewardCardPool();
    // Fisher-Yates shuffle with the injectable RNG
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(this.dropRng() * (i + 1)));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count);
    for (const filler of ['bar_repair', 'fever_boost', 'rapid_reload'] as RewardCardKind[]) {
      if (picked.length >= count) break;
      if (!picked.includes(filler)) picked.push(filler);
    }
    return picked;
  }

  public spawnWaveRewardCards(nowMs: number, isWaveClear = true): void {
    this.isRewardCardPending = true;
    this.rewardCardsSpawnTimeMs = nowMs;
    this.pendingWaveAdvance = isWaveClear;

    // Clean existing reward card targets if any
    this.activeTargets = this.activeTargets.filter((t) => !t.rewardCardKind);

    const candidateCards: RewardCardKind[] = this.drawRewardCards(3);
    const xPositions = [-1.85, 0, 1.85];

    candidateCards.forEach((cardKind, idx) => {
      this.targetCounter += 1;
      const x = xPositions[idx];
      const z = -3.5;
      const theta = Math.atan2(x, -z);
      const radius = Math.hypot(x, z);

      this.activeTargets.push({
        id: `reward_card_${this.targetCounter}_${cardKind}`,
        kind: 'obi',
        hp: 1,
        maxHp: 1,
        radiusM: radius,
        thetaRad: theta,
        x,
        z,
        speedMps: 0,
        hitRadiusM: 1.75,
        killBonusScore: 100,
        breached: false,
        customBaseY: 1.50,
        rewardCardKind: cardKind,
      });
    });
  }

  public applyRewardCard(cardKind: RewardCardKind, nowMs: number): void {
    switch (cardKind) {
      case 'weapon_level_up':
        this.weaponSystem.upgradeWeaponLevel();
        break;
      case 'rapid_reload':
        this.weaponSystem.applyRapidReloadBuff();
        break;
      case 'bar_repair':
        this.healLives(GAME_TUNING.repairCard.healAmount);
        break;
      case 'lucky_drop':
        this.luckyDropStacks = Math.min(GAME_TUNING.cards.luckyDropMaxStacks, this.luckyDropStacks + 1);
        break;
      case 'fever_boost':
        this.scoreManager.addFeverGauge(GAME_TUNING.fever.cardBoostGain);
        break;
      case 'damage_up':
        if (this.cardStacks.damage_up < GAME_TUNING.cards.damageUp.maxStacks) {
          this.cardStacks.damage_up += 1;
          this.weaponSystem.addDamageBonus(GAME_TUNING.cards.damageUp.amount);
        }
        break;
      case 'skill_cooldown':
        if (this.cardStacks.skill_cooldown < GAME_TUNING.cards.skillCooldown.maxStacks) {
          this.cardStacks.skill_cooldown += 1;
          this.weaponSystem.setSkillCooldownScale(
            GAME_TUNING.cards.skillCooldown.multiplier ** this.cardStacks.skill_cooldown
          );
        }
        break;
      case 'fever_extend':
        if (this.cardStacks.fever_extend < GAME_TUNING.cards.feverExtend.maxStacks) {
          this.cardStacks.fever_extend += 1;
          this.scoreManager.setFeverDurationBonusMs(
            GAME_TUNING.cards.feverExtend.amountMs * this.cardStacks.fever_extend
          );
        }
        break;
      case 'hit_zone_up':
        if (this.cardStacks.hit_zone_up < GAME_TUNING.cards.hitZoneUp.maxStacks) {
          this.cardStacks.hit_zone_up += 1;
        }
        break;
    }
  }

  public spawnGoldenCanTarget(nowMs: number): ActiveTargetEntity {
    this.goldenCanSpawnedInWave = true;
    this.targetCounter += 1;
    const entity: ActiveTargetEntity = {
      id: `golden_can_${this.targetCounter}`,
      kind: 'caslight',
      hp: 1,
      maxHp: 1,
      radiusM: 10.5,
      thetaRad: -0.38,
      initialThetaRad: -0.38,
      x: Math.sin(-0.38) * 10.5,
      z: -Math.cos(-0.38) * 10.5,
      speedMps: 4.5,
      hitRadiusM: 1.15,
      killBonusScore: 500,
      breached: false,
      isGoldenCan: true,
      customNormY: 0.15,
    };
    this.activeTargets.push(entity);
    return entity;
  }

  public spawnMonsterProjectile(
    nowMs: number,
    sourceKind: 'boss',
    origin?: { thetaRad: number; radiusM: number }
  ): ActiveTargetEntity {
    this.lastProjectileSpawnTimeMs = nowMs;
    this.targetCounter += 1;
    const existingAngles = this.activeTargets.map((t) => t.thetaRad);
    const sampled = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      existingAnglesRad: existingAngles,
    });
    const pt = origin
      ? {
          thetaRad: origin.thetaRad,
          radiusM: origin.radiusM,
          x: Math.sin(origin.thetaRad) * origin.radiusM,
          z: -Math.cos(origin.thetaRad) * origin.radiusM,
        }
      : sampled;

    const entity: ActiveTargetEntity = {
      id: `proj_${this.targetCounter}_${sourceKind}`,
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: Math.min(14.0, pt.radiusM),
      thetaRad: pt.thetaRad,
      initialThetaRad: pt.thetaRad,
      x: pt.x,
      z: pt.z,
      speedMps: 3.2,
      hitRadiusM: 0.95,
      killBonusScore: 80,
      breached: false,
      isProjectile: true,
      customBaseY: GAME_TUNING.shell.baseY, // On the floor; no customNormY so the hit zone follows the model
    };
    this.activeTargets.push(entity);
    this.projectileLaunchEvents.push({ source: sourceKind, x: pt.x, z: pt.z, y: GAME_TUNING.shell.baseY + 0.35 });
    if (this.projectileLaunchEvents.length > 32) this.projectileLaunchEvents.shift();
    return entity;
  }

  public startTutorialMode(): void {
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.gamePhase = 'TUTORIAL';
    this.isTutorialMode = true;
    this.currentWave = 1;
    this.isBossEncounterActive = false;
    this.bossSpawned = false;
    this.bossWarningUntilMs = 0;
    this.isWeaponSelectPending = false;
    this.isRewardCardPending = false;
    this.tutorialStep = 1;
    this.tutorialCompleted = false;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.scoreManager.reset();
    this.weaponSystem.reset();
    this.resetCardStacks();
    this.activeBuffUntilMs.clear();

    const angles = [-0.22, 0.0, 0.22];
    angles.forEach((theta, idx) => {
      this.targetCounter += 1;
      const radius = 10.0;
      this.activeTargets.push({
        id: `tutorial_can_${idx + 1}`,
        kind: 'pilgood',
        hp: 1,
        maxHp: 1,
        radiusM: radius,
        thetaRad: theta,
        x: Math.sin(theta) * radius,
        z: -Math.cos(theta) * radius,
        speedMps: 0,
        hitRadiusM: 1.1,
        killBonusScore: 50,
        breached: false,
      });
    });
  }

  public advanceTutorialStep(nextStep: TutorialStep): void {
    this.tutorialStep = nextStep;
    if (nextStep === 2) {
      this.targetCounter += 1;
      const bottleSpec = TARGET_SPECS.bottle;
      this.activeTargets = [
        {
          id: `tutorial_bottle_${this.targetCounter}`,
          kind: 'bottle',
          hp: bottleSpec.maxHp,
          maxHp: bottleSpec.maxHp,
          radiusM: 14.0,
          thetaRad: 0,
          x: 0,
          z: -14.0,
          speedMps: 1.4,
          hitRadiusM: bottleSpec.hitRadiusM,
          killBonusScore: bottleSpec.killBonusScore,
          breached: false,
        },
      ];
    } else if (nextStep === 3) {
      this.weaponSystem.refillSkillInstant();
      this.spawnTutorialSkillTargets();
    } else if (nextStep === 4) {
      this.scoreManager.forceSetFeverGauge(100);
      this.activeTargets = [];
    } else if (nextStep === 'COMPLETED') {
      this.tutorialCompleted = true;
      this.activeTargets = [];
    }
  }

  /** Tutorial step 3: stationary targets so the skill's area effect is easy to see. */
  public spawnTutorialSkillTargets(): void {
    this.activeTargets = [];
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'pilgood', 'caslight', 'pilgood'];
    const angles = [-0.3, -0.15, 0, 0.15, 0.3];

    kinds.forEach((kind, i) => {
      this.targetCounter += 1;
      const spec = TARGET_SPECS[kind];
      const radius = 12.0 + (i % 2);
      const theta = angles[i];
      this.activeTargets.push({
        id: `tutorial_skill_${this.targetCounter}_${kind}`,
        kind,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        radiusM: radius,
        thetaRad: theta,
        x: Math.sin(theta) * radius,
        z: -Math.cos(theta) * radius,
        speedMps: 0,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      });
    });
  }

  public spawnTutorialFeverEnemies(): void {
    this.activeTargets = [];
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'caslight'];
    const angles = [-0.35, -0.20, -0.07, 0.07, 0.20, 0.35];

    kinds.forEach((kind, i) => {
      this.targetCounter += 1;
      const spec = TARGET_SPECS[kind];
      const radius = 12.0 + (i % 2) * 2.0;
      const theta = angles[i];
      this.activeTargets.push({
        id: `tutorial_fever_${this.targetCounter}_${kind}`,
        kind,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        radiusM: radius,
        thetaRad: theta,
        x: Math.sin(theta) * radius,
        z: -Math.cos(theta) * radius,
        speedMps: 1.6,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      });
    });
  }

  public exitTutorialMode(): void {
    this.isTutorialMode = false;
    this.tutorialStep = 1;
    this.activeTargets = [];
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.gamePhase = 'PAIRING';
  }

  public getBossEntities(): ActiveTargetEntity[] {
    return this.activeTargets.filter((t) => t.kind === 'boss');
  }

  public getBossEntity(): ActiveTargetEntity | undefined {
    return this.getBossEntities()[0];
  }

  public exitSandboxMode(): void {
    this.isSandboxMode = false;
    this.activeTargets = [];
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.gamePhase = 'PAIRING';
  }

  public spawnCalibrationFiveTargets(): void {
    this.activeTargets = [];
    const calibPoints = [
      { id: 'calib_center', theta: 0, normY: 0 },
      { id: 'calib_left', theta: -0.36, normY: 0 },
      { id: 'calib_right', theta: 0.36, normY: 0 },
      { id: 'calib_top', theta: 0, normY: 0.55 },
      { id: 'calib_bottom', theta: 0, normY: -0.55 },
    ];

    calibPoints.forEach((p) => {
      const radius = 10.0;
      this.activeTargets.push({
        id: p.id,
        kind: 'obi',
        hp: 1,
        maxHp: 1,
        radiusM: radius,
        thetaRad: p.theta,
        x: Math.sin(p.theta) * radius,
        z: -Math.cos(p.theta) * radius,
        speedMps: 0,
        hitRadiusM: 1.1,
        killBonusScore: 100,
        breached: false,
        customNormY: p.normY,
      });
    });
  }

  public startSandboxMode(): void {
    this.clearSkillProjectiles();
    this.resetBossClear();
    this.gamePhase = 'SANDBOX';
    this.isSandboxMode = true;
    this.currentWave = 1;
    this.isBossEncounterActive = false;
    this.bossSpawned = false;
    this.bossWarningUntilMs = 0;
    this.isWeaponSelectPending = false;
    this.isRewardCardPending = false;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.scoreManager.reset();
    this.weaponSystem.reset();
    this.resetCardStacks();
    this.activeBuffUntilMs.clear();
    this.infiniteAmmo = true;
    this.weaponSystem.setInfiniteAmmo(true);

    const calibPoints = [
      { id: 'calib_center', theta: 0, normY: 0 },
      { id: 'calib_left', theta: -0.36, normY: 0 },
      { id: 'calib_right', theta: 0.36, normY: 0 },
      { id: 'calib_top', theta: 0, normY: 0.55 },
      { id: 'calib_bottom', theta: 0, normY: -0.55 },
    ];

    calibPoints.forEach((p) => {
      const radius = 10.0;
      this.activeTargets.push({
        id: p.id,
        kind: 'obi',
        hp: 1,
        maxHp: 1,
        radiusM: radius,
        thetaRad: p.theta,
        x: Math.sin(p.theta) * radius,
        z: -Math.cos(p.theta) * radius,
        speedMps: 0,
        hitRadiusM: 1.1,
        killBonusScore: 100,
        breached: false,
        customNormY: p.normY,
      });
    });
  }

  public spawnSandboxTarget(kind: TargetKind, options: SandboxSpawnOptions = {}): ActiveTargetEntity {
    this.targetCounter += 1;
    const spec = TARGET_SPECS[kind];
    const radius = options.radiusM ?? 16.0;
    const theta = options.thetaRad ?? 0;
    const speed = options.stationary ? 0 : spec.speedMps;

    const entity: ActiveTargetEntity = {
      id: `sandbox_${this.targetCounter}_${kind}`,
      kind,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      radiusM: radius,
      thetaRad: theta,
      initialThetaRad: options.initialThetaRad ?? theta,
      x: Math.sin(theta) * radius,
      z: -Math.cos(theta) * radius,
      speedMps: speed,
      hitRadiusM: spec.hitRadiusM,
      killBonusScore: spec.killBonusScore,
      breached: false,
      customNormY: options.customNormY,
      customBaseY: options.customBaseY,
    };
    this.activeTargets.push(entity);
    return entity;
  }

  public clearSandboxTargets(): void {
    this.activeTargets = [];
  }

  public setInfiniteAmmo(enabled: boolean): void {
    this.infiniteAmmo = enabled;
    this.weaponSystem.setInfiniteAmmo(enabled);
  }

  public activateFever(nowMs: number): boolean {
    if (this.isCardSelectPending || this.bossClearUntilMs > 0) return false;
    const activated = this.scoreManager.activateFever(nowMs);
    if (activated) {
      this.weaponSystem.refillAmmoOnFever();
    }
    return activated;
  }

  public triggerSandboxFever(nowMs: number): boolean {
    this.scoreManager.forceSetFeverGauge(100);
    return this.activateFever(nowMs);
  }

  /** 체력을 회복한다. 가득 차서 버려지는 양은 기록하지 않는다. */
  private healLives(amount: number): void {
    const next = Math.min(this.maxLives, this.lives + amount);
    this.healedLives += next - this.lives;
    this.lives = next;
  }

  public activateItemBuff(kind: ItemBuffKind, nowMs: number): void {
    const spec = ITEM_BUFF_SPECS[kind];
    if (kind === 'bar_repair') {
      this.healLives(1);
      return;
    }
    this.activeBuffUntilMs.set(kind, nowMs + spec.durationMs);
  }

  public isBuffActive(
    kind: ItemBuffKind,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()
  ): boolean {
    const untilMs = this.activeBuffUntilMs.get(kind);
    return untilMs !== undefined && untilMs > nowMs;
  }

  public getActiveBuffs(
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()
  ): ActiveBuffState[] {
    const list: ActiveBuffState[] = [];
    for (const [kind, untilMs] of this.activeBuffUntilMs.entries()) {
      if (untilMs > nowMs) {
        list.push({
          kind,
          remainingMs: Math.max(0, untilMs - nowMs),
          totalDurationMs: ITEM_BUFF_SPECS[kind].durationMs,
        });
      }
    }
    return list;
  }

  public spawnItemTarget(itemKind: ItemBuffKind, nowMs: number): ActiveTargetEntity {
    const existingAngles = this.activeTargets.map((t) => t.thetaRad);
    const pt = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      existingAnglesRad: existingAngles,
    });

    this.targetCounter += 1;
    const itemEntity: ActiveTargetEntity = {
      id: `item_${this.targetCounter}_${itemKind}`,
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: pt.radiusM,
      thetaRad: pt.thetaRad,
      x: pt.x,
      z: pt.z,
      speedMps: 2.6,
      hitRadiusM: 1.05,
      killBonusScore: 100,
      breached: false,
      isItem: true,
      itemKind,
    };

    this.activeTargets.push(itemEntity);
    return itemEntity;
  }

  public spawnItemTargetAt(
    nowMs: number,
    thetaRad: number,
    radiusM: number,
    forcedItemKind?: ItemBuffKind
  ): ActiveTargetEntity {
    const itemKinds = GAME_TUNING.itemDropKinds as readonly ItemBuffKind[];
    const kind = forcedItemKind ?? itemKinds[Math.floor(this.dropRng() * itemKinds.length)];

    this.targetCounter += 1;
    const clampedRadius = Math.max(6.5, Math.min(16.0, radiusM));
    const itemEntity: ActiveTargetEntity = {
      id: `item_${this.targetCounter}_${kind}`,
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: clampedRadius,
      thetaRad,
      x: Math.sin(thetaRad) * clampedRadius,
      z: -Math.cos(thetaRad) * clampedRadius,
      speedMps: 2.2,
      hitRadiusM: 1.05,
      killBonusScore: 100,
      breached: false,
      isItem: true,
      itemKind: kind,
    };

    this.activeTargets.push(itemEntity);
    return itemEntity;
  }

  /** 각 보스가 자기 최대 체력 대비 구간 값 아래로 내려갈 때마다 구간별 마릿수(4·5·6)를 소환한다(시간이 아니라 체력 기준). */
  private checkBossHpSummons(nowMs: number): void {
    const thresholds = GAME_TUNING.boss.summonHpThresholds;
    for (const boss of this.getBossEntities()) {
      let crossed = this.bossSummonCrossed.get(boss.id) ?? 0;
      const ratio = boss.hp / boss.maxHp;
      while (crossed < thresholds.length && ratio <= thresholds[crossed]) {
        const count = GAME_TUNING.boss.summonCountByStep[crossed];
        crossed += 1;
        this.spawnBossMinionWave(nowMs, count);
      }
      this.bossSummonCrossed.set(boss.id, crossed);
    }
  }

  /** False while a summoned minion is still falling in (it cannot be hit and does not act yet). */
  public isTargetLanded(t: ActiveTargetEntity, nowMs: number): boolean {
    return t.dropLandAtMs === undefined || nowMs >= t.dropLandAtMs;
  }

  /** Random landing spot across the field, not too close to the defense line and not on top of a sibling. */
  private pickMinionDropSpot(placed: { x: number; z: number }[]): { theta: number; radius: number } {
    const cfg = GAME_TUNING.boss.minionDrop;
    // Narrow windows see less of the field: never drop outside the visible fan (same margin as regular spawns)
    const visibleHalfRad =
      computeHorizontalHalfFovRad(STAGE_CONSTANTS.CAMERA_FOV_DEG, this.aspect) * STAGE_CONSTANTS.FAN_MARGIN_RATIO;
    const thetaRange = Math.min(cfg.thetaRangeRad, visibleHalfRad);
    let theta = 0;
    let radius = cfg.minRadiusM;
    for (let attempt = 0; attempt < 4; attempt++) {
      theta = (this.dropRng() * 2 - 1) * thetaRange;
      radius = cfg.minRadiusM + this.dropRng() * (cfg.maxRadiusM - cfg.minRadiusM);
      const x = Math.sin(theta) * radius;
      const z = -Math.cos(theta) * radius;
      if (placed.every((p) => Math.hypot(p.x - x, p.z - z) >= cfg.minSeparationM)) break;
    }
    return { theta, radius };
  }

  public spawnBossMinionWave(nowMs: number, count = 4): ActiveTargetEntity[] {
    this.bossSummonActionUntilMs = nowMs + 1800;
    const waveBoss = this.waveDefinitions[this.currentWave]?.boss;
    const kinds: readonly TargetKind[] = waveBoss
      ? waveBoss.summonKinds
      : ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'];
    const spawned: ActiveTargetEntity[] = [];
    const placed: { x: number; z: number }[] = [];

    for (let i = 0; i < count; i++) {
      this.targetCounter += 1;
      const kind = kinds[Math.floor(this.dropRng() * kinds.length)];
      const spec = TARGET_SPECS[kind];
      const { theta, radius } = this.pickMinionDropSpot(placed);
      const x = Math.sin(theta) * radius;
      const z = -Math.cos(theta) * radius;
      placed.push({ x, z });

      const entity: ActiveTargetEntity = {
        id: `boss_minion_${this.targetCounter}_${kind}`,
        kind,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        radiusM: radius,
        thetaRad: theta,
        initialThetaRad: theta,
        x,
        z,
        speedMps: spec.speedMps * this.getWaveSpeedMultiplier(),
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
        isSummonedMinion: true,
        dropLandAtMs: nowMs + GAME_TUNING.boss.minionDrop.dropMs,
      };
      this.applyMonsterTraits(entity);
      if (entity.guardPhaseMs !== undefined && entity.dropLandAtMs !== undefined) {
        // An obi lands with its shield DOWN so the player gets the full down window to react
        const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
        const cycle = guardUpMs + guardDownMs;
        entity.guardPhaseMs = (((guardUpMs - entity.dropLandAtMs) % cycle) + cycle) % cycle;
      }
      this.activeTargets.push(entity);
      spawned.push(entity);
    }
    return spawned;
  }

  private freezeTimers(deltaMs: number): void {
    if (deltaMs <= 0) return;
    for (const [kind, until] of this.activeBuffUntilMs.entries()) {
      this.activeBuffUntilMs.set(kind, until + deltaMs);
    }
    this.scoreManager.shiftFeverTimer(deltaMs);
    this.weaponSystem.shiftReloadTimer(deltaMs);
    if (this.waveStartMs !== null) this.waveStartMs += deltaMs;
    if (this.lastSpawnTimeMs > 0) this.lastSpawnTimeMs += deltaMs;
    if (this.lastProjectileSpawnTimeMs > 0) this.lastProjectileSpawnTimeMs += deltaMs;
    if (this.lastBossProjectileMs > 0) this.lastBossProjectileMs += deltaMs;
    if (this.bossClearUntilMs > 0) {
      this.bossClearUntilMs += deltaMs;
      this.bossClearNextCascadeMs += deltaMs;
    }
    for (const target of this.activeTargets) {
      if (target.stunUntilMs !== undefined && target.stunUntilMs > 0) target.stunUntilMs += deltaMs;
      if (target.slowUntilMs !== undefined && target.slowUntilMs > 0) target.slowUntilMs += deltaMs;
      if (target.dropLandAtMs !== undefined) target.dropLandAtMs += deltaMs;
    }
  }

  public update(nowMs: number, dtSec: number): {
    breaches: ActiveTargetEntity[];
    phaseChanged: boolean;
    reloadedJustNow: boolean;
  } {
    // Real elapsed time since the previous update call. The frame dt is capped by the caller, so a long
    // frame or a hidden tab must be measured on the real clock when freezing.
    const prevUpdateNowMs = this.lastUpdateNowMs;
    this.lastUpdateNowMs = nowMs;

    if (this.isPaused) {
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    if (this.gamePhase !== 'PLAYING' && this.gamePhase !== 'TUTORIAL' && this.gamePhase !== 'SANDBOX') {
      this.clearSkillProjectiles();
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    // While cards are pending the whole game clock stops: fever, buffs, skill cooldown, reload, spawns.
    if (!this.isTutorialMode && !this.isSandboxMode && this.isCardSelectPending) {
      const realElapsedMs = prevUpdateNowMs > 0 ? Math.max(0, nowMs - prevUpdateNowMs) : dtSec * 1000;
      this.freezeTimers(realElapsedMs);
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    if (this.waveStartMs === null && this.gamePhase === 'PLAYING') this.waveStartMs = nowMs;

    if (this.bossClearUntilMs > 0) {
      this.advanceBossClear(nowMs, dtSec);
      return { breaches: [], phaseChanged: (this.gamePhase as GamePhase) === 'VICTORY', reloadedJustNow: false };
    }

    this.updateGuards(nowMs);
    this.updateBossMovement(nowMs);
    this.advanceSkillBlades(nowMs, dtSec);
    this.advanceSkillFoam(nowMs, dtSec);
    if (this.bossClearUntilMs > 0) {
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    // Clean expired buffs
    for (const [kind, untilMs] of this.activeBuffUntilMs.entries()) {
      if (nowMs >= untilMs) {
        this.activeBuffUntilMs.delete(kind);
      }
    }

    const feverState = this.scoreManager.getState();
    const { reloadedJustNow } = this.weaponSystem.update(nowMs, feverState.isFeverActive, dtSec * 1000);
    this.scoreManager.updateFeverTimer(nowMs);

    if (this.isTutorialMode && this.tutorialStep === 4) {
      if (!this.scoreManager.getState().isFeverActive && this.scoreManager.getState().feverGauge === 0 && this.activeTargets.length === 0) {
        this.advanceTutorialStep('COMPLETED');
      }
    }

    this.playTimeSec += dtSec;
    this.processHanmacBlasts(nowMs);

    const breaches: ActiveTargetEntity[] = [];
    const isIceFreeze = this.isBuffActive('ice_freeze', nowMs);

    // 1. Advance active targets radially
    for (let i = this.activeTargets.length - 1; i >= 0; i--) {
      const target = this.activeTargets[i];

      // A minion still falling in does nothing yet; a caslight keeps its sway so it does not jump on landing
      if (!this.isTargetLanded(target, nowMs)) {
        if (target.kind === 'caslight' && target.initialThetaRad !== undefined) {
          const { swayAmplitudeRad, swayFrequency } = GAME_TUNING.monsters.caslight;
          target.thetaRad =
            target.initialThetaRad + Math.sin(nowMs * swayFrequency + target.radiusM * 0.7 + (target.swayPhaseOffsetRad ?? 0)) * swayAmplitudeRad;
          target.x = Math.sin(target.thetaRad) * target.radiusM;
          target.z = -Math.cos(target.thetaRad) * target.radiusM;
        }
        continue;
      }

      // Check stun status
      const isStunned = target.stunUntilMs !== undefined && target.stunUntilMs > nowMs;
      if (!isStunned && target.stuckPlungerCount) {
        target.stuckPlungerCount = 0;
      }

      // Check slow status
      const isSlowed = target.slowUntilMs !== undefined && target.slowUntilMs > nowMs;
      let effectiveSpeed = target.speedMps;

      if (isStunned) {
        effectiveSpeed = 0;
      } else {
        if (isIceFreeze && !target.isItem) {
          effectiveSpeed *= 0.5;
        }
        if (isSlowed) {
          effectiveSpeed *= (1 - (target.slowRatio ?? 0.4));
        }
      }

      // 거품 해일에 밀린 몬스터: 전진하지 않고 뒤로 미끄러진다(순간이동이 아니다).
      const slide = target.slideRemainingM ?? 0;
      if (slide > 0) {
        const step = Math.min(slide, GAME_TUNING.skills.foam.slideSpeedMps * dtSec);
        target.slideRemainingM = slide - step;
        this.pushTargetBack(target, step);
        effectiveSpeed = 0;
      }

      const isRegularPlay = !this.isTutorialMode && !this.isSandboxMode;
      const isPlainMonster = !target.isItem && !target.isProjectile && !target.isGoldenCan;

      // Pilgood: ground rocket can that charges once it gets close to the defense line
      if (
        target.kind === 'pilgood' && isPlainMonster && isRegularPlay && !isStunned &&
        target.radiusM <= GAME_TUNING.monsters.pilgood.chargeRadiusM
      ) {
        effectiveSpeed *= GAME_TUNING.monsters.pilgood.chargeSpeedMult;
      }

      // Caslight: the only airborne monster; it sways widely to dodge aim
      if (target.kind === 'caslight' && isPlainMonster && target.initialThetaRad !== undefined) {
        const { swayAmplitudeRad, swayFrequency } = GAME_TUNING.monsters.caslight;
        target.thetaRad =
          target.initialThetaRad + Math.sin(nowMs * swayFrequency + target.radiusM * 0.7 + (target.swayPhaseOffsetRad ?? 0)) * swayAmplitudeRad;
      }

      // Fast horizontal crossing for Golden Can
      if (target.isGoldenCan) {
        target.thetaRad += dtSec * 0.28;
      }

      const next = advanceRadialTarget(
        { radiusM: target.radiusM, thetaRad: target.thetaRad },
        effectiveSpeed,
        dtSec
      );

      if (target.kind === 'boss') {
        const stopRadiusM = GAME_TUNING.boss.stopRadiusM;
        if (next.radiusM <= stopRadiusM) {
          target.radiusM = stopRadiusM;
          target.x = Math.sin(target.thetaRad) * stopRadiusM;
          target.z = -Math.cos(target.thetaRad) * stopRadiusM;
          target.breached = false;
        } else {
          target.radiusM = next.radiusM;
          target.x = next.x;
          target.z = next.z;
          target.breached = false;
        }
      } else {
        target.radiusM = next.radiusM;
        target.x = next.x;
        target.z = next.z;
        target.breached = next.breached;
      }

      if (target.breached) {
        if (this.isSandboxMode) {
          target.radiusM = 16.0;
          target.x = Math.sin(target.thetaRad) * 16.0;
          target.z = -Math.cos(target.thetaRad) * 16.0;
          target.breached = false;
          continue;
        }

        if (this.isTutorialMode) {
          if (this.tutorialStep === 2) {
            target.radiusM = 14.0;
            target.x = 0;
            target.z = -14.0;
            target.breached = false;
            continue;
          } else if (this.tutorialStep === 4) {
            this.activeTargets.splice(i, 1);
            if (this.activeTargets.length === 0) {
              this.advanceTutorialStep('COMPLETED');
            }
            continue;
          }
          this.activeTargets.splice(i, 1);
          continue;
        }

        this.activeTargets.splice(i, 1);

        if (target.isItem || target.isGoldenCan || target.weaponSelectKind || target.rewardCardKind) {
          continue;
        }

        breaches.push(target);
        const damage = target.isProjectile ? 1 : target.kind === 'boss' ? STAGE_CONSTANTS.PLAYER_MAX_LIVES : 1;
        this.damageTaken += Math.min(this.lives, damage);
        this.lives = Math.max(0, this.lives - damage);

        if (this.lives <= 0) {
          this.gamePhase = 'GAMEOVER';
          return { breaches, phaseChanged: true, reloadedJustNow };
        }
      }
    }

    if (this.isTutorialMode || this.isSandboxMode) {
      return { breaches, phaseChanged: false, reloadedJustNow };
    }

    // Don't spawn while cards/weapon choices are pending
    if (this.isWeaponSelectPending || this.isRewardCardPending) {
      return { breaches, phaseChanged: false, reloadedJustNow };
    }

    const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[STAGE_CONSTANTS.TOTAL_WAVES];

    // 2. Periodic enemy spawn. While a boss is alive the field is refilled past totalSpawns, and only regular monsters
    // count toward the cap so the boss and its minions do not crowd them out.
    const fieldCount = this.isBossEncounterActive ? this.countFieldMonsters() : this.activeTargets.length;
    const bossDefeated = !!waveDef.boss && this.bossSpawned && !this.isBossEncounterActive;
    const canSpawn =
      fieldCount < waveDef.maxSimultaneous &&
      !bossDefeated &&
      (this.spawnedInWave < waveDef.totalSpawns || this.isBossEncounterActive) &&
      (this.spawnedInWave === 0 || nowMs - this.lastSpawnTimeMs >= waveDef.spawnIntervalMs);

    if (canSpawn) {
      this.spawnNextTarget(waveDef, nowMs);

      // Golden Can once per wave at 50% spawn progress
      if (!this.goldenCanSpawnedInWave && this.spawnedInWave >= waveDef.totalSpawns * 0.5) {
        this.spawnGoldenCanTarget(nowMs);
      }
    }

    // The boss arrives once enough regular monsters are out; it is checked after the spawn above so a wave that
    // jumps straight to its spawn total still gets its boss in the same frame.
    if (
      waveDef.boss &&
      !this.bossSpawned &&
      this.spawnedInWave >= Math.ceil(waveDef.totalSpawns * GAME_TUNING.boss.encounterStartRatio)
    ) {
      this.spawnBossEncounter(nowMs);
    }

    // Periodic projectile spawn from the boss
    const hasBossShooter = this.activeTargets.some((t) => t.kind === 'boss');
    if (hasBossShooter && nowMs - this.lastBossProjectileMs >= 3500 && this.countFieldMonsters() < waveDef.maxSimultaneous + 2) {
      // Living coolers fire in turns from their own position; the king fires only if no cooler is left
      const bosses = this.getBossEntities();
      const coolers = bosses.filter((b) => b.bossRole !== 'king');
      const shooters = coolers.length > 0 ? coolers : bosses;
      const shooter = shooters[this.bossShooterIndex % shooters.length];
      this.bossShooterIndex += 1;
      this.lastBossProjectileMs = nowMs;
      this.spawnMonsterProjectile(nowMs, 'boss', { thetaRad: shooter.thetaRad, radiusM: shooter.radiusM });
    }

    // Boss encounter: minions drop in when a boss crosses an HP threshold (not on a timer)
    if (this.isBossEncounterActive) this.checkBossHpSummons(nowMs);

    // 4. Check wave completion
    const monsterTargets = this.activeTargets.filter((t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind);
    const bossAlive = monsterTargets.some((t) => t.kind === 'boss');
    // A boss wave is over once its boss is dead (the clear sequence has emptied the field), however many spawns were left.
    const miniWaveDone = waveDef.boss
      ? this.bossSpawned && !bossAlive
      : this.spawnedInWave >= waveDef.totalSpawns && monsterTargets.length === 0;

    if (miniWaveDone) {
      this.awardWaveTimeBonus(nowMs);
      this.activeTargets = [];
      // Between waves: Spawn Shoot-to-Select Reward Cards (the last wave always ends with its boss fight)
      this.spawnWaveRewardCards(nowMs, true);
      return { breaches, phaseChanged: true, reloadedJustNow };
    }

    return { breaches, phaseChanged: false, reloadedJustNow };
  }

  /** 필드의 일반 몬스터 수. 보스·소환 부하·투사체·아이템·황금캔·카드는 세지 않는다. */
  private countFieldMonsters(): number {
    return this.activeTargets.filter(
      (t) =>
        !t.isItem &&
        !t.isProjectile &&
        !t.isGoldenCan &&
        !t.weaponSelectKind &&
        !t.rewardCardKind &&
        t.kind !== 'boss' &&
        !t.isSummonedMinion
    ).length;
  }

  private spawnNextTarget(waveDef: WaveDefinition, nowMs: number): void {
    const kind = waveDef.kinds[Math.floor(Math.random() * waveDef.kinds.length)];
    const spec = TARGET_SPECS[kind];
    const existingAngles = this.activeTargets.map((t) => t.thetaRad);

    const pt = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      existingAnglesRad: existingAngles,
    });

    this.targetCounter += 1;
    const entity: ActiveTargetEntity = {
      id: `target_${this.targetCounter}_${kind}`,
      kind,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      radiusM: pt.radiusM,
      thetaRad: pt.thetaRad,
      initialThetaRad: pt.thetaRad,
      x: pt.x,
      z: pt.z,
      speedMps: spec.speedMps * this.getWaveSpeedMultiplier(),
      hitRadiusM: spec.hitRadiusM,
      killBonusScore: spec.killBonusScore,
      breached: false,
    };

    this.applyMonsterTraits(entity);
    this.activeTargets.push(entity);
    this.spawnedInWave += 1;
    this.lastSpawnTimeMs = nowMs;
  }

  /** 종류별 개체 특성(오비 방패 위상, 큰 병 크기). 웨이브 몬스터와 보스 소환 부하에 쓴다. */
  private applyMonsterTraits(entity: ActiveTargetEntity): void {
    if (entity.kind === 'obi') {
      const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
      entity.guardPhaseMs = this.dropRng() * (guardUpMs + guardDownMs);
      entity.isGuarding = false;
    } else if (entity.kind === 'bottle') {
      entity.modelScaleMult = GAME_TUNING.monsters.bottle.bigScale;
    }
  }

  /** 보스 좌우 이동. theta만 바꾸면 이동 루프가 x, z를 다시 계산한다. */
  private updateBossMovement(nowMs: number): void {
    if (!this.isBossEncounterActive) return;
    const bosses = this.getBossEntities();
    if (bosses.length === 0) return;
    const m = GAME_TUNING.boss.movement;
    const t = nowMs / 1000;
    const hasKing = bosses.some((b) => b.bossRole === 'king');
    const coolers = bosses.filter((b) => b.bossRole !== 'king');
    const totalCoolersAtStart = this.waveDefinitions[this.currentWave]?.boss?.coolerHp.length ?? coolers.length;

    for (const b of bosses) {
      const side = (b.bossBaseThetaRad ?? 0) < 0 ? -1 : 1;
      if (b.bossRole === 'king') {
        b.thetaRad = m.kingAmplitudeRad * Math.sin(t * m.kingSpeed);
      } else if (hasKing) {
        b.thetaRad = side * (m.withKingOffsetRad + m.withKingWobbleRad * Math.sin(t * m.crossSpeed));
      } else if (totalCoolersAtStart >= 2) {
        // Crossing paths; a surviving cooler keeps its own pattern
        b.thetaRad = side * m.crossAmplitudeRad * Math.sin(t * m.crossSpeed);
      } else {
        b.thetaRad = m.singleAmplitudeRad * Math.sin(t * m.singleSpeed);
      }
    }
  }

  /** 방패 병: 2초 올리고 1초 내리기를 반복한다. 기절하면 방패가 내려간다. */
  private updateGuards(nowMs: number): void {
    const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
    const cycle = guardUpMs + guardDownMs;
    for (const t of this.activeTargets) {
      if (t.guardPhaseMs === undefined) continue;
      const stunned = t.stunUntilMs !== undefined && t.stunUntilMs > nowMs;
      t.isGuarding = !stunned && (nowMs + t.guardPhaseMs) % cycle < guardUpMs;
    }
  }

  /** 큰 병맥주가 깨지면 작은 병 두 마리로 나뉜다. 작은 병은 다시 나뉘지 않는다. */
  private splitBottle(parent: ActiveTargetEntity): void {
    const cfg = GAME_TUNING.monsters.bottle;
    for (let i = 0; i < cfg.splitCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const thetaRad = parent.thetaRad + side * cfg.splitOffsetRad;
      this.targetCounter += 1;
      this.activeTargets.push({
        id: `bottle_child_${this.targetCounter}`,
        kind: 'bottle',
        hp: cfg.childHp,
        maxHp: cfg.childHp,
        radiusM: parent.radiusM,
        thetaRad,
        initialThetaRad: thetaRad,
        x: Math.sin(thetaRad) * parent.radiusM,
        z: -Math.cos(thetaRad) * parent.radiusM,
        speedMps: cfg.childSpeedMps * this.getWaveSpeedMultiplier(),
        hitRadiusM: cfg.childHitRadiusM,
        killBonusScore: cfg.childKillBonus,
        breached: false,
        isSplitChild: true,
        modelScaleMult: cfg.childScale,
        customBaseY: cfg.childBaseY,
      });
    }
  }

  /** 일반 몬스터 속도 배율: 웨이브마다 GAME_TUNING.speedPerWave(+8%). 보스·아이템·금색 캔·투사체에는 쓰지 않는다. */
  private getWaveSpeedMultiplier(): number {
    return 1 + GAME_TUNING.speedPerWave * (this.currentWave - 1);
  }

  /** 일반 몬스터를 encounterStartRatio만큼 소환하면 냉각기(들)와 필요하면 대왕을 좌우로 벌려 등장시킨다. */
  private spawnBossEncounter(nowMs: number): void {
    const waveDef = this.waveDefinitions[this.currentWave];
    if (!waveDef?.boss) return;
    this.bossSpawned = true;
    this.isBossEncounterActive = true;
    this.bossWarningUntilMs = nowMs + GAME_TUNING.boss.warningMs;
    this.bossSummonCrossed.clear();
    this.bossShooterIndex = 0;
    this.lastBossProjectileMs = nowMs;

    const spec = TARGET_SPECS.boss;
    const { coolerHp, kingHp } = waveDef.boss;
    const spread = GAME_TUNING.boss.coolerSpreadRad;
    const thetas =
      coolerHp.length === 1 ? [0] : coolerHp.map((_, i) => (i === 0 ? -spread : spread));

    const make = (
      role: 'cooler' | 'king',
      hp: number,
      theta: number,
      hitRadiusM: number
    ): ActiveTargetEntity => {
      this.targetCounter += 1;
      const radius = GAME_TUNING.boss.startRadiusM;
      return {
        id: `boss_${this.targetCounter}`,
        kind: 'boss',
        hp,
        maxHp: hp,
        radiusM: radius,
        thetaRad: theta,
        initialThetaRad: theta,
        bossBaseThetaRad: theta,
        bossRole: role,
        x: Math.sin(theta) * radius,
        z: -Math.cos(theta) * radius,
        speedMps: spec.speedMps,
        hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      };
    };

    coolerHp.forEach((hp, i) => {
      this.activeTargets.push(make('cooler', hp, thetas[i], spec.hitRadiusM));
    });
    if (kingHp !== null) {
      const king = make('king', kingHp, 0, spec.hitRadiusM * GAME_TUNING.boss.kingScale);
      king.modelScaleMult = GAME_TUNING.boss.kingScale;
      // The model scales around its center, so lift it to stand on the floor (the hit center follows).
      king.customBaseY = getTargetBaseY('boss', false) * GAME_TUNING.boss.kingScale;
      this.activeTargets.push(king);
    }
    this.lastSpawnTimeMs = nowMs;
  }

  public computeTargetAimCoords(
    target: ActiveTargetEntity,
    wideScopeMult = 1.0
  ): TargetAimProjection {
    this.syncProjectionCamera();

    let targetNormX = 0;
    let targetNormY = 0;
    let camDist = Math.max(2.5, target.radiusM);

    if (target.customNormY !== undefined) {
      const hHalfFov = computeHorizontalHalfFovRad(this.vFovDeg, this.aspect);
      targetNormX = target.thetaRad / (hHalfFov * STAGE_CONSTANTS.FAN_MARGIN_RATIO);
      targetNormY = target.customNormY;
    } else {
      const baseY = target.customBaseY ?? getTargetBaseY(target.kind, target.isItem);
      const worldPos = new THREE.Vector3(target.x, baseY + 0.35, target.z);
      camDist = this.projCamera.position.distanceTo(worldPos);

      const proj = worldPos.clone().project(this.projCamera);
      targetNormX = Math.max(-1, Math.min(1, proj.x / 0.94));
      targetNormY = Math.max(-1, Math.min(1, proj.y / 0.84));
    }

    const vFovRad = (this.vFovDeg * Math.PI) / 180;
    const tanHalfFov = Math.tan(vFovRad / 2);
    const baseHitRadius = (target.hitRadiusM * 2.8 * wideScopeMult) / Math.max(2.5, camDist * tanHalfFov);
    // Cards, the tutorial and the sandbox keep the generous legacy hit zone.
    const isCard = !!target.weaponSelectKind || !!target.rewardCardKind;
    const baseZoneScale = isCard || this.isTutorialMode || this.isSandboxMode ? 1.0 : GAME_TUNING.hitZone.scale;
    const zoneScale = isCard
      ? baseZoneScale
      : baseZoneScale * (1 + GAME_TUNING.cards.hitZoneUp.amount * this.cardStacks.hit_zone_up);
    const bossScale = target.kind === 'boss' && !isCard ? GAME_TUNING.boss.hitZoneScale : 1.0;
    const apparentHitRadius = Math.max(0.14, (baseHitRadius * zoneScale * bossScale) / 0.84);

    return { targetNormX, targetNormY, apparentHitRadius };
  }

  private handleMonsterKilled(target: ActiveTargetEntity, nowMs: number): void {
    if (this.gamePhase === 'VICTORY' || this.gamePhase === 'GAMEOVER') {
      return;
    }

    if (target.kind === 'boss' && (this.isSandboxMode || this.isTutorialMode)) {
      // Sandbox / tutorial bosses are just targets: no encounter flow, no victory
      return;
    }

    if (target.kind === 'boss') {
      if (this.getBossEntities().length > 0) return; // other bosses remain
      this.startBossClearSequence(target, nowMs);
      return;
    }

    if (this.bossClearUntilMs > 0) return; // 연출 중에는 분열·드롭·킬 카운트가 없다

    // 사격·스킬이 목록을 처리하는 도중일 수 있으므로 여기서 터뜨리지 않고 다음 update로 미룬다.
    if (target.kind === 'hanmac' && !this.isTutorialMode && !this.isSandboxMode && !target.isItem && !target.isProjectile) {
      this.pendingHanmacBlasts.push({ x: target.x, z: target.z });
    }

    if (!target.isItem && !target.isProjectile && !target.isGoldenCan && !target.weaponSelectKind && !target.rewardCardKind) {
      if (!this.isTutorialMode && !this.isSandboxMode) {
        if (target.kind === 'bottle' && !target.isSplitChild) {
          this.splitBottle(target);
        }

        // 1. 적 처치 랜덤 아이템 드롭 (필드 위 아이템 2개 미만 시)
        const currentItemCount = this.activeTargets.filter((t) => t.isItem).length;
        if (currentItemCount < 2) {
          const baseChance = target.isSummonedMinion ? GAME_TUNING.boss.summonDropChance : GAME_TUNING.itemDropChance;
          const dropProb = baseChance * this.getLuckyDropMultiplier();
          if (this.dropRng() < dropProb) {
            this.spawnItemTargetAt(nowMs, target.thetaRad, target.radiusM);
          }
        }

        // 2. 킬 게이지 누적 및 중도 카드 스폰
        const cardTarget = this.getCardKillTarget();
        this.cardKillCount += 1;
        if (cardTarget !== null && this.cardKillCount >= cardTarget) {
          this.cardKillCount = 0;
          if (!this.isRewardCardPending) {
            this.spawnWaveRewardCards(nowMs, false);
          }
        }
      }
    }
  }

  private getWeaponHitToleranceMult(weaponKind: WeaponKind): number {
    return GAME_TUNING.hitZone.toleranceByWeapon[weaponKind];
  }

  /**
   * 카드 선택 사격. 새로 누른 한 발만 카드를 고를 수 있고, 카드 밖 사격이나 입력 잠금 중 사격은
   * 탄약을 쓰지 않는다(fired: false).
   */
  private shootCardSelect(aimX: number, aimY: number, nowMs: number): EngineShootResult {
    if (this.rewardCardsSpawnTimeMs > 0 && nowMs - this.rewardCardsSpawnTimeMs < 800) {
      return { fired: false, grade: 'MISS' };
    }

    const isFever = this.scoreManager.getState().isFeverActive;
    const isPowerShot = this.isBuffActive('power_shot', nowMs);
    const isWideScope = this.isBuffActive('wide_scope', nowMs);
    const wideScopeMult = isWideScope ? 1.6 : 1.0;
    const weaponKind = this.weaponSystem.getState().weaponKind;
    const weaponHitToleranceMult = this.getWeaponHitToleranceMult(weaponKind);
    const verticalScale = weaponKind === 'revolver' ? 0.70 : 0.85;

    let bestHit: { target: ActiveTargetEntity; result: HitJudgmentResult } | undefined;
    let minError = Infinity;

    for (const target of this.activeTargets) {
      if (!target.weaponSelectKind && !target.rewardCardKind) continue;
      const proj = this.computeTargetAimCoords(target, wideScopeMult);
      const dx = aimX - proj.targetNormX;
      const dy = target.customNormY !== undefined
        ? (aimY - proj.targetNormY)
        : (aimY - proj.targetNormY) * verticalScale;
      const dist = Math.hypot(dx, dy);
      const effectiveHitRadius = proj.apparentHitRadius * weaponHitToleranceMult;
      if (dist > effectiveHitRadius) continue;

      const judgment = evaluateHitJudgment(dist, effectiveHitRadius, {
        isFeverActive: isFever,
        isPowerShotActive: isPowerShot,
        isWideScopeActive: isWideScope,
      });
      if (judgment.grade !== 'MISS' && judgment.errorRatio < minError) {
        minError = judgment.errorRatio;
        bestHit = { target, result: judgment };
      }
    }

    if (!bestHit) {
      return { fired: false, grade: 'MISS' };
    }

    const { target, result } = bestHit;
    let selectedWeapon: WeaponKind | undefined;
    let selectedCard: RewardCardKind | undefined;

    // 1. Shoot-to-Select Weapon Target
    if (target.weaponSelectKind) {
      selectedWeapon = target.weaponSelectKind;
      this.weaponSystem.selectWeapon(selectedWeapon, 1);
      this.activeTargets = this.activeTargets.filter((t) => !t.weaponSelectKind);
      this.isWeaponSelectPending = false;
      return {
        fired: true,
        grade: result.grade,
        target,
        killed: true,
        selectedWeapon,
        weaponKind: this.weaponSystem.getState().weaponKind,
        weaponLevel: this.weaponSystem.getState().weaponLevel,
      };
    }

    // 2. Shoot-to-Select Reward Card Target
    if (target.rewardCardKind) {
      selectedCard = target.rewardCardKind;

      this.applyRewardCard(selectedCard, nowMs);
      this.activeTargets = this.activeTargets.filter((t) => !t.rewardCardKind);
      this.isRewardCardPending = false;

      const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[STAGE_CONSTANTS.TOTAL_WAVES];
      const monsterTargets = this.activeTargets.filter(
        (t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind
      );
      const remainingMonsters = monsterTargets.length;
      const remainingSpawns = Math.max(0, waveDef.totalSpawns - this.spawnedInWave);

      if (this.pendingWaveAdvance || (remainingSpawns === 0 && remainingMonsters === 0)) {
        if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) {
          this.awardWaveTimeBonus(nowMs);
          this.declareVictory();
        } else {
          // A mid-wave card can arrive with the wave's last kill: pay the wave here (no-op if already paid)
          this.awardWaveTimeBonus(nowMs);
          this.startWave(this.currentWave + 1);
        }
      }

      return {
        fired: true,
        grade: result.grade,
        target,
        killed: true,
        selectedCard,
        weaponKind: this.weaponSystem.getState().weaponKind,
        weaponLevel: this.weaponSystem.getState().weaponLevel,
      };
    }
    return { fired: false, grade: 'MISS' };
  }

  /** Counts real shots (not card picks) for the precision bonus, then delegates to the shot pipeline. */
  public shootAt(
    aimX: number,
    aimY: number,
    nowMs: number,
    source: ShotSource = 'press'
  ): EngineShootResult {
    if (this.bossClearUntilMs > 0) return { fired: false, grade: 'MISS' };
    const counts = this.gamePhase === 'PLAYING' && !this.isPaused && !this.isCardSelectPending;
    const result = this.shootAtInner(aimX, aimY, nowMs, source);
    if (counts && result.fired) {
      this.shotStats[result.shieldBlocked ? 'MISS' : result.grade] += 1;
    }
    return result;
  }

  /** Linear time bonus: full at or under par, 0 at zeroAtParMult x par; boss waves are weighted. */
  public computeWaveTimeBonus(wave: number, elapsedSec: number): number {
    const cfg = GAME_TUNING.score.timeBonus;
    const def = this.waveDefinitions[wave];
    if (!def) return 0;
    const par = def.parTimeSec;
    const zero = par * cfg.zeroAtParMult;
    const ratio = zero > par ? Math.min(1, Math.max(0, (zero - elapsedSec) / (zero - par))) : elapsedSec <= par ? 1 : 0;
    const weight = def.boss ? cfg.bossWaveWeight : 1;
    return Math.round(cfg.maxPerWave * weight * ratio);
  }

  /** Pays the current wave's time bonus once (not in the tutorial or sandbox). */
  private awardWaveTimeBonus(nowMs: number): void {
    if (this.isTutorialMode || this.isSandboxMode || this.waveStartMs === null) return;
    if (this.lastWaveClear && this.lastWaveClear.wave === this.currentWave) return;
    const seconds = Math.max(0, (nowMs - this.waveStartMs) / 1000);
    const bonus = this.scoreManager.addBonusScore(this.computeWaveTimeBonus(this.currentWave, seconds));
    this.waveTimeBonusTotal += bonus;
    this.lastWaveClear = { wave: this.currentWave, seconds, bonus, atMs: nowMs };
    this.waveClears.push({ wave: this.currentWave, seconds, bonus });
  }

  public getScoreBreakdown(): { total: number; timeBonus: number; precisionBonus: number; levelBonus: number; base: number } {
    const total = this.scoreManager.getState().totalScore;
    const timeBonus = this.waveTimeBonusTotal;
    const precisionBonus = this.precisionBonusApplied;
    const levelBonus = this.levelBonusApplied;
    return { total, timeBonus, precisionBonus, levelBonus, base: total - timeBonus - precisionBonus - levelBonus };
  }

  /** Weighted accuracy of this run (0..1) and the bonus it earns at VICTORY. */
  public getPrecisionStats(): { shots: number; ratio: number; bonus: number; applied: number } {
    const cfg = GAME_TUNING.score.precisionBonus;
    const s = this.shotStats;
    const shots = s.PERFECT + s.GREAT + s.GOOD + s.MISS;
    const weighted = s.PERFECT * cfg.weights.PERFECT + s.GREAT * cfg.weights.GREAT + s.GOOD * cfg.weights.GOOD;
    const ratio = shots > 0 ? weighted / shots : 0;
    const bonus = shots >= cfg.minShots ? Math.round(cfg.k * Math.pow(ratio, cfg.power)) : 0;
    return { shots, ratio, bonus, applied: this.precisionBonusApplied };
  }

  /** 끝난 판의 통계. 7웨이브 정밀 보너스가 정산된 뒤의 값이 되도록 판이 끝난 뒤에만 돌려준다. */
  public getPlayRunStats(): PlayRunStats | null {
    if (this.gamePhase !== 'GAMEOVER' && this.gamePhase !== 'VICTORY') return null;
    const breakdown = this.getScoreBreakdown();
    const weapon = this.weaponSystem.getState();
    return {
      outcome: this.gamePhase,
      waveReached: this.currentWave,
      livesLeft: this.lives,
      durationSec: Number(this.playTimeSec.toFixed(2)),
      totalScore: breakdown.total,
      baseScore: breakdown.base,
      timeBonus: breakdown.timeBonus,
      precisionBonus: breakdown.precisionBonus,
      levelBonus: breakdown.levelBonus,
      maxCombo: this.scoreManager.getState().maxCombo,
      kills: this.totalKills,
      damageTaken: this.damageTaken,
      healedLives: this.healedLives,
      itemsCollected: this.itemsCollected,
      waves: this.waveClears.map((w) => ({ ...w, seconds: Number(w.seconds.toFixed(2)) })),
      shots: { ...this.shotStats },
      accuracy: Number(this.getPrecisionStats().ratio.toFixed(4)),
      weaponKind: weapon.weaponKind,
      weaponLevel: weapon.weaponLevel,
      cardStacks: { ...this.cardStacks },
    };
  }

  /** 적용 중인 패시브 카드. 즉시 효과 카드(레벨업, 수리, 피버 부스터)는 쌓이지 않으므로 없다. */
  public getPassiveCardStacks(): PassiveCardStack[] {
    const stacks: PassiveCardStack[] = [
      { kind: 'damage_up', count: this.cardStacks.damage_up },
      { kind: 'skill_cooldown', count: this.cardStacks.skill_cooldown },
      { kind: 'fever_extend', count: this.cardStacks.fever_extend },
      { kind: 'hit_zone_up', count: this.cardStacks.hit_zone_up },
      { kind: 'rapid_reload', count: this.weaponSystem.getRapidReloadStacks() },
      { kind: 'lucky_drop', count: this.luckyDropStacks },
    ];
    return stacks.filter((s) => s.count > 0);
  }

  private declareVictory(): void {
    if (this.gamePhase === 'VICTORY') return;
    this.gamePhase = 'VICTORY';
    this.clearSkillProjectiles();
    if (!this.isTutorialMode && !this.isSandboxMode) {
      // 레벨 보너스는 기본 점수에만 곱하므로 다른 보너스를 더하기 전에 계산한다.
      const { base } = this.getScoreBreakdown();
      const mult = GAME_TUNING.score.weaponLevelBonusMult[this.weaponSystem.getState().weaponLevel];
      this.precisionBonusApplied = this.scoreManager.addBonusScore(this.getPrecisionStats().bonus);
      this.levelBonusApplied = this.scoreManager.addBonusScore(base * (mult - 1));
    }
  }

  private shootAtInner(
    aimX: number,
    aimY: number,
    nowMs: number,
    source: ShotSource = 'press'
  ): EngineShootResult {
    if (this.isPaused) {
      return { fired: false, grade: 'MISS' };
    }

    if (this.gamePhase !== 'PLAYING' && this.gamePhase !== 'TUTORIAL' && this.gamePhase !== 'SANDBOX') {
      return { fired: false, grade: 'MISS' };
    }

    // Card selection: only a fresh press may pick a card (hold / fever auto-fire never selects one).
    if (this.isCardSelectPending) {
      if (source !== 'press') return { fired: false, grade: 'MISS' };
      return this.shootCardSelect(aimX, aimY, nowMs);
    }

    const isFever = this.scoreManager.getState().isFeverActive;
    const shot = this.weaponSystem.consumeShot(nowMs, isFever, source);
    if (!shot.fired) {
      return { fired: false, grade: 'MISS' };
    }

    const isPowerShot = this.isBuffActive('power_shot', nowMs);
    const isWideScope = this.isBuffActive('wide_scope', nowMs);
    const wideScopeMult = isWideScope ? 1.6 : 1.0;

    const weaponState = this.weaponSystem.getState();
    const weaponKind = weaponState.weaponKind;
    const weaponLevel = weaponState.weaponLevel;
    const levelSpec = this.weaponSystem.getCurrentLevelSpec();

    // Weapon-specific hit tolerance multiplier
    const weaponHitToleranceMult = this.getWeaponHitToleranceMult(weaponKind);

    const verticalScale = weaponKind === 'revolver' ? 0.70 : 0.85;

    // Find best target intersecting aim point
    let bestHit:
      | { target: ActiveTargetEntity; result: HitJudgmentResult; index: number }
      | undefined;
    let minError = Infinity;

    for (let i = 0; i < this.activeTargets.length; i++) {
      const target = this.activeTargets[i];
      if (!this.isTargetLanded(target, nowMs)) continue;
      const proj = this.computeTargetAimCoords(target, wideScopeMult);
      // Aim x spans half the screen width per unit, so convert to the vertical unit to get a round zone.
      // The tutorial and sandbox keep the legacy (uncorrected) zone their guidance assumes.
      const aspectFactor = this.isTutorialMode || this.isSandboxMode ? 1.0 : this.aspect;
      const dx = (aimX - proj.targetNormX) * aspectFactor;
      const dy = target.customNormY !== undefined
        ? (aimY - proj.targetNormY)
        : (aimY - proj.targetNormY) * verticalScale;
      const dist = Math.hypot(dx, dy);
      const effectiveHitRadius = proj.apparentHitRadius * weaponHitToleranceMult;

      if (dist <= effectiveHitRadius) {
        const judgment = evaluateHitJudgment(dist, effectiveHitRadius, {
          isFeverActive: isFever,
          isPowerShotActive: isPowerShot,
          isWideScopeActive: isWideScope,
        });
        if (judgment.grade !== 'MISS' && judgment.errorRatio < minError) {
          minError = judgment.errorRatio;
          bestHit = { target, result: judgment, index: i };
        }
      }
    }

    if (bestHit) {
      const { target, result, index } = bestHit;
      const hitTargets: ActiveTargetEntity[] = [target];
      let selectedWeapon: WeaponKind | undefined;
      let selectedCard: RewardCardKind | undefined;
      let interceptedProjectile = false;
      let goldenCanKilled = false;

      // 3. Projectile Interception
      if (target.isProjectile) {
        interceptedProjectile = true;
        this.activeTargets.splice(index, 1);
        const interceptInfo = this.scoreManager.registerHit('PERFECT', target.killBonusScore, true);
        return {
          fired: true,
          grade: 'PERFECT',
          target,
          killed: true,
          interceptedProjectile: true,
          earnedScore: interceptInfo.earnedScore,
          weaponKind,
          weaponLevel,
        };
      }

      // 4. Golden Can Bonus
      if (target.isGoldenCan) {
        goldenCanKilled = true;
        this.activeTargets.splice(index, 1);
        this.weaponSystem.addSkillStock(GAME_TUNING.goldenCan.skillStockGain);
        this.scoreManager.addFeverGauge(GAME_TUNING.goldenCan.feverGain);
        const hitInfo = this.scoreManager.registerHit('PERFECT', target.killBonusScore, true);
        return {
          fired: true,
          grade: 'PERFECT',
          target,
          killed: true,
          goldenCanKilled: true,
          earnedScore: hitInfo.earnedScore,
          weaponKind,
          weaponLevel,
        };
      }

      // Obi shield: blocks damage while raised. Only skills pierce it.
      if (target.isGuarding) {
        return {
          fired: true,
          grade: result.grade,
          target,
          hitTargets: [target],
          killed: false,
          shieldBlocked: true,
          weaponKind,
          weaponLevel,
        };
      }

      // 5. Standard Monster Damage & Weapon Ballistics
      const powerMult = isPowerShot ? 2.0 : 1.0;
      const judgmentMult = result.damageMultiplier;
      const weaponBonusMult = this.weaponSystem.getDamageBonusMultiplier();
      // Held rapid fire is weaker than tapping; fever auto-fire is exempt.
      const holdMult =
        source === 'hold' && !isFever && !this.isTutorialMode && !this.isSandboxMode
          ? GAME_TUNING.fire.holdDamageByWeapon[weaponKind]
          : 1.0;
      const bossScale = target.kind === 'boss' ? GAME_TUNING.boss.damageScaleByWeapon[weaponKind] : 1.0;
      const totalMult = powerMult * judgmentMult * weaponBonusMult * holdMult * bossScale;
      let damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));

      if (weaponKind === 'shotgun') {
        // Shotgun: Lv.1 GREAT = 3 * 0.35 * 1.0 = 1.05 (1HP 캔 원샷), GOOD = 1.05 * 0.8 = 0.84
        const baseDamage = levelSpec.pelletCount * levelSpec.damagePerHit;
        damage = Number((baseDamage * totalMult).toFixed(3));

        // Knockback on Lv.2+
        if (levelSpec.knockbackM > 0 && target.kind !== 'boss') {
          this.pushTargetBack(target, levelSpec.knockbackM);
        }
        // Lv.4 MAX slow
        if (levelSpec.slowDurationMs > 0 && target.kind !== 'boss') {
          target.slowUntilMs = nowMs + levelSpec.slowDurationMs;
          target.slowRatio = 0.3;
        }
      } else if (weaponKind === 'revolver') {
        // Revolver: Pierce through targets behind (sorted by distance ascending)
        damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));
        if (levelSpec.pierceCount > 0) {
          const rearTargets = this.activeTargets
            .filter(
              (t, idx) =>
                idx !== index &&
                !t.isItem &&
                !t.isProjectile &&
                !t.isGoldenCan &&
                !t.isGuarding &&
                this.isTargetLanded(t, nowMs) &&
                t.radiusM > target.radiusM &&
                Math.abs(t.thetaRad - target.thetaRad) <= 0.16
            )
            .sort((a, b) => a.radiusM - b.radiusM);

          rearTargets.slice(0, levelSpec.pierceCount).forEach((rear) => {
            const pierceDmg = Number((damage * levelSpec.pierceDamageRatio).toFixed(3));
            rear.hp = Number(Math.max(0, rear.hp - pierceDmg).toFixed(3));
            hitTargets.push(rear);
            if (rear.hp <= 0) {
              const rearIdx = this.activeTargets.indexOf(rear);
              if (rearIdx >= 0) {
                this.activeTargets.splice(rearIdx, 1);
                this.killedInWave += 1;
                this.totalKills += 1;
                this.scoreManager.registerHit('PERFECT', rear.killBonusScore, true);
                this.handleMonsterKilled(rear, nowMs);
              }
            }
          });
        }
      } else if (weaponKind === 'gatling') {
        damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));
      }

      // Apply damage to primary target
      target.hp = Number(Math.max(0, target.hp - damage).toFixed(3));
      const killed = target.hp <= 0;
      let activatedItem: ItemBuffKind | undefined;

      if (killed && target.isItem && target.itemKind) {
        this.itemsCollected += 1;
        this.activateItemBuff(target.itemKind, nowMs);
        activatedItem = target.itemKind;
      }

      const scoreMultiplier = weaponKind === 'gatling' ? 0.5 : 1.0;
      // Boss body hits give no fever: minions (and their drops) are how the player fills the gauge
      const feverMultiplier = target.kind === 'boss' ? 0 : weaponKind === 'gatling' ? 0.33 : 1.0;

      const hitInfo = this.scoreManager.registerHit(
        result.grade as Exclude<JudgmentGrade, 'MISS'>,
        killed ? target.killBonusScore : 0,
        killed,
        { scoreMultiplier, feverMultiplier }
      );

      if (killed) {
        const curIdx = this.activeTargets.indexOf(target);
        if (curIdx >= 0) {
          this.activeTargets.splice(curIdx, 1);
        }
        if (!target.isItem) {
          this.killedInWave += 1;
          this.totalKills += 1;
        }

        if (this.isTutorialMode) {
          if (this.tutorialStep === 1) {
            if (this.activeTargets.length === 0) {
              this.advanceTutorialStep(2);
            }
          } else if (this.tutorialStep === 2) {
            if (this.activeTargets.length === 0) {
              this.advanceTutorialStep(3);
            }
          } else if (this.tutorialStep === 3) {
            // The skill step only ends with the skill: if shots cleared the targets, set them up again.
            if (this.activeTargets.length === 0) {
              this.spawnTutorialSkillTargets();
            }
          } else if (this.tutorialStep === 4) {
            if (this.activeTargets.length === 0) {
              this.advanceTutorialStep('COMPLETED');
            }
          }
        }

        this.handleMonsterKilled(target, nowMs);
      }

      return {
        fired: true,
        grade: result.grade,
        target,
        hitTargets,
        killed,
        earnedScore: hitInfo.earnedScore,
        errorRatio: result.errorRatio,
        activatedItem,
        weaponKind,
        weaponLevel,
      };
    }

    // Miss shot
    this.scoreManager.applyMissPenalty();
    return {
      fired: true,
      grade: 'MISS',
      weaponKind,
      weaponLevel,
    };
  }

  /** 몬스터를 뒤로 민다. 등장 거리를 넘지 않고, 앞으로 끌어오지 않는다. */
  private pushTargetBack(target: ActiveTargetEntity, meters: number): void {
    if (meters <= 0) return;
    const next = Math.min(STAGE_CONSTANTS.SPAWN_RADIUS_M, target.radiusM + meters);
    const moved = next - target.radiusM;
    if (moved <= 0) return;
    target.radiusM = next;
    target.x = Math.sin(target.thetaRad) * next;
    target.z = -Math.cos(target.thetaRad) * next;
    target.swayPhaseOffsetRad = (target.swayPhaseOffsetRad ?? 0) - moved * 0.7;
  }

  /** 공격력 강화 카드까지 반영한 스킬 피해. 보스는 보스 피해 값을 쓴다. */
  private getSkillDamage(target: ActiveTargetEntity, levelSpec: WeaponLevelSpec): number {
    const base = target.kind === 'boss' ? levelSpec.skillBossDamage : levelSpec.skillDamage;
    return Number((base * this.weaponSystem.getDamageBonusMultiplier()).toFixed(3));
  }

  /** 스킬 피해를 주고, 죽었으면 점수와 웨이브 처리까지 한다. 죽었으면 true. */
  private applySkillDamage(monster: ActiveTargetEntity, damage: number, nowMs: number): boolean {
    monster.hp = Number(Math.max(0, monster.hp - damage).toFixed(3));
    if (monster.hp > 0) return false;
    const idx = this.activeTargets.indexOf(monster);
    if (idx < 0) return false;
    this.activeTargets.splice(idx, 1);
    this.killedInWave += 1;
    this.totalKills += 1;
    this.scoreManager.registerHit('PERFECT', monster.killBonusScore, true);
    this.handleMonsterKilled(monster, nowMs);
    return true;
  }

  public isBossClearSequence(): boolean {
    return this.bossClearUntilMs > 0;
  }

  public getBossClearUntilMs(): number {
    return this.bossClearUntilMs;
  }

  /** 화면이 포탄 발사 연출을 그리려고 가져간다. 돌려주고 비운다. */
  public drainProjectileLaunchEvents(): ProjectileLaunchEvent[] {
    const events = this.projectileLaunchEvents;
    this.projectileLaunchEvents = [];
    return events;
  }

  /** 화면이 보스 처치 연출을 그리려고 가져간다. 돌려주고 비운다. */
  public drainBossClearEvents(): BossClearEvent[] {
    const events = this.bossClearEvents;
    this.bossClearEvents = [];
    return events;
  }

  private resetBossClear(): void {
    this.bossClearUntilMs = 0;
    this.bossClearNextCascadeMs = 0;
    this.bossClearEvents = [];
    this.projectileLaunchEvents = [];
    this.pendingHanmacBlasts = [];
    this.hanmacBlastEvents = [];
  }

  /** 한맥 폭발을 처리한다. 폭발로 죽은 한맥은 큐에 다시 들어와 연쇄로 터지고, 죽은 대상은 목록에서 빠져 반복되지 않는다. */
  private processHanmacBlasts(nowMs: number): void {
    const { blastRadiusM, blastDamage } = GAME_TUNING.monsters.hanmac;
    while (this.pendingHanmacBlasts.length > 0) {
      if (this.bossClearUntilMs > 0) {
        this.pendingHanmacBlasts = [];
        return;
      }
      const blast = this.pendingHanmacBlasts.shift()!;
      this.hanmacBlastEvents.push({ x: blast.x, y: getTargetBaseY('hanmac', false) + 0.35, z: blast.z });
      if (this.hanmacBlastEvents.length > 32) this.hanmacBlastEvents.shift();
      const victims = this.activeTargets.filter(
        (t) =>
          t.kind !== 'boss' &&
          !t.isItem &&
          !t.isProjectile &&
          !t.isGoldenCan &&
          !t.weaponSelectKind &&
          !t.rewardCardKind &&
          this.isTargetLanded(t, nowMs) &&
          Math.hypot(t.x - blast.x, t.z - blast.z) <= blastRadiusM
      );
      for (const t of victims) {
        if (!this.activeTargets.includes(t)) continue;
        const killed = this.applySkillDamage(t, blastDamage, nowMs);
        this.pushSkillHitEvent({ source: 'blast', target: t, killed });
      }
    }
  }

  /** 화면이 한맥 폭발 연출을 그리려고 가져간다. 돌려주고 비운다. */
  public drainHanmacBlastEvents(): HanmacBlastEvent[] {
    const events = this.hanmacBlastEvents;
    this.hanmacBlastEvents = [];
    return events;
  }

  /** 마지막 보스가 죽으면 필드를 한꺼번에 비우지 않고 연출 시퀀스를 시작한다. */
  private startBossClearSequence(boss: ActiveTargetEntity, nowMs: number): void {
    this.isBossEncounterActive = false;
    this.awardWaveTimeBonus(nowMs);
    this.activeTargets = this.activeTargets.filter(
      (t) => !(t.isItem || t.isGoldenCan || t.isProjectile || t.weaponSelectKind || t.rewardCardKind)
    );
    // 한 타격이 카드 목표를 채우는 몬스터를 잡고 곧바로 마지막 보스까지 잡으면 카드가 이미 떠 있다. 카드 타깃은 위에서
    // 지웠으니 대기 상태도 풀어야 update()가 카드 대기로 영원히 멈추지 않는다. 웨이브 종료 카드는 연출 뒤에 새로 나온다.
    this.isRewardCardPending = false;
    this.pendingWaveAdvance = false;
    this.cardKillCount = 0;
    // 칼날·거품은 비우되, 같은 프레임에 이미 쌓인 타격 사건은 남겨 연출이 사라지지 않게 한다.
    this.activeSkillBlades = [];
    this.activeSkillFoamWaves = [];
    this.bossClearUntilMs = nowMs + GAME_TUNING.boss.clear.durationMs;
    this.bossClearNextCascadeMs = nowMs + GAME_TUNING.boss.clear.cascadeGapMs;
    this.bossClearEvents.push({
      type: 'defeated',
      x: boss.x,
      z: boss.z,
      y: boss.customBaseY ?? getTargetBaseY('boss', false),
    });
  }

  private advanceBossClear(nowMs: number, dtSec: number): void {
    const feverActive = this.scoreManager.getState().isFeverActive;
    this.weaponSystem.update(nowMs, feverActive, dtSec * 1000);
    this.scoreManager.updateFeverTimer(nowMs);

    if (nowMs >= this.bossClearNextCascadeMs) {
      this.bossClearNextCascadeMs += GAME_TUNING.boss.clear.cascadeGapMs;
      const next = this.activeTargets
        .filter((t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind)
        .sort((a, b) => a.radiusM - b.radiusM)[0];
      if (next) {
        this.activeTargets.splice(this.activeTargets.indexOf(next), 1);
        this.bossClearEvents.push({ type: 'cascade', target: next });
      }
    }

    if (nowMs >= this.bossClearUntilMs) {
      this.activeTargets = [];
      this.bossClearUntilMs = 0;
      if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) this.declareVictory();
      // A mid boss falls through to the wave-complete check in the next update, which deals the cards.
    }
  }

  /** 화면이 칼날·거품 타격 연출을 그리려고 가져간다. 돌려주고 비운다. */
  public drainSkillHitEvents(): SkillHitEvent[] {
    const events = this.skillHitEvents;
    this.skillHitEvents = [];
    return events;
  }

  /** 몬스터가 나타나는 좌우 범위(라디안 절반). */
  public getSkillFanHalfRangeRad(): number {
    return computeHorizontalHalfFovRad(this.vFovDeg, this.aspect) * STAGE_CONSTANTS.FAN_MARGIN_RATIO;
  }

  private clearSkillProjectiles(): void {
    this.activeSkillBlades = [];
    this.activeSkillFoamWaves = [];
    this.skillHitEvents = [];
  }

  private pushSkillHitEvent(event: SkillHitEvent): void {
    this.skillHitEvents.push(event);
    if (this.skillHitEvents.length > 128) this.skillHitEvents.shift();
  }

  private advanceSkillFoam(nowMs: number, dtSec: number): void {
    if (this.activeSkillFoamWaves.length === 0) return;
    const maxRadiusM = STAGE_CONSTANTS.SPAWN_RADIUS_M + 1;
    for (let w = this.activeSkillFoamWaves.length - 1; w >= 0; w--) {
      const wave = this.activeSkillFoamWaves[w];
      const sweepFrom = wave.prevRadiusM - 0.5;
      wave.prevRadiusM = wave.radiusM;
      wave.radiusM += GAME_TUNING.skills.foam.speedMps * dtSec;
      const candidates = this.activeTargets.filter(
        (t) =>
          !t.isItem && !t.isProjectile && !t.weaponSelectKind && !t.rewardCardKind && !t.isGoldenCan &&
          this.isTargetLanded(t, nowMs) &&
          !wave.hitTargetIds.has(t.id) &&
          t.radiusM <= wave.radiusM &&
          t.radiusM > sweepFrom
      );
      for (const t of candidates) {
        if (!this.activeTargets.includes(t)) continue;
        wave.hitTargetIds.add(t.id);
        const idsBefore = new Set(this.activeTargets.map((x) => x.id));
        const killed = this.applySkillDamage(t, t.kind === 'boss' ? wave.bossDamage : wave.damage, nowMs);
        // 분열로 새로 생긴 작은 병은 파도 뒤에서 태어난 것이므로 이 파도에 다시 맞지 않는다.
        for (const x of this.activeTargets) if (!idsBefore.has(x.id)) wave.hitTargetIds.add(x.id);
        if (!killed && t.kind !== 'boss') {
          t.slideRemainingM = Math.max(t.slideRemainingM ?? 0, wave.knockbackM);
          t.slowUntilMs = nowMs + wave.slowMs;
          t.slowRatio = wave.slowRatio;
        }
        this.pushSkillHitEvent({ source: 'foam', target: t, killed });
        if (this.bossClearUntilMs > 0) {
          this.activeSkillFoamWaves = [];
          return;
        }
      }
      if (wave.radiusM > maxRadiusM) this.activeSkillFoamWaves.splice(w, 1);
    }
  }

  private advanceSkillBlades(nowMs: number, dtSec: number): void {
    if (this.activeSkillBlades.length === 0) return;
    const { speedMps, halfWidthM } = GAME_TUNING.skills.blade;
    const maxRadiusM = STAGE_CONSTANTS.SPAWN_RADIUS_M + 1;
    for (let b = this.activeSkillBlades.length - 1; b >= 0; b--) {
      const blade = this.activeSkillBlades[b];
      const sweepFrom = blade.prevRadiusM - 0.5; // 안쪽으로 다가오는 몬스터를 놓치지 않는 여유
      blade.prevRadiusM = blade.radiusM;
      blade.radiusM += speedMps * dtSec;
      const candidates = this.activeTargets
        .filter(
          (t) =>
            !t.isItem && !t.weaponSelectKind && !t.rewardCardKind && !t.isGoldenCan &&
            this.isTargetLanded(t, nowMs) &&
            !blade.hitTargetIds.has(t.id) &&
            t.radiusM <= blade.radiusM &&
            t.radiusM > sweepFrom &&
            Math.cos(t.thetaRad - blade.thetaRad) > 0 &&
            Math.abs(t.radiusM * Math.sin(t.thetaRad - blade.thetaRad)) <= halfWidthM + t.hitRadiusM
        )
        .sort((a, c) => a.radiusM - c.radiusM);
      for (const t of candidates) {
        if (!this.activeTargets.includes(t)) continue; // 보스 처치가 필드를 비울 수 있다
        if (t.isProjectile) {
          this.activeTargets.splice(this.activeTargets.indexOf(t), 1);
          this.scoreManager.registerHit('PERFECT', t.killBonusScore, true);
          this.pushSkillHitEvent({ source: 'blade', target: t, killed: true });
          continue;
        }
        if (blade.hitsLeft <= 0) continue; // 남은 포탄은 계속 벤다
        blade.hitsLeft -= 1;
        blade.hitTargetIds.add(t.id);
        const idsBefore = new Set(this.activeTargets.map((x) => x.id));
        const killed = this.applySkillDamage(t, t.kind === 'boss' ? blade.bossDamage : blade.damage, nowMs);
        for (const x of this.activeTargets) if (!idsBefore.has(x.id)) blade.hitTargetIds.add(x.id);
        this.pushSkillHitEvent({ source: 'blade', target: t, killed });
        if (this.bossClearUntilMs > 0) {
          this.activeSkillBlades = [];
          return;
        }
      }
      if (blade.hitsLeft <= 0 || blade.radiusM > maxRadiusM) this.activeSkillBlades.splice(b, 1);
    }
  }

  public triggerWeaponSkill(nowMs: number): SkillExecuteResult {
    const result = this.runWeaponSkill(nowMs);
    if (result.activated && this.isTutorialMode && this.tutorialStep === 3) {
      this.advanceTutorialStep(4);
    }
    return result;
  }

  private runWeaponSkill(nowMs: number): SkillExecuteResult {
    const weaponState = this.weaponSystem.getState();
    const weaponKind = weaponState.weaponKind;
    const weaponLevel = weaponState.weaponLevel;
    const levelSpec = this.weaponSystem.getCurrentLevelSpec();

    if (this.isCardSelectPending || this.bossClearUntilMs > 0 || !this.weaponSystem.consumeSkill(nowMs)) {
      return {
        activated: false,
        weaponKind,
        weaponLevel,
        affectedTargets: [],
      };
    }

    const affectedTargets: ActiveTargetEntity[] = [];
    const activeMonsters = this.activeTargets.filter(
      (t) => !t.isItem && !t.weaponSelectKind && !t.rewardCardKind && !t.isProjectile && !t.isGoldenCan && this.isTargetLanded(t, nowMs)
    );

    if (weaponKind === 'shotgun') {
      // 1. 사방 뚫어뻥 폭풍: All active monsters take skill damage and get stunned
      for (let i = activeMonsters.length - 1; i >= 0; i--) {
        const monster = activeMonsters[i];
        if (monster.kind !== 'boss') {
          monster.stunUntilMs = nowMs + levelSpec.skillStunMs;
          monster.stuckPlungerCount = 2;
        }
        affectedTargets.push(monster);

        this.applySkillDamage(monster, this.getSkillDamage(monster, levelSpec), nowMs);
        if (this.bossClearUntilMs > 0) break;
      }
      return {
        activated: true,
        weaponKind,
        weaponLevel,
        affectedTargets,
        plungerCount: levelSpec.skillPlungerCount,
      };
    } else if (weaponKind === 'revolver') {
      // 2. 오프너 참격: 부채꼴 칼날. 피해는 칼날이 닿는 순간 advanceSkillBlades가 준다.
      const range = this.getSkillFanHalfRangeRad();
      const count = levelSpec.skillBladeCount;
      const bonus = this.weaponSystem.getDamageBonusMultiplier();
      for (let i = 0; i < count; i++) {
        this.skillEntityCounter += 1;
        this.activeSkillBlades.push({
          id: `blade_${this.skillEntityCounter}`,
          thetaRad: -range + ((2 * i + 1) * range) / count,
          radiusM: GAME_TUNING.skills.blade.startRadiusM,
          prevRadiusM: 0,
          hitsLeft: levelSpec.skillBladePierce + 1,
          hitTargetIds: new Set(),
          damage: Number((levelSpec.skillDamage * bonus).toFixed(3)),
          bossDamage: Number((levelSpec.skillBossDamage * bonus).toFixed(3)),
        });
      }
      return { activated: true, weaponKind, weaponLevel, affectedTargets, bladeCount: count };
    } else {
      // 3. 거품 해일: 필드 전체를 쓸고 가는 파도. 닿는 순간 advanceSkillFoam이 피해·둔화·밀기를 준다.
      this.skillEntityCounter += 1;
      const foam = GAME_TUNING.skills.foam;
      const bonus = this.weaponSystem.getDamageBonusMultiplier();
      this.activeSkillFoamWaves.push({
        id: `foam_${this.skillEntityCounter}`,
        radiusM: foam.startRadiusM,
        prevRadiusM: 0,
        hitTargetIds: new Set(),
        damage: Number((levelSpec.skillDamage * bonus).toFixed(3)),
        bossDamage: Number((levelSpec.skillBossDamage * bonus).toFixed(3)),
        knockbackM: levelSpec.skillKnockbackM,
        slowRatio: levelSpec.skillSlowRatio,
        slowMs: levelSpec.skillSlowMs,
        count: levelSpec.skillFoamCount,
      });
      return { activated: true, weaponKind, weaponLevel, affectedTargets, foamCount: levelSpec.skillFoamCount };
    }
  }
}
