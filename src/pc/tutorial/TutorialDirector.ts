import { BeerCrusherEngine, ActiveTargetEntity } from '../engine/BeerCrusherEngine';
import { TutorialStep, TargetKind } from '../../shared/types';
import { TARGET_SPECS } from '../../shared/constants';
import { EngineEvent } from '../engine/engineEvents';

export class TutorialDirector {
  public step: TutorialStep = 1;
  public completed = false;
  private engine: BeerCrusherEngine;
  private onStepChange?: (step: TutorialStep) => void;
  private unsubscribe?: () => void;

  constructor(engine: BeerCrusherEngine, onStepChange?: (step: TutorialStep) => void) {
    this.engine = engine;
    this.onStepChange = onStepChange;
  }

  public start(nowMs: number): void {
    this.step = 1;
    this.completed = false;
    this.onStepChange?.(1);
    this.stop();
    this.unsubscribe = this.engine.addEventListener((e) => this.handleEvent(e));
    this.spawnStep1();
  }

  public stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  public advanceStep(nextStep: TutorialStep): void {
    this.step = nextStep;
    this.onStepChange?.(nextStep);
    if (nextStep === 2) {
      this.spawnStep2();
    } else if (nextStep === 3) {
      this.engine.getPlayer(0).weaponSystem.refillSkillInstant();
      this.spawnStep3();
    } else if (nextStep === 4) {
      this.engine.getPlayer(0).scoreManager.forceSetFeverGauge(100);
      this.engine.activeTargets = [];
    } else if (nextStep === 'COMPLETED') {
      this.completed = true;
      this.engine.activeTargets = [];
    }
  }

  public spawnStep1(): void {
    const angles = [-0.22, 0.0, 0.22];
    const radius = 10.0;
    const list = angles.map((theta) => ({
      kind: 'pilgood' as TargetKind,
      hp: 1,
      maxHp: 1,
      radiusM: radius,
      thetaRad: theta,
      x: Math.sin(theta) * radius,
      z: -Math.cos(theta) * radius,
      speedMps: 0,
      hitRadiusM: 1.1,
      killBonusScore: 50,
    }));
    this.engine.placeTargets(list, 'tutorial_can');
  }

  public spawnStep2(): void {
    const bottleSpec = TARGET_SPECS.bottle;
    const list = [
      {
        kind: 'bottle' as TargetKind,
        hp: bottleSpec.maxHp,
        maxHp: bottleSpec.maxHp,
        radiusM: 14.0,
        thetaRad: 0,
        x: 0,
        z: -14.0,
        speedMps: 1.4,
        hitRadiusM: bottleSpec.hitRadiusM,
        killBonusScore: bottleSpec.killBonusScore,
      },
    ];
    this.engine.placeTargets(list, 'tutorial_bottle');
  }

  public spawnStep3(): void {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'pilgood', 'caslight', 'pilgood'];
    const angles = [-0.3, -0.15, 0, 0.15, 0.3];
    const list = kinds.map((kind, i) => {
      const spec = TARGET_SPECS[kind];
      const radius = 12.0 + (i % 2);
      const theta = angles[i];
      return {
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
      };
    });
    this.engine.placeTargets(list, 'tutorial_skill');
  }

  public spawnStep4FeverEnemies(): void {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'caslight'];
    const angles = [-0.35, -0.20, -0.07, 0.07, 0.20, 0.35];
    const list = kinds.map((kind, i) => {
      const spec = TARGET_SPECS[kind];
      const radius = 12.0 + (i % 2) * 2.0;
      const theta = angles[i];
      return {
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
      };
    });
    this.engine.placeTargets(list, 'tutorial_fever');
  }

  private handleEvent(e: EngineEvent): void {
    if (this.completed) return;

    switch (e.type) {
      case 'targetKilled': {
        if (this.step === 1 && this.engine.activeTargets.length === 0) {
          this.advanceStep(2);
        } else if (this.step === 2 && this.engine.activeTargets.length === 0) {
          this.advanceStep(3);
        } else if (this.step === 3 && this.engine.activeTargets.length === 0) {
          this.spawnStep3();
        } else if (this.step === 4 && this.engine.activeTargets.length === 0) {
          this.advanceStep('COMPLETED');
        }
        break;
      }
      case 'targetBreached': {
        if (this.step === 2) {
          this.spawnStep2();
        } else if (this.step === 4 && this.engine.activeTargets.length === 0) {
          this.advanceStep('COMPLETED');
        }
        break;
      }
      case 'skillUsed': {
        if (this.step === 3) {
          this.advanceStep(4);
        }
        break;
      }
      case 'feverStarted': {
        if (this.step === 4) {
          this.spawnStep4FeverEnemies();
        }
        break;
      }
      case 'feverEnded': {
        if (
          this.step === 4 &&
          this.engine.activeTargets.length === 0 &&
          this.engine.getPlayer(0).scoreManager.getState().feverGauge === 0
        ) {
          this.advanceStep('COMPLETED');
        }
        break;
      }
    }
  }
}
