import { BeerCrusherEngine, ActiveTargetEntity } from '../engine/BeerCrusherEngine';
import { TutorialStep, TargetKind, WeaponKind } from '../../shared/types';
import { TARGET_SPECS } from '../../shared/constants';
import { EngineEvent } from '../engine/engineEvents';

/** 3단계(스킬) 라운드의 무기 순서. */
export const TUTORIAL_SKILL_ROUND_WEAPONS: readonly WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
export type TutorialSkillRound = 0 | 1 | 2;
export type TutorialSkillPhase = 'ready' | 'awaitingBlast' | 'done';
export interface TutorialRoundState {
  round: TutorialSkillRound;
  phase: TutorialSkillPhase;
}
/** 샷건 폭발 후 다음 라운드까지, 리볼버·게틀링 스킬 사용 후 다음 라운드까지 기다리는 시간(ms). 연출을 보여 주기 위한 지연이다. */
export const TUTORIAL_BLAST_ADVANCE_DELAY_MS = 500;
export const TUTORIAL_SKILL_ADVANCE_DELAY_MS = 1200;
/** 일시정지 중일 때 통과를 다시 확인하는 간격(ms). */
export const TUTORIAL_PAUSE_RECHECK_MS = 200;

export class TutorialDirector {
  public step: TutorialStep = 1;
  public completed = false;
  /** 3단계 안의 라운드(0 샷건, 1 리볼버, 2 게틀링). TutorialStep 타입은 바꾸지 않고 내부 상태로 다룬다. */
  public skillRound: TutorialSkillRound = 0;
  public skillPhase: TutorialSkillPhase = 'ready';
  private engine: BeerCrusherEngine;
  private onStepChange?: (step: TutorialStep) => void;
  private onRoundChange?: (state: TutorialRoundState) => void;
  private unsubscribe?: () => void;
  private advanceTimer?: ReturnType<typeof setTimeout>;

  constructor(
    engine: BeerCrusherEngine,
    onStepChange?: (step: TutorialStep) => void,
    onRoundChange?: (state: TutorialRoundState) => void
  ) {
    this.engine = engine;
    this.onStepChange = onStepChange;
    this.onRoundChange = onRoundChange;
  }

  public start(nowMs: number): void {
    this.clearAdvanceTimer();
    this.step = 1;
    this.completed = false;
    this.skillRound = 0;
    this.skillPhase = 'ready';
    this.onStepChange?.(1);
    this.stop();
    this.unsubscribe = this.engine.addEventListener((e) => this.handleEvent(e));
    this.spawnStep1();
  }

  public stop(): void {
    this.clearAdvanceTimer();
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
      this.startSkillRound(0);
    } else if (nextStep === 4) {
      this.clearAdvanceTimer();
      // 게틀링 라운드 뒤에도 피버 단계는 샷건으로 시작한다.
      this.engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
      this.engine.getPlayer(0).scoreManager.forceSetFeverGauge(100);
      this.engine.activeTargets = [];
    } else if (nextStep === 'COMPLETED') {
      this.clearAdvanceTimer();
      this.completed = true;
      this.engine.activeTargets = [];
    }
  }

  private clearAdvanceTimer(): void {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = undefined;
    }
  }

  private emitRound(): void {
    this.onRoundChange?.({ round: this.skillRound, phase: this.skillPhase });
  }

  /** 라운드 시작: 무기를 바꾸고(selectWeapon은 스킬 재고를 0으로 만든다) 스킬을 채운 뒤 정지 표적 편대를 세운다. */
  private startSkillRound(round: TutorialSkillRound): void {
    this.clearAdvanceTimer();
    this.skillRound = round;
    this.skillPhase = 'ready';
    const weaponSystem = this.engine.getPlayer(0).weaponSystem;
    weaponSystem.selectWeapon(TUTORIAL_SKILL_ROUND_WEAPONS[round], 1);
    weaponSystem.refillSkillInstant();
    this.spawnStep3();
    this.emitRound();
  }

  /** 지연 후 다음 라운드(마지막 라운드면 4단계). 이미 예약돼 있으면 무시한다. */
  private scheduleRoundAdvance(delayMs: number): void {
    if (this.advanceTimer) return;
    this.skillPhase = 'done';
    this.emitRound();
    this.advanceTimer = setTimeout(() => this.fireRoundAdvance(), delayMs);
  }

  /** 타이머는 실시간이라 엔진 일시정지를 모른다. 일시정지(가이드·메뉴) 중에는 넘기지 않고 풀릴 때까지 다시 기다린다. */
  private fireRoundAdvance(): void {
    if (this.engine.isPaused) {
      this.advanceTimer = setTimeout(() => this.fireRoundAdvance(), TUTORIAL_PAUSE_RECHECK_MS);
      return;
    }
    this.advanceTimer = undefined;
    this.advanceSkillRound();
  }

  private advanceSkillRound(): void {
    if (this.step !== 3 || this.completed) return;
    if (this.skillRound >= 2) {
      this.advanceStep(4);
    } else {
      this.startSkillRound((this.skillRound + 1) as TutorialSkillRound);
    }
  }

  /** 샷건 라운드에서 박힌 몬스터가 하나도 남지 않았을 때(폭발했거나 모두 평타로 처치) 통과를 예약한다. */
  private maybeFinishShotgunRound(): void {
    if (this.step !== 3 || this.skillPhase !== 'awaitingBlast') return;
    if (this.engine.activeTargets.some((t) => t.plungerBlast)) return;
    this.scheduleRoundAdvance(TUTORIAL_BLAST_ADVANCE_DELAY_MS);
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
        } else if (this.step === 3 && this.engine.activeTargets.length === 0 && this.skillPhase === 'ready') {
          // 스킬을 쓰기 전에 표적을 모두 잡았다: 같은 라운드의 표적을 다시 세운다.
          this.spawnStep3();
        } else if (this.step === 3) {
          this.maybeFinishShotgunRound();
        } else if (this.step === 4 && this.engine.activeTargets.length === 0) {
          this.advanceStep('COMPLETED');
        }
        break;
      }
      case 'plungerBlasted': {
        this.maybeFinishShotgunRound();
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
        if (this.step === 3 && e.playerIndex === 0 && this.skillPhase === 'ready') {
          if (this.skillRound === 0) {
            if (!this.engine.activeTargets.some((t) => t.plungerBlast)) {
              // 박힐 몬스터가 없었다(착지 전 등): 폭발 장면 없이 넘기지 않고 스킬을 채워 다시 써 보게 한다.
              this.engine.getPlayer(0).weaponSystem.refillSkillInstant();
              return;
            }
            // 샷건: 박힌 몬스터가 터지는 것까지 보고 넘어간다.
            this.skillPhase = 'awaitingBlast';
            this.emitRound();
          } else {
            this.scheduleRoundAdvance(TUTORIAL_SKILL_ADVANCE_DELAY_MS);
          }
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
