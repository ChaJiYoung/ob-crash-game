import { GamePhase, JudgmentGrade, TargetKind } from '../../shared/types';
import { STAGE_CONSTANTS, TARGET_SPECS } from '../../shared/constants';
import { advanceRadialTarget, sampleFanSpawnPoint } from './FanSpawner';
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
}

export interface EngineShootResult {
  fired: boolean;
  grade: JudgmentGrade;
  target?: ActiveTargetEntity;
  killed?: boolean;
  earnedScore?: number;
  errorRatio?: number;
}

export interface WaveDefinition {
  waveIndex: number;
  totalSpawns: number;
  maxSimultaneous: number;
  kinds: TargetKind[];
  includesBoss: boolean;
}

export class BeerCrusherEngine {
  public gamePhase: GamePhase = 'PAIRING';
  public currentWave = 1;
  public lives: number = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
  public activeTargets: ActiveTargetEntity[] = [];

  public readonly scoreManager = new ScoreAndFeverManager();
  public readonly weaponSystem = new WeaponSystem();

  private waveDefinitions: Record<number, WaveDefinition> = {
    1: {
      waveIndex: 1,
      totalSpawns: 10,
      maxSimultaneous: 4,
      kinds: ['pilgood', 'caslight', 'obi', 'mug'],
      includesBoss: false,
    },
    2: {
      waveIndex: 2,
      totalSpawns: 15,
      maxSimultaneous: 5,
      kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'mug'],
      includesBoss: false,
    },
    3: {
      waveIndex: 3,
      totalSpawns: 12,
      maxSimultaneous: 4,
      kinds: ['hanmac', 'mug', 'pilgood', 'caslight'],
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

  public startGame(): void {
    this.gamePhase = 'PLAYING';
    this.currentWave = 1;
    this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES;
    this.activeTargets = [];
    this.spawnedInWave = 0;
    this.killedInWave = 0;
    this.bossSpawned = false;
    this.scoreManager.reset();
    this.weaponSystem.reset();
  }

  public getBossEntity(): ActiveTargetEntity | undefined {
    return this.activeTargets.find((t) => t.kind === 'boss');
  }

  public update(nowMs: number, dtSec: number): {
    breaches: ActiveTargetEntity[];
    phaseChanged: boolean;
    reloadedJustNow: boolean;
  } {
    if (this.gamePhase !== 'PLAYING') {
      return { breaches: [], phaseChanged: false, reloadedJustNow: false };
    }

    const feverState = this.scoreManager.getState();
    const { reloadedJustNow } = this.weaponSystem.update(nowMs, feverState.isFeverActive);
    this.scoreManager.updateFeverTimer(nowMs);

    const breaches: ActiveTargetEntity[] = [];

    // 1. Advance active targets radially
    for (let i = this.activeTargets.length - 1; i >= 0; i--) {
      const target = this.activeTargets[i];
      const next = advanceRadialTarget(
        { radiusM: target.radiusM, thetaRad: target.thetaRad },
        target.speedMps,
        dtSec
      );

      target.radiusM = next.radiusM;
      target.x = next.x;
      target.z = next.z;
      target.breached = next.breached;

      if (target.breached) {
        breaches.push(target);
        this.activeTargets.splice(i, 1);
        this.lives = Math.max(0, this.lives - (target.kind === 'boss' ? 3 : 1));

        if (this.lives <= 0) {
          this.gamePhase = 'GAMEOVER';
          return { breaches, phaseChanged: true, reloadedJustNow };
        }
      }
    }

    // 2. Spawn targets if wave has remaining
    const waveDef = this.waveDefinitions[this.currentWave] || this.waveDefinitions[3];
    const canSpawn =
      this.activeTargets.length < waveDef.maxSimultaneous &&
      this.spawnedInWave < waveDef.totalSpawns &&
      (this.spawnedInWave === 0 || nowMs - this.lastSpawnTimeMs >= 1100);

    if (canSpawn) {
      this.spawnNextTarget(waveDef, nowMs);
    }

    // 3. Spawn Boss in Wave 3 once normal wave spawns are done or halfway
    if (
      this.currentWave === 3 &&
      waveDef.includesBoss &&
      !this.bossSpawned &&
      (this.spawnedInWave >= 6 || this.activeTargets.length <= 1)
    ) {
      this.spawnBoss(nowMs);
    }

    // 4. Check wave completion
    const bossIsAlive = this.activeTargets.some((t) => t.kind === 'boss');
    const waveComplete =
      this.spawnedInWave >= waveDef.totalSpawns &&
      this.activeTargets.length === 0 &&
      (!waveDef.includesBoss || !bossIsAlive);

    if (waveComplete) {
      if (this.currentWave >= 3) {
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

  public shootAt(aimX: number, aimY: number, nowMs: number): EngineShootResult {
    if (this.gamePhase !== 'PLAYING') {
      return { fired: false, grade: 'MISS' };
    }

    const isFever = this.scoreManager.getState().isFeverActive;
    const shot = this.weaponSystem.consumeShot(nowMs, isFever);
    if (!shot.fired) {
      return { fired: false, grade: 'MISS' };
    }

    // Find best target intersecting aim point
    // Convert target radial pos (x, z) to approximate normalized aim coords [-1, 1]
    let bestHit:
      | { target: ActiveTargetEntity; result: HitJudgmentResult; index: number }
      | undefined;
    let minError = Infinity;

    for (let i = 0; i < this.activeTargets.length; i++) {
      const target = this.activeTargets[i];
      // Target yaw relative to player
      const targetAngle = target.thetaRad;
      // Normalized X from horizontal FOV
      const hHalfFov = Math.atan(Math.tan((this.vFovDeg * Math.PI) / 360) * this.aspect);
      const targetNormX = targetAngle / (hHalfFov * STAGE_CONSTANTS.FAN_MARGIN_RATIO);
      const targetNormY = 0; // Targets hover around eye level

      // Apparent radius in normalized aim space shrinks as distance increases
      const apparentHitRadius = Math.max(0.08, (target.hitRadiusM * 2.8) / target.radiusM);
      const dist = Math.hypot(aimX - targetNormX, aimY - targetNormY);

      if (dist <= apparentHitRadius) {
        const judgment = evaluateHitJudgment(dist, apparentHitRadius, isFever);
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

      const hitInfo = this.scoreManager.registerHit(
        result.grade as Exclude<JudgmentGrade, 'MISS'>,
        killed ? target.killBonusScore : 0
      );

      if (killed) {
        this.activeTargets.splice(index, 1);
        this.killedInWave += 1;
      }

      return {
        fired: true,
        grade: result.grade,
        target,
        killed,
        earnedScore: hitInfo.earnedScore,
        errorRatio: result.errorRatio,
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
