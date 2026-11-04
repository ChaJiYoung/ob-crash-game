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
  hanmacArrivedAtMs?: number;
  lastFireMs?: number;
  // Obi shield / bottle split
  guardPhaseMs?: number;
  isGuarding?: boolean;
  isSplitChild?: boolean;
  modelScaleMult?: number;
  // Boss king shield (invulnerable)
  isShielded?: boolean;
  // Roguelike & Gimmick extensions
  stunUntilMs?: number;
  slowUntilMs?: number;
  slowRatio?: number;
  stuckPlungerCount?: number;
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
  arcDeg?: number;
}

export interface WaveDefinition {
  waveIndex: number;
  totalSpawns: number;
  maxSimultaneous: number;
  spawnIntervalMs: number;
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
  private pausedAtMs: number | null = null;

  public readonly scoreManager = new ScoreAndFeverManager();
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
  public lastBossSummonTimeMs = 0;
  public lastBossSummonHpThreshold = 45;
  private bossShooterIndex = 0;
  private shieldKillCount = 0;
  private shieldThresholdIndex = 0;

  // Wave definitions
  private waveDefinitions: Record<number, WaveDefinition> = Object.fromEntries(
    GAME_TUNING.waves.map((w) => [
      w.waveIndex,
      {
        waveIndex: w.waveIndex,
        totalSpawns: w.totalSpawns,
        maxSimultaneous: w.maxSimultaneous,
        spawnIntervalMs: w.spawnIntervalMs,
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
    const killed = this.killedInWave;
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

  public setPaused(paused: boolean, nowMs: number = performance.now()): void {
    if (paused && !this.isPaused) {
      this.isPaused = true;
      this.pausedAtMs = nowMs;
    } else if (!paused && this.isPaused) {
      const pauseDurationMs = this.pausedAtMs !== null ? Math.max(0, nowMs - this.pausedAtMs) : 0;
      this.lastSpawnTimeMs += pauseDurationMs;
      for (const [kind, until] of this.activeBuffUntilMs.entries()) {
        this.activeBuffUntilMs.set(kind, until + pauseDurationMs);
      }
      this.scoreManager.shiftFeverTimer(pauseDurationMs);
      this.weaponSystem.shiftReloadTimer(pauseDurationMs);
      this.isPaused = false;
      this.pausedAtMs = null;
    }
  }

  public startGame(options?: { withWeaponSelect?: boolean }): void {
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
    this.isTutorialMode = false;
    this.isSandboxMode = false;
    this.luckyDropStacks = 0;
    this.cardKillCount = 0;
    this.pendingWaveAdvance = false;
    this.bossSummonActionUntilMs = 0;
    this.lastBossSummonTimeMs = 0;
    this.lastBossSummonHpThreshold = 45;
    this.scoreManager.reset();
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
    this.currentWave = Math.max(1, Math.min(STAGE_CONSTANTS.TOTAL_WAVES, waveIndex));
    this.spawnedInWave = 0;
    this.itemsSpawnedInWave = 0;
    this.killedInWave = 0;
    this.bossSpawned = false;
    this.isBossEncounterActive = false;
    this.lastSpawnTimeMs = 0;
    this.goldenCanSpawnedInWave = false;
    this.lastProjectileSpawnTimeMs = 0;
    this.isRewardCardPending = false;
    this.pendingWaveAdvance = false;
    this.cardKillCount = 0;
    this.bossSummonActionUntilMs = 0;
    this.lastBossSummonTimeMs = 0;
    this.lastBossSummonHpThreshold = 45;
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
        this.lives = Math.min(this.maxLives, this.lives + GAME_TUNING.repairCard.healAmount);
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
    sourceKind: 'hanmac' | 'boss',
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
      customNormY: 0.1,
      customBaseY: 1.45, // Projectile kind is 'pilgood' (now ground); keep the mesh at the aimed height
    };
    this.activeTargets.push(entity);
    return entity;
  }

  public startTutorialMode(): void {
    this.gamePhase = 'TUTORIAL';
    this.isTutorialMode = true;
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
      this.scoreManager.forceSetFeverGauge(100);
      this.activeTargets = [];
    } else if (nextStep === 'COMPLETED') {
      this.tutorialCompleted = true;
      this.activeTargets = [];
    }
  }

  public spawnTutorialStep3Enemies(): void {
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
    this.gamePhase = 'SANDBOX';
    this.isSandboxMode = true;
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
    if (this.isCardSelectPending) return false;
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

  public activateItemBuff(kind: ItemBuffKind, nowMs: number): void {
    const spec = ITEM_BUFF_SPECS[kind];
    if (kind === 'bar_repair') {
      this.lives = Math.min(this.maxLives, this.lives + 1);
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
    const itemKinds: ItemBuffKind[] = ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'];
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

  public spawnBossMinionWave(nowMs: number, count = 4): ActiveTargetEntity[] {
    this.lastBossSummonTimeMs = nowMs;
    this.bossSummonActionUntilMs = nowMs + 1800;
    const waveBoss = this.waveDefinitions[this.currentWave]?.boss;
    const kinds: readonly TargetKind[] = waveBoss
      ? waveBoss.summonKinds
      : ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'];
    const spawned: ActiveTargetEntity[] = [];

    for (let i = 0; i < count; i++) {
      this.targetCounter += 1;
      const kind = kinds[Math.floor(this.dropRng() * kinds.length)];
      const spec = TARGET_SPECS[kind];
      const theta = -0.42 + this.dropRng() * 0.84;
      const radius = 11.5 + this.dropRng() * 3.0;

      const entity: ActiveTargetEntity = {
        id: `boss_minion_${this.targetCounter}_${kind}`,
        kind,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        radiusM: radius,
        thetaRad: theta,
        initialThetaRad: theta,
        x: Math.sin(theta) * radius,
        z: -Math.cos(theta) * radius,
        speedMps: spec.speedMps * this.getWaveSpeedMultiplier(),
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      };
      this.applyMonsterTraits(entity);
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
    if (this.lastSpawnTimeMs > 0) this.lastSpawnTimeMs += deltaMs;
    if (this.lastProjectileSpawnTimeMs > 0) this.lastProjectileSpawnTimeMs += deltaMs;
    if (this.lastBossSummonTimeMs !== 0) this.lastBossSummonTimeMs += deltaMs;
    for (const target of this.activeTargets) {
      if (target.stunUntilMs !== undefined && target.stunUntilMs > 0) target.stunUntilMs += deltaMs;
      if (target.slowUntilMs !== undefined && target.slowUntilMs > 0) target.slowUntilMs += deltaMs;
      if (target.lastFireMs !== undefined) target.lastFireMs += deltaMs;
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
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    // While cards are pending the whole game clock stops: fever, buffs, skill cooldown, reload, spawns.
    if (!this.isTutorialMode && !this.isSandboxMode && this.isCardSelectPending) {
      const realElapsedMs = prevUpdateNowMs > 0 ? Math.max(0, nowMs - prevUpdateNowMs) : dtSec * 1000;
      this.freezeTimers(realElapsedMs);
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    this.updateGuards(nowMs);
    this.updateBossMovement(nowMs);
    this.updateKingShield();

    // Clean expired buffs
    for (const [kind, untilMs] of this.activeBuffUntilMs.entries()) {
      if (nowMs >= untilMs) {
        this.activeBuffUntilMs.delete(kind);
      }
    }

    const feverState = this.scoreManager.getState();
    const { reloadedJustNow } = this.weaponSystem.update(nowMs, feverState.isFeverActive, dtSec * 1000);
    this.scoreManager.updateFeverTimer(nowMs);

    if (this.isTutorialMode && this.tutorialStep === 3) {
      if (!this.scoreManager.getState().isFeverActive && this.scoreManager.getState().feverGauge === 0 && this.activeTargets.length === 0) {
        this.advanceTutorialStep('COMPLETED');
      }
    }

    const breaches: ActiveTargetEntity[] = [];
    const isIceFreeze = this.isBuffActive('ice_freeze', nowMs);

    // 1. Advance active targets radially
    for (let i = this.activeTargets.length - 1; i >= 0; i--) {
      const target = this.activeTargets[i];

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
          target.initialThetaRad + Math.sin(nowMs * swayFrequency + target.radiusM * 0.7) * swayAmplitudeRad;
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
      } else if (target.kind === 'hanmac' && isRegularPlay && isPlainMonster && next.radiusM <= GAME_TUNING.monsters.hanmac.stopRadiusM) {
        // Hanmac stops at range and bombards from its own position
        const stopRadiusM = GAME_TUNING.monsters.hanmac.stopRadiusM;
        target.radiusM = stopRadiusM;
        target.x = Math.sin(target.thetaRad) * stopRadiusM;
        target.z = -Math.cos(target.thetaRad) * stopRadiusM;
        target.breached = false;
        if (target.hanmacArrivedAtMs === undefined) {
          target.hanmacArrivedAtMs = nowMs;
          target.lastFireMs =
            nowMs - GAME_TUNING.monsters.hanmac.fireIntervalMs + GAME_TUNING.monsters.hanmac.firstShotDelayMs;
        }
        const fieldHasRoom = this.activeTargets.length < (this.waveDefinitions[this.currentWave]?.maxSimultaneous ?? 6) + 2;
        if (
          !isStunned &&
          fieldHasRoom &&
          nowMs - (target.lastFireMs ?? nowMs) >= GAME_TUNING.monsters.hanmac.fireIntervalMs
        ) {
          target.lastFireMs = nowMs;
          this.spawnMonsterProjectile(nowMs, 'hanmac', { thetaRad: target.thetaRad, radiusM: target.radiusM });
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
          } else if (this.tutorialStep === 3) {
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

    // 2. Periodic enemy spawn
    const canSpawn =
      this.activeTargets.length < waveDef.maxSimultaneous &&
      this.spawnedInWave < waveDef.totalSpawns &&
      (this.spawnedInWave === 0 || nowMs - this.lastSpawnTimeMs >= waveDef.spawnIntervalMs);

    if (canSpawn) {
      this.spawnNextTarget(waveDef, nowMs);

      // Golden Can once per wave at 50% spawn progress
      if (!this.goldenCanSpawnedInWave && this.spawnedInWave >= waveDef.totalSpawns * 0.5) {
        this.spawnGoldenCanTarget(nowMs);
      }
    }

    // Periodic projectile spawn from the boss (hanmac fires on its own timer in the movement loop)
    const hasBossShooter = this.activeTargets.some((t) => t.kind === 'boss');
    if (hasBossShooter && nowMs - this.lastProjectileSpawnTimeMs >= 3500 && this.activeTargets.length < waveDef.maxSimultaneous + 2) {
      // Living coolers fire in turns from their own position; the king fires only if no cooler is left
      const bosses = this.getBossEntities();
      const coolers = bosses.filter((b) => b.bossRole !== 'king');
      const shooters = coolers.length > 0 ? coolers : bosses;
      const shooter = shooters[this.bossShooterIndex % shooters.length];
      this.bossShooterIndex += 1;
      this.spawnMonsterProjectile(nowMs, 'boss', { thetaRad: shooter.thetaRad, radiusM: shooter.radiusM });
    }

    // Boss encounter: one shared summon timer for the whole fight (no charging; bosses summon minions instead)
    if (this.isBossEncounterActive) {
      const inRange = this.getBossEntities().some((b) => b.radiusM <= GAME_TUNING.boss.summonRadiusM);
      if (inRange && nowMs - this.lastBossSummonTimeMs >= GAME_TUNING.boss.summonIntervalMs) {
        const activeMinions = this.activeTargets.filter(
          (t) =>
            !t.isItem &&
            !t.isProjectile &&
            !t.isGoldenCan &&
            !t.weaponSelectKind &&
            !t.rewardCardKind &&
            t.kind !== 'boss'
        ).length;

        // Too many minions: skip now and check again next frame
        if (activeMinions < GAME_TUNING.boss.summonMaxActive) {
          this.spawnBossMinionWave(nowMs, GAME_TUNING.boss.summonCount);
        }
      }
    }

    // 4. Check wave completion
    const monsterTargets = this.activeTargets.filter((t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind);
    const bossAlive = monsterTargets.some((t) => t.kind === 'boss');
    const miniWaveDone =
      this.spawnedInWave >= waveDef.totalSpawns && monsterTargets.length === 0 && !bossAlive;

    if (miniWaveDone) {
      if (waveDef.boss && !this.bossSpawned) {
        this.spawnBossEncounter(nowMs);
        return { breaches, phaseChanged: false, reloadedJustNow };
      }

      this.activeTargets = [];
      // Between waves: Spawn Shoot-to-Select Reward Cards (the last wave always ends with its boss fight)
      this.spawnWaveRewardCards(nowMs, true);
      return { breaches, phaseChanged: true, reloadedJustNow };
    }

    return { breaches, phaseChanged: false, reloadedJustNow };
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

  /** 대왕 쉴드: 체력이 2/3, 1/3 아래로 내려가면 다시 켜진다. */
  private updateKingShield(): void {
    if (!this.isBossEncounterActive) return;
    const king = this.getBossEntities().find((b) => b.bossRole === 'king');
    if (!king || king.isShielded) return;
    const thresholds = GAME_TUNING.boss.shieldHpThresholds;
    const threshold = thresholds[this.shieldThresholdIndex];
    if (threshold !== undefined && king.hp <= king.maxHp * threshold) {
      king.isShielded = true;
      this.shieldThresholdIndex += 1;
      this.shieldKillCount = 0;
    }
  }

  private releaseKingShield(): void {
    const king = this.activeTargets.find((t) => t.kind === 'boss' && t.bossRole === 'king');
    if (king) king.isShielded = false;
    this.shieldKillCount = 0;
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

  /** 일반 몬스터 속도 배율: 웨이브마다 +4%. 보스·아이템·금색 캔·투사체에는 쓰지 않는다. */
  private getWaveSpeedMultiplier(): number {
    return 1 + GAME_TUNING.speedPerWave * (this.currentWave - 1);
  }

  /** 미니웨이브가 끝나면 냉각기(들)와 필요하면 대왕을 좌우로 벌려 등장시킨다. */
  private spawnBossEncounter(nowMs: number): void {
    const waveDef = this.waveDefinitions[this.currentWave];
    if (!waveDef?.boss) return;
    this.bossSpawned = true;
    this.isBossEncounterActive = true;
    this.lastBossSummonTimeMs = nowMs - GAME_TUNING.boss.summonIntervalMs + GAME_TUNING.boss.firstSummonDelayMs;
    this.lastBossSummonHpThreshold = 0;
    this.bossShooterIndex = 0;
    this.shieldKillCount = 0;
    this.shieldThresholdIndex = 0;

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
      king.isShielded = true;
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

    if (target.kind === 'boss') {
      if (target.bossRole === 'cooler') this.releaseKingShield();
      if (this.getBossEntities().length > 0) return; // other bosses remain
      this.isBossEncounterActive = false;
      this.activeTargets = [];
      this.isRewardCardPending = false;
      if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) {
        this.gamePhase = 'VICTORY';
      }
      // A mid boss falls through to the wave-complete check in the next update, which deals the cards.
      return;
    }

    if (!target.isItem && !target.isProjectile && !target.isGoldenCan && !target.weaponSelectKind && !target.rewardCardKind) {
      if (this.isBossEncounterActive) {
        this.shieldKillCount += 1;
        if (this.shieldKillCount >= GAME_TUNING.boss.shieldReleaseKills) this.releaseKingShield();
      }

      if (!this.isTutorialMode && !this.isSandboxMode) {
        if (target.kind === 'bottle' && !target.isSplitChild) {
          this.splitBottle(target);
        }

        // 1. 적 처치 랜덤 아이템 드롭 (필드 위 아이템 2개 미만 시)
        const currentItemCount = this.activeTargets.filter((t) => t.isItem).length;
        if (currentItemCount < 2) {
          const dropProb = 0.04 * this.getLuckyDropMultiplier();
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
          this.gamePhase = 'VICTORY';
        } else {
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

  public shootAt(
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
        this.scoreManager.registerHit('PERFECT', target.killBonusScore, true);
        return {
          fired: true,
          grade: 'PERFECT',
          target,
          killed: true,
          interceptedProjectile: true,
          earnedScore: target.killBonusScore,
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

      // King shield: invulnerable until minions or a cooler fall (fever does not help).
      if (target.isShielded) {
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

      // Obi shield: blocks damage while raised. Fever shots and skills pierce it.
      if (target.isGuarding && !isFever) {
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
      const feverMult = isFever ? 2.0 : 1.0;
      const judgmentMult = result.damageMultiplier;
      const weaponBonusMult = this.weaponSystem.getDamageBonusMultiplier();
      // Held rapid fire is weaker than tapping; fever auto-fire is exempt.
      const holdMult =
        source === 'hold' && !isFever && !this.isTutorialMode && !this.isSandboxMode
          ? GAME_TUNING.fire.holdDamageByWeapon[weaponKind]
          : 1.0;
      const totalMult = powerMult * feverMult * judgmentMult * weaponBonusMult * holdMult;
      let damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));

      if (weaponKind === 'shotgun') {
        // Shotgun: Lv.1 GREAT = 3 * 0.35 * 1.0 = 1.05 (1HP 캔 원샷), GOOD = 1.05 * 0.8 = 0.84
        const baseDamage = levelSpec.pelletCount * levelSpec.damagePerHit;
        damage = Number((baseDamage * totalMult).toFixed(3));

        // Knockback on Lv.2+
        if (levelSpec.knockbackM > 0 && target.kind !== 'boss') {
          target.radiusM = Math.min(16.0, target.radiusM + levelSpec.knockbackM);
        }
        // Lv.4 MAX slow
        if (levelSpec.slowDurationMs > 0) {
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
                (!t.isGuarding || isFever) &&
                !t.isShielded &&
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
        this.activateItemBuff(target.itemKind, nowMs);
        activatedItem = target.itemKind;
      }

      const scoreMultiplier = weaponKind === 'gatling' ? 0.5 : 1.0;
      const feverMultiplier = weaponKind === 'gatling' ? 0.33 : 1.0;

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

  public triggerWeaponSkill(nowMs: number): SkillExecuteResult {
    const weaponState = this.weaponSystem.getState();
    const weaponKind = weaponState.weaponKind;
    const weaponLevel = weaponState.weaponLevel;
    const levelSpec = this.weaponSystem.getCurrentLevelSpec();

    if (this.isCardSelectPending || !this.weaponSystem.consumeSkill(nowMs)) {
      return {
        activated: false,
        weaponKind,
        weaponLevel,
        affectedTargets: [],
      };
    }

    const affectedTargets: ActiveTargetEntity[] = [];
    const activeMonsters = this.activeTargets.filter(
      (t) => !t.isItem && !t.weaponSelectKind && !t.rewardCardKind && !t.isProjectile && !t.isGoldenCan
    );

    if (weaponKind === 'shotgun') {
      // 1. 사방 뚫어뻥 폭풍: All active monsters take skill damage and get stunned
      for (let i = activeMonsters.length - 1; i >= 0; i--) {
        const monster = activeMonsters[i];
        const dmg = monster.kind === 'boss' ? levelSpec.skillBossDamage : levelSpec.skillDamage;
        if (!monster.isShielded) monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
        monster.stunUntilMs = nowMs + levelSpec.skillStunMs;
        monster.stuckPlungerCount = 2;
        affectedTargets.push(monster);

        if (monster.hp <= 0) {
          const idx = this.activeTargets.indexOf(monster);
          if (idx >= 0) {
            this.activeTargets.splice(idx, 1);
            this.killedInWave += 1;
            this.scoreManager.registerHit('PERFECT', monster.killBonusScore, true);
            this.handleMonsterKilled(monster, nowMs);
            if (this.gamePhase === 'VICTORY') break;
          }
        }
      }
      return {
        activated: true,
        weaponKind,
        weaponLevel,
        affectedTargets,
        plungerCount: levelSpec.skillPlungerCount,
      };
    } else if (weaponKind === 'revolver') {
      // 2. 오프너 불릿 타임 & 참격: All monsters get slowed & slashed
      for (let i = activeMonsters.length - 1; i >= 0; i--) {
        const monster = activeMonsters[i];
        const dmg = monster.kind === 'boss' ? levelSpec.skillBossDamage : levelSpec.skillDamage;
        if (!monster.isShielded) monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
        monster.slowUntilMs = nowMs + levelSpec.skillSlowMs;
        monster.slowRatio = levelSpec.skillSlowRatio;
        affectedTargets.push(monster);

        if (monster.hp <= 0) {
          const idx = this.activeTargets.indexOf(monster);
          if (idx >= 0) {
            this.activeTargets.splice(idx, 1);
            this.killedInWave += 1;
            this.scoreManager.registerHit('PERFECT', monster.killBonusScore, true);
            this.handleMonsterKilled(monster, nowMs);
            if (this.gamePhase === 'VICTORY') break;
          }
        }
      }
      return {
        activated: true,
        weaponKind,
        weaponLevel,
        affectedTargets,
      };
    } else {
      // 3. gatling: 거품 해일 160도 오버히트: Arc knockback & slow
      const halfArcRad = ((levelSpec.skillArcDeg / 2) * Math.PI) / 180;
      for (let i = activeMonsters.length - 1; i >= 0; i--) {
        const monster = activeMonsters[i];
        if (Math.abs(monster.thetaRad) <= halfArcRad) {
          const dmg = monster.kind === 'boss' ? levelSpec.skillBossDamage : levelSpec.skillDamage;
          if (!monster.isShielded) monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
          if (monster.kind !== 'boss') {
            monster.radiusM = Math.min(16.0, monster.radiusM + levelSpec.skillKnockbackM);
          }
          monster.slowUntilMs = nowMs + levelSpec.skillSlowMs;
          monster.slowRatio = levelSpec.skillSlowRatio;
          affectedTargets.push(monster);

          if (monster.hp <= 0) {
            const idx = this.activeTargets.indexOf(monster);
            if (idx >= 0) {
              this.activeTargets.splice(idx, 1);
              this.killedInWave += 1;
              this.scoreManager.registerHit('PERFECT', monster.killBonusScore, true);
              this.handleMonsterKilled(monster, nowMs);
              if (this.gamePhase === 'VICTORY') break;
            }
          }
        }
      }
      return {
        activated: true,
        weaponKind,
        weaponLevel,
        affectedTargets,
        arcDeg: levelSpec.skillArcDeg,
      };
    }
  }
}
