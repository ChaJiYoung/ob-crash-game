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
  isEnraged?: boolean;
  // Roguelike & Gimmick extensions
  stunUntilMs?: number;
  slowUntilMs?: number;
  slowRatio?: number;
  stuckPlungerCount?: number;
  isGoldenCan?: boolean;
  isProjectile?: boolean;
  weaponSelectKind?: WeaponKind;
  rewardCardKind?: RewardCardKind;
}

export interface TargetAimProjection {
  targetNormX: number;
  targetNormY: number;
  apparentHitRadius: number;
}

/** 발사 입력 종류: 새로 누름 / 누른 채 연사 / 피버 자동 발사. 카드 선택은 'press'만 허용한다. */
export type ShotSource = 'press' | 'hold' | 'fever';

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
  includesBoss: boolean;
}

export interface SandboxSpawnOptions {
  stationary?: boolean;
  thetaRad?: number;
  radiusM?: number;
  customNormY?: number;
  customBaseY?: number;
  initialThetaRad?: number;
  isEnraged?: boolean;
}

export interface WaveProgressInfo {
  wave: number;
  totalWaves: number;
  killedInWave: number;
  totalSpawns: number;
  remainingInWave: number;
  progressPercent: number;
  cardKillCount: number;
  cardKillTarget: number;
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
  private waveCardKillTargets: Record<number, number> = { 1: 10, 2: 14, 3: 18, 4: 20, 5: 15 };
  public dropRng: () => number = () => Math.random();

  // Boss summon state
  public bossSummonActionUntilMs = 0;
  public lastBossSummonTimeMs = 0;
  public lastBossSummonHpThreshold = 45;

  // Wave definitions
  private waveDefinitions: Record<number, WaveDefinition> = {
    1: {
      waveIndex: 1,
      totalSpawns: 24,
      maxSimultaneous: 4,
      spawnIntervalMs: 950,
      kinds: ['pilgood', 'caslight'],
      allowedItems: [],
      includesBoss: false,
    },
    2: {
      waveIndex: 2,
      totalSpawns: 32,
      maxSimultaneous: 5,
      spawnIntervalMs: 850,
      kinds: ['obi', 'hanmac', 'pilgood'],
      allowedItems: [],
      includesBoss: false,
    },
    3: {
      waveIndex: 3,
      totalSpawns: 40,
      maxSimultaneous: 6,
      spawnIntervalMs: 800,
      kinds: ['bottle', 'caslight', 'obi', 'hanmac'],
      allowedItems: [],
      includesBoss: false,
    },
    4: {
      waveIndex: 4,
      totalSpawns: 48,
      maxSimultaneous: 7,
      spawnIntervalMs: 700,
      kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'],
      allowedItems: [],
      includesBoss: false,
    },
    5: {
      waveIndex: 5,
      totalSpawns: 35,
      maxSimultaneous: 6,
      spawnIntervalMs: 800,
      kinds: ['hanmac', 'bottle', 'pilgood', 'caslight'],
      allowedItems: [],
      includesBoss: true,
    },
  };

  private spawnedInWave = 0;
  private itemsSpawnedInWave = 0;
  private killedInWave = 0;
  private bossSpawned = false;
  private lastSpawnTimeMs = 0;
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

  public getCardKillTarget(waveIndex: number = this.currentWave): number {
    return this.waveCardKillTargets[waveIndex] ?? 15;
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
    this.activeBuffUntilMs.clear();

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

  public spawnWaveRewardCards(nowMs: number, isWaveClear = true): void {
    this.isRewardCardPending = true;
    this.rewardCardsSpawnTimeMs = nowMs;
    this.pendingWaveAdvance = isWaveClear;

    // Clean existing reward card targets if any
    this.activeTargets = this.activeTargets.filter((t) => !t.rewardCardKind);

    const slot1: RewardCardKind = 'weapon_level_up';
    const slot2: RewardCardKind = this.luckyDropStacks < 3 ? 'lucky_drop' : 'rapid_reload';
    const slot3: RewardCardKind =
      this.lives < this.maxLives
        ? 'bar_repair'
        : this.luckyDropStacks < 3
        ? 'rapid_reload'
        : 'fever_boost';

    const candidateCards: RewardCardKind[] = [slot1, slot2, slot3];
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
        this.maxLives += 1;
        this.lives = this.maxLives;
        break;
      case 'lucky_drop':
        this.luckyDropStacks = Math.min(3, this.luckyDropStacks + 1);
        break;
      case 'fever_boost':
        this.scoreManager.chargeFeverToMax();
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

  public spawnMonsterProjectile(nowMs: number, sourceKind: 'hanmac' | 'boss'): ActiveTargetEntity {
    this.lastProjectileSpawnTimeMs = nowMs;
    this.targetCounter += 1;
    const existingAngles = this.activeTargets.map((t) => t.thetaRad);
    const pt = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      existingAnglesRad: existingAngles,
    });

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
    };
    this.activeTargets.push(entity);
    return entity;
  }

  public startTutorialMode(): void {
    this.gamePhase = 'TUTORIAL';
    this.isTutorialMode = true;
    this.tutorialStep = 1;
    this.tutorialCompleted = false;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.scoreManager.reset();
    this.weaponSystem.reset();
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

  public getBossEntity(): ActiveTargetEntity | undefined {
    return this.activeTargets.find((t) => t.kind === 'boss');
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
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.scoreManager.reset();
    this.weaponSystem.reset();
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
      isEnraged: options.isEnraged,
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
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'];
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
        speedMps: spec.speedMps,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      };
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
    if (this.lastBossSummonTimeMs > 0) this.lastBossSummonTimeMs += deltaMs;
  }

  public update(nowMs: number, dtSec: number): {
    breaches: ActiveTargetEntity[];
    phaseChanged: boolean;
    reloadedJustNow: boolean;
  } {
    if (this.isPaused) {
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    if (this.gamePhase !== 'PLAYING' && this.gamePhase !== 'TUTORIAL' && this.gamePhase !== 'SANDBOX') {
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    // While cards are pending the whole game clock stops: fever, buffs, skill cooldown, reload, spawns.
    if (!this.isTutorialMode && !this.isSandboxMode && this.isCardSelectPending) {
      this.freezeTimers(dtSec * 1000);
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
        if (target.kind === 'hanmac' && target.isEnraged) {
          effectiveSpeed *= 1.3;
        }
      }

      // S-curve flight trajectory for airborne targets
      if (!target.isItem && !target.isGoldenCan && (target.kind === 'pilgood' || target.kind === 'caslight') && target.initialThetaRad !== undefined) {
        if (target.kind === 'pilgood') {
          target.thetaRad = target.initialThetaRad + Math.sin(nowMs * 0.003 + target.radiusM * 0.4) * 0.08;
        } else if (target.kind === 'caslight') {
          target.thetaRad = target.initialThetaRad + Math.sin(nowMs * 0.006 + target.radiusM * 0.7) * 0.06;
        }
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
        if (next.radiusM <= 10.0) {
          target.radiusM = 10.0;
          target.x = Math.sin(target.thetaRad) * 10.0;
          target.z = -Math.cos(target.thetaRad) * 10.0;
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

    const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[5];

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

    // Periodic projectile spawn if Hanmac or Boss on field
    const hasShooter = this.activeTargets.some((t) => t.kind === 'hanmac' || t.kind === 'boss');
    if (hasShooter && nowMs - this.lastProjectileSpawnTimeMs >= 3500 && this.activeTargets.length < waveDef.maxSimultaneous + 2) {
      const shooter = this.activeTargets.find((t) => t.kind === 'boss') ? 'boss' : 'hanmac';
      this.spawnMonsterProjectile(nowMs, shooter);
    }

    // 3. Spawn Boss in Wave 5
    if (
      this.currentWave === 5 &&
      waveDef.includesBoss &&
      !this.bossSpawned &&
      (this.spawnedInWave >= 15 || this.activeTargets.filter((t) => !t.isItem && !t.isProjectile).length <= 1)
    ) {
      this.spawnBoss(nowMs);
    }

    // Boss Summon Action in Wave 5
    if (this.currentWave === 5 && this.bossSpawned) {
      const boss = this.getBossEntity();
      if (boss && boss.hp > 0 && boss.radiusM <= 12.5) {
        const timeTrigger = this.lastBossSummonTimeMs === 0 || nowMs - this.lastBossSummonTimeMs >= 9000;
        const hpTrigger = this.lastBossSummonHpThreshold > 0 && boss.hp <= this.lastBossSummonHpThreshold;

        if (timeTrigger || hpTrigger) {
          if (hpTrigger) {
            this.lastBossSummonHpThreshold -= 15;
          }
          const activeMinions = this.activeTargets.filter(
            (t) =>
              !t.isItem &&
              !t.isProjectile &&
              !t.isGoldenCan &&
              !t.weaponSelectKind &&
              !t.rewardCardKind &&
              t.kind !== 'boss'
          ).length;

          if (activeMinions < 7) {
            this.spawnBossMinionWave(nowMs, 4);
          }
        }
      }
    }

    // 4. Check wave completion
    const monsterTargets = this.activeTargets.filter((t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind);
    const bossIsAlive = monsterTargets.some((t) => t.kind === 'boss');
    const waveComplete =
      this.spawnedInWave >= waveDef.totalSpawns &&
      monsterTargets.length === 0 &&
      (!waveDef.includesBoss || !bossIsAlive);

    if (waveComplete) {
      this.activeTargets = [];

      if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) {
        this.gamePhase = 'VICTORY';
        return { breaches, phaseChanged: true, reloadedJustNow };
      }

      // Between waves: Spawn Shoot-to-Select Reward Cards
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
      speedMps: spec.speedMps,
      hitRadiusM: spec.hitRadiusM,
      killBonusScore: spec.killBonusScore,
      breached: false,
    };

    this.activeTargets.push(entity);
    this.spawnedInWave += 1;
    this.lastSpawnTimeMs = nowMs;
  }

  private spawnBoss(nowMs: number): void {
    this.bossSpawned = true;
    const spec = TARGET_SPECS.boss;

    const pt = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      rng: () => 0.5,
    });

    this.targetCounter += 1;
    const bossEntity: ActiveTargetEntity = {
      id: `boss_${this.targetCounter}`,
      kind: 'boss',
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      radiusM: pt.radiusM,
      thetaRad: 0,
      x: 0,
      z: -pt.radiusM,
      speedMps: spec.speedMps,
      hitRadiusM: spec.hitRadiusM,
      killBonusScore: spec.killBonusScore,
      breached: false,
    };

    this.activeTargets.push(bossEntity);
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
    const apparentHitRadius = Math.max(0.14, baseHitRadius / 0.84);

    return { targetNormX, targetNormY, apparentHitRadius };
  }

  private handleMonsterKilled(target: ActiveTargetEntity, nowMs: number): void {
    if (this.gamePhase === 'VICTORY' || this.gamePhase === 'GAMEOVER') {
      return;
    }

    if (target.kind === 'boss') {
      this.activeTargets = [];
      this.isRewardCardPending = false;
      this.gamePhase = 'VICTORY';
      return;
    }

    if (!target.isItem && !target.isProjectile && !target.isGoldenCan && !target.weaponSelectKind && !target.rewardCardKind) {
      if (!this.isTutorialMode && !this.isSandboxMode) {
        // 1. 적 처치 랜덤 아이템 드롭 (필드 위 아이템 2개 미만 시)
        const currentItemCount = this.activeTargets.filter((t) => t.isItem).length;
        if (currentItemCount < 2) {
          const dropProb = 0.04 * this.getLuckyDropMultiplier();
          if (this.dropRng() < dropProb) {
            this.spawnItemTargetAt(nowMs, target.thetaRad, target.radiusM);
          }
        }

        // 2. 킬 게이지 누적 및 중도 카드 스폰
        this.cardKillCount += 1;
        if (this.cardKillCount >= this.getCardKillTarget()) {
          this.cardKillCount = 0;
          if (!this.isRewardCardPending) {
            this.spawnWaveRewardCards(nowMs, false);
          }
        }
      }
    }
  }

  private getWeaponHitToleranceMult(weaponKind: WeaponKind): number {
    return weaponKind === 'shotgun' ? 1.55 : weaponKind === 'gatling' ? 1.05 : 0.95; // revolver
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

      const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[5];
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
    const shot = this.weaponSystem.consumeShot(nowMs, isFever);
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
      const dx = aimX - proj.targetNormX;
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
        this.weaponSystem.refillSkillInstant();
        this.scoreManager.chargeFeverToMax();
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

      // 5. Standard Monster Damage & Weapon Ballistics
      const powerMult = isPowerShot ? 2.0 : 1.0;
      const feverMult = isFever ? 2.0 : 1.0;
      const judgmentMult = result.damageMultiplier;
      const weaponBonusMult = this.weaponSystem.getDamageBonusMultiplier();
      const totalMult = powerMult * feverMult * judgmentMult * weaponBonusMult;
      let damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));

      if (weaponKind === 'shotgun') {
        // Shotgun: Lv.1 GREAT = 3 * 0.35 * 1.0 = 1.05 (1HP 캔 원샷), GOOD = 1.05 * 0.8 = 0.84
        const baseDamage = levelSpec.pelletCount * levelSpec.damagePerHit;
        damage = Number((baseDamage * totalMult).toFixed(3));

        // Knockback on Lv.2+
        if (levelSpec.knockbackM > 0) {
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

      if (!killed && target.kind === 'hanmac') {
        target.isEnraged = true;
      }

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
        monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
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
        monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
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
          monster.hp = Number(Math.max(0, monster.hp - dmg).toFixed(3));
          monster.radiusM = Math.min(16.0, monster.radiusM + levelSpec.skillKnockbackM);
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
