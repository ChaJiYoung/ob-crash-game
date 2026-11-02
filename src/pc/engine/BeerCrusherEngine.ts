import { ActiveBuffState, GamePhase, ItemBuffKind, JudgmentGrade, TargetKind, TutorialStep } from '../../shared/types';
import { ITEM_BUFF_SPECS, STAGE_CONSTANTS, TARGET_SPECS } from '../../shared/constants';
import { advanceRadialTarget, computeHorizontalHalfFovRad, sampleFanSpawnPoint } from './FanSpawner';
import { evaluateHitJudgment, HitJudgmentResult } from './HitJudgment';
import { ScoreAndFeverManager } from './ScoreAndFeverManager';
import { WeaponSystem } from './WeaponSystem';

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
}

export interface TargetAimProjection {
  targetNormX: number;
  targetNormY: number;
  apparentHitRadius: number;
}

export interface EngineShootResult {
  fired: boolean;
  grade: JudgmentGrade;
  target?: ActiveTargetEntity;
  killed?: boolean;
  earnedScore?: number;
  errorRatio?: number;
  activatedItem?: ItemBuffKind;
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
}

export class BeerCrusherEngine {
  public gamePhase: GamePhase = 'PAIRING';
  public currentWave = 1;
  public lives: number = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
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

  private waveDefinitions: Record<number, WaveDefinition> = {
    1: {
      waveIndex: 1,
      totalSpawns: 16,
      maxSimultaneous: 4,
      spawnIntervalMs: 950,
      kinds: ['pilgood', 'caslight'],
      allowedItems: ['wide_scope'],
      includesBoss: false,
    },
    2: {
      waveIndex: 2,
      totalSpawns: 22,
      maxSimultaneous: 5,
      spawnIntervalMs: 850,
      kinds: ['obi', 'hanmac', 'pilgood'],
      allowedItems: ['power_shot', 'bar_repair'],
      includesBoss: false,
    },
    3: {
      waveIndex: 3,
      totalSpawns: 26,
      maxSimultaneous: 6,
      spawnIntervalMs: 800,
      kinds: ['bottle', 'caslight', 'obi', 'hanmac'],
      allowedItems: ['wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: false,
    },
    4: {
      waveIndex: 4,
      totalSpawns: 32,
      maxSimultaneous: 7,
      spawnIntervalMs: 700,
      kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'],
      allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: false,
    },
    5: {
      waveIndex: 5,
      totalSpawns: 18,
      maxSimultaneous: 5,
      spawnIntervalMs: 850,
      kinds: ['hanmac', 'bottle', 'pilgood', 'caslight'],
      allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: true,
    },
  };

  private spawnedInWave = 0;
  private killedInWave = 0;
  private bossSpawned = false;
  private lastSpawnTimeMs = 0;
  private targetCounter = 0;

  public aspect = 16 / 9;
  public vFovDeg = STAGE_CONSTANTS.CAMERA_FOV_DEG;

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

  public startGame(): void {
    this.gamePhase = 'PLAYING';
    this.isTutorialMode = false;
    this.isPaused = false;
    this.pausedAtMs = null;
    this.currentWave = 1;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.activeBuffUntilMs.clear();
    this.spawnedInWave = 0;
    this.killedInWave = 0;
    this.bossSpawned = false;
    this.scoreManager.reset();
    this.weaponSystem.reset();
  }

  public startTutorialMode(): void {
    this.gamePhase = 'TUTORIAL';
    this.isTutorialMode = true;
    this.isPaused = false;
    this.pausedAtMs = null;
    this.tutorialStep = 1;
    this.tutorialCompleted = false;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.activeBuffUntilMs.clear();
    this.scoreManager.reset();
    this.weaponSystem.reset();

    // Step 1: 3 static 1HP can targets
    this.spawnTutorialStep1Targets();
  }

  public spawnTutorialStep1Targets(): void {
    this.activeTargets = [];
    const positions = [
      { x: -2.8, z: -8.0, thetaRad: -0.35, kind: 'pilgood' as TargetKind },
      { x: 0.0, z: -8.0, thetaRad: 0.0, kind: 'caslight' as TargetKind },
      { x: 2.8, z: -8.0, thetaRad: 0.35, kind: 'obi' as TargetKind },
    ];
    positions.forEach((pos, idx) => {
      this.targetCounter += 1;
      const spec = TARGET_SPECS[pos.kind];
      this.activeTargets.push({
        id: `tutorial_step1_${idx + 1}`,
        kind: pos.kind,
        hp: 1,
        maxHp: 1,
        radiusM: 8.0,
        thetaRad: pos.thetaRad,
        x: pos.x,
        z: pos.z,
        speedMps: 0,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      });
    });
  }

  public advanceTutorialStep(nextStep: TutorialStep): void {
    this.tutorialStep = nextStep;
    this.activeTargets = [];

    if (nextStep === 2) {
      // Step 2: 1 approaching Cass bottle (3HP, speed = 1.6m/s)
      this.targetCounter += 1;
      const spec = TARGET_SPECS.bottle;
      this.activeTargets.push({
        id: `tutorial_step2_bottle`,
        kind: 'bottle',
        hp: 3,
        maxHp: 3,
        radiusM: 14.0,
        thetaRad: 0.0,
        x: 0,
        z: -14.0,
        speedMps: 1.6,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      });
    } else if (nextStep === 3) {
      // Step 3: Fill fever gauge to 100%
      this.scoreManager.forceSetFeverGauge(100);
    } else if (nextStep === 'COMPLETED') {
      this.tutorialCompleted = true;
    }
  }

  public spawnTutorialStep3Enemies(): void {
    this.activeTargets = [];
    const angles = [-0.45, -0.25, -0.08, 0.08, 0.25, 0.45];
    angles.forEach((angle, idx) => {
      this.targetCounter += 1;
      const kind: TargetKind = idx % 2 === 0 ? 'pilgood' : 'caslight';
      const spec = TARGET_SPECS[kind];
      const dist = 10.0 + (idx % 3) * 1.5;
      this.activeTargets.push({
        id: `tutorial_step3_${idx + 1}`,
        kind,
        hp: 1,
        maxHp: 1,
        radiusM: dist,
        thetaRad: angle,
        x: Math.sin(angle) * dist,
        z: -Math.cos(angle) * dist,
        speedMps: 1.8,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
      });
    });
  }

  public exitTutorialMode(): void {
    this.isTutorialMode = false;
    this.tutorialStep = 1;
    this.tutorialCompleted = false;
    this.isPaused = false;
    this.pausedAtMs = null;
    this.activeTargets = [];
    this.gamePhase = 'PAIRING';
    this.scoreManager.reset();
    this.weaponSystem.reset();
  }

  public startSandboxMode(): void {
    this.gamePhase = 'SANDBOX';
    this.isSandboxMode = true;
    this.isTutorialMode = false;
    this.isPaused = false;
    this.pausedAtMs = null;
    this.currentWave = 1;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.activeBuffUntilMs.clear();
    this.scoreManager.reset();
    this.weaponSystem.reset();
    this.spawnCalibrationFiveTargets();
  }

  public exitSandboxMode(): void {
    this.isSandboxMode = false;
    this.infiniteAmmo = false;
    this.weaponSystem.setInfiniteAmmo(false);
    this.isPaused = false;
    this.pausedAtMs = null;
    this.activeTargets = [];
    this.gamePhase = 'PAIRING';
    this.scoreManager.reset();
    this.weaponSystem.reset();
  }

  public setInfiniteAmmo(enabled: boolean): void {
    this.infiniteAmmo = enabled;
    this.weaponSystem.setInfiniteAmmo(enabled);
  }

  public triggerSandboxFever(nowMs: number = performance.now()): boolean {
    this.scoreManager.forceSetFeverGauge(100);
    return this.scoreManager.activateFever(nowMs);
  }

  public clearSandboxTargets(): void {
    this.activeTargets = [];
  }

  public spawnCalibrationFiveTargets(): ActiveTargetEntity[] {
    this.activeTargets = [];
    const points: {
      id: string;
      kind: TargetKind;
      thetaRad: number;
      radiusM: number;
      customNormY: number;
      customBaseY: number;
    }[] = [
      { id: 'calib_center', kind: 'pilgood', thetaRad: 0, radiusM: 9.0, customNormY: 0, customBaseY: 1.18 },
      { id: 'calib_left', kind: 'caslight', thetaRad: -0.42, radiusM: 9.0, customNormY: 0, customBaseY: 1.18 },
      { id: 'calib_right', kind: 'obi', thetaRad: 0.42, radiusM: 9.0, customNormY: 0, customBaseY: 1.18 },
      { id: 'calib_top', kind: 'hanmac', thetaRad: 0, radiusM: 9.0, customNormY: 0.55, customBaseY: 2.35 },
      { id: 'calib_bottom', kind: 'bottle', thetaRad: 0, radiusM: 9.0, customNormY: -0.55, customBaseY: 0.35 },
    ];

    points.forEach((pt) => {
      this.targetCounter += 1;
      const spec = TARGET_SPECS[pt.kind];
      this.activeTargets.push({
        id: pt.id,
        kind: pt.kind,
        hp: 1,
        maxHp: 1,
        radiusM: pt.radiusM,
        thetaRad: pt.thetaRad,
        x: Math.sin(pt.thetaRad) * pt.radiusM,
        z: -Math.cos(pt.thetaRad) * pt.radiusM,
        speedMps: 0,
        hitRadiusM: spec.hitRadiusM,
        killBonusScore: spec.killBonusScore,
        breached: false,
        customNormY: pt.customNormY,
        customBaseY: pt.customBaseY,
      });
    });

    return [...this.activeTargets];
  }

  public spawnSandboxTarget(kind: TargetKind, options?: SandboxSpawnOptions): ActiveTargetEntity {
    this.targetCounter += 1;
    const spec = TARGET_SPECS[kind];
    const isStationary = options?.stationary ?? false;
    const radiusM = options?.radiusM ?? (isStationary ? 9.5 : 16.0);
    const thetaRad = options?.thetaRad ?? (Math.random() * 0.7 - 0.35);

    const target: ActiveTargetEntity = {
      id: `sandbox_${this.targetCounter}_${kind}`,
      kind,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      radiusM,
      thetaRad,
      x: Math.sin(thetaRad) * radiusM,
      z: -Math.cos(thetaRad) * radiusM,
      speedMps: isStationary ? 0 : spec.speedMps,
      hitRadiusM: spec.hitRadiusM,
      killBonusScore: spec.killBonusScore,
      breached: false,
      customNormY: options?.customNormY,
      customBaseY: options?.customBaseY,
    };

    this.activeTargets.push(target);
    return target;
  }

  public getBossEntity(): ActiveTargetEntity | undefined {
    return this.activeTargets.find((t) => t.kind === 'boss');
  }

  public activateItemBuff(kind: ItemBuffKind, nowMs: number): void {
    if (kind === 'bar_repair') {
      this.lives = Math.min(STAGE_CONSTANTS.PLAYER_MAX_LIVES, this.lives + 1);
      return;
    }
    const spec = ITEM_BUFF_SPECS[kind];
    this.activeBuffUntilMs.set(kind, nowMs + spec.durationMs);
  }

  public isBuffActive(kind: ItemBuffKind, nowMs: number = Date.now()): boolean {
    const untilMs = this.activeBuffUntilMs.get(kind);
    return untilMs !== undefined && untilMs > nowMs;
  }

  public getActiveBuffs(nowMs: number = Date.now()): ActiveBuffState[] {
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
      kind: 'pilgood', // default fallback kind for schema
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

    // Clean expired buffs
    for (const [kind, untilMs] of this.activeBuffUntilMs.entries()) {
      if (nowMs >= untilMs) {
        this.activeBuffUntilMs.delete(kind);
      }
    }

    const feverState = this.scoreManager.getState();
    const { reloadedJustNow } = this.weaponSystem.update(nowMs, feverState.isFeverActive);
    this.scoreManager.updateFeverTimer(nowMs);

    // If tutorial Step 3 fever finished and was active, complete tutorial
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
      const effectiveSpeed = isIceFreeze && !target.isItem ? target.speedMps * 0.5 : target.speedMps;

      const next = advanceRadialTarget(
        { radiusM: target.radiusM, thetaRad: target.thetaRad },
        effectiveSpeed,
        dtSec
      );

      target.radiusM = next.radiusM;
      target.x = next.x;
      target.z = next.z;
      target.breached = next.breached;

      if (target.breached) {
        if (this.isSandboxMode) {
          // Sandbox mode: respawn target at 16.0m without life reduction
          target.radiusM = 16.0;
          target.x = Math.sin(target.thetaRad) * 16.0;
          target.z = -Math.cos(target.thetaRad) * 16.0;
          target.breached = false;
          continue;
        }

        if (this.isTutorialMode) {
          // Tutorial invulnerability: No life loss
          if (this.tutorialStep === 2) {
            // Respawn Cass bottle for continued rapid fire practice
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

        // Item targets advancing past defense line are simply removed without penalty
        if (target.isItem) {
          continue;
        }

        breaches.push(target);
        const damage = target.kind === 'boss' ? STAGE_CONSTANTS.PLAYER_MAX_LIVES : 1;
        this.lives = Math.max(0, this.lives - damage);

        if (this.lives <= 0) {
          this.gamePhase = 'GAMEOVER';
          return { breaches, phaseChanged: true, reloadedJustNow };
        }
      }
    }

    // Skip normal wave spawning in tutorial or sandbox mode
    if (this.isTutorialMode || this.isSandboxMode) {
      return { breaches, phaseChanged: false, reloadedJustNow };
    }

    // 2. Spawn targets if wave has remaining
    const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[5];
    const canSpawn =
      this.activeTargets.length < waveDef.maxSimultaneous &&
      this.spawnedInWave < waveDef.totalSpawns &&
      (this.spawnedInWave === 0 || nowMs - this.lastSpawnTimeMs >= waveDef.spawnIntervalMs);

    if (canSpawn) {
      this.spawnNextTarget(waveDef, nowMs);

      // Periodically spawn an item target if none currently active on screen
      const hasItemOnScreen = this.activeTargets.some((t) => t.isItem);
      if (
        !hasItemOnScreen &&
        this.spawnedInWave % 5 === 0 &&
        waveDef.allowedItems.length > 0 &&
        this.activeTargets.length < waveDef.maxSimultaneous
      ) {
        const itemKind =
          waveDef.allowedItems[Math.floor(Math.random() * waveDef.allowedItems.length)];
        this.spawnItemTarget(itemKind, nowMs);
      }
    }

    // 3. Spawn Boss in Wave 5 once normal wave spawns are done or halfway
    if (
      this.currentWave === 5 &&
      waveDef.includesBoss &&
      !this.bossSpawned &&
      (this.spawnedInWave >= 6 || this.activeTargets.filter((t) => !t.isItem).length <= 1)
    ) {
      this.spawnBoss(nowMs);
    }

    // 4. Check wave completion
    const monsterTargets = this.activeTargets.filter((t) => !t.isItem);
    const bossIsAlive = monsterTargets.some((t) => t.kind === 'boss');
    const waveComplete =
      this.spawnedInWave >= waveDef.totalSpawns &&
      monsterTargets.length === 0 &&
      (!waveDef.includesBoss || !bossIsAlive);

    if (waveComplete) {
      // Clear any leftover item targets between waves
      this.activeTargets = [];

      if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) {
        this.gamePhase = 'VICTORY';
        return { breaches, phaseChanged: true, reloadedJustNow };
      }
      this.currentWave += 1;
      this.spawnedInWave = 0;
      this.killedInWave = 0;
      this.bossSpawned = false;
      this.lastSpawnTimeMs = nowMs + 1000; // Brief respite between waves
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

    // Boss spawns directly forward in center (theta = 0)
    const pt = sampleFanSpawnPoint({
      vFovDeg: this.vFovDeg,
      aspect: this.aspect,
      rng: () => 0.5, // Center
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
    const hHalfFov = computeHorizontalHalfFovRad(this.vFovDeg, this.aspect);
    const targetNormX = target.thetaRad / (hHalfFov * STAGE_CONSTANTS.FAN_MARGIN_RATIO);

    let targetNormY = 0;
    if (target.customNormY !== undefined) {
      targetNormY = target.customNormY;
    } else {
      let visualCenterY = 0.72; // 지상 기본
      if (target.kind === 'pilgood' || target.kind === 'caslight') {
        visualCenterY = 1.55;
      } else if (target.isItem || target.kind === 'boss') {
        visualCenterY = 1.20;
      }
      const eyeRefY = 1.18;
      const deltaY = visualCenterY - eyeRefY;
      const vHalfFovRad = (this.vFovDeg * Math.PI) / 360;
      const effDist = Math.max(2.5, target.radiusM);
      targetNormY = Math.max(-0.85, Math.min(0.85, deltaY / (effDist * Math.tan(vHalfFovRad) * 0.76)));
    }

    const apparentHitRadius = Math.max(0.09, (target.hitRadiusM * 2.8 * wideScopeMult) / target.radiusM);

    return { targetNormX, targetNormY, apparentHitRadius };
  }

  public shootAt(aimX: number, aimY: number, nowMs: number): EngineShootResult {
    if (this.isPaused) {
      return { fired: false, grade: 'MISS' };
    }

    if (this.gamePhase !== 'PLAYING' && this.gamePhase !== 'TUTORIAL' && this.gamePhase !== 'SANDBOX') {
      return { fired: false, grade: 'MISS' };
    }

    const isFever = this.scoreManager.getState().isFeverActive;
    const shot = this.weaponSystem.consumeShot(nowMs, isFever);
    if (!shot.fired) {
      return { fired: false, grade: 'MISS' };
    }

    const isPowerShot = this.isBuffActive('power_shot', nowMs);
    const isWideScope = this.isBuffActive('wide_scope', nowMs);
    const wideScopeMult = isWideScope ? 1.6 : 1.0;

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
        : Math.min(Math.abs(aimY - proj.targetNormY), Math.abs(aimY) * 0.65) * 0.65;
      const dist = Math.hypot(dx, dy);

      if (dist <= proj.apparentHitRadius) {
        const judgment = evaluateHitJudgment(dist, proj.apparentHitRadius, {
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
      target.hp = Math.max(0, target.hp - result.damage);
      const killed = target.hp <= 0;
      let activatedItem: ItemBuffKind | undefined;

      if (killed && target.isItem && target.itemKind) {
        this.activateItemBuff(target.itemKind, nowMs);
        activatedItem = target.itemKind;
      }

      const hitInfo = this.scoreManager.registerHit(
        result.grade as Exclude<JudgmentGrade, 'MISS'>,
        killed ? target.killBonusScore : 0
      );

      if (killed) {
        this.activeTargets.splice(index, 1);
        if (!target.isItem) {
          this.killedInWave += 1;
        }

        // Tutorial progress triggers
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
      }

      return {
        fired: true,
        grade: result.grade,
        target,
        killed,
        earnedScore: hitInfo.earnedScore,
        errorRatio: result.errorRatio,
        activatedItem,
      };
    }

    // Miss shot
    this.scoreManager.applyMissPenalty();
    return {
      fired: true,
      grade: 'MISS',
    };
  }
}
