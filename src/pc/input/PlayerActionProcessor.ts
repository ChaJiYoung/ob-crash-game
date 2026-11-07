import type { BeerCrusherEngine, EngineShootResult, SkillExecuteResult } from '../engine/BeerCrusherEngine';
import type { PlayerIndex } from '../engine/PlayerCombatState';
import type { GamePhase, WeaponKind, WeaponLevel } from '../../shared/types';
import type { InputSignal, InputSink } from './inputSignals';

export type ShootableButton = 'start' | 'restart' | 'lobby';

export interface ProcessorContext {
  engine: BeerCrusherEngine;
  playerIndex: PlayerIndex;
  getPhase: () => GamePhase;
  isPauseMenuOpen: () => boolean;
  /** 판 시작 직후 스킬 금지 끝 시각. */
  getSkillGraceUntilMs: () => number;
  /** 조준점(−1~1) 아래 쏠 수 있는 버튼. 화면이 DOM 사각형으로 판정해 돌려준다(없으면 null). */
  hitTestButton: (aimX: number, aimY: number) => ShootableButton | null;
  /** = pressScreenButton. HTML onClick도 같은 함수를 부른다. */
  onButton: (button: ShootableButton) => void;
  onShot: (result: EngineShootResult) => void;     // 소리·연출·판정 배너
  onSkill: (result: SkillExecuteResult) => void;
  onFeverStarted: (playerIndex: PlayerIndex) => void;
  onAim: (aimX: number, aimY: number, playerIndex: PlayerIndex) => void; // 십자선·총 조준 표시
  now?: () => number;
  timers?: { setInterval: typeof setInterval; clearInterval: typeof clearInterval };
}

export interface PlayerActionState {
  isFeverReady: boolean;
  isFeverActive: boolean;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  skillCooldownTotalMs: number;
}

export const LOBBY_START_ZONE = 0.65;

export class PlayerActionProcessor implements InputSink {
  public readonly aim = { aimX: 0, aimY: 0 };
  private holdFireInterval: ReturnType<typeof setInterval> | null = null;
  private feverAutoFireInterval: ReturnType<typeof setInterval> | null = null;
  private skillLockUntilMs = 0;

  constructor(private readonly ctx: ProcessorContext) {}

  private getNow(): number {
    return this.ctx.now ? this.ctx.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  private get setIntervalFn(): typeof setInterval {
    return this.ctx.timers?.setInterval ?? setInterval;
  }

  private get clearIntervalFn(): typeof clearInterval {
    return this.ctx.timers?.clearInterval ?? clearInterval;
  }

  public send(signal: InputSignal): void {
    switch (signal.type) {
      case 'aim': {
        this.aim.aimX = signal.aimX;
        this.aim.aimY = signal.aimY;
        this.ctx.onAim(signal.aimX, signal.aimY, this.ctx.playerIndex);
        break;
      }
      case 'fireDown': {
        const phase = this.ctx.getPhase();
        const now = this.getNow();

        if (phase === 'PAIRING' || phase === 'ZEROING' || phase === 'GAMEOVER' || phase === 'VICTORY') {
          const button = this.ctx.hitTestButton(this.aim.aimX, this.aim.aimY);
          if (button) {
            this.ctx.onButton(button);
            return;
          }
          if (
            (phase === 'PAIRING' || phase === 'ZEROING') &&
            Math.abs(this.aim.aimX) < LOBBY_START_ZONE &&
            Math.abs(this.aim.aimY) < LOBBY_START_ZONE
          ) {
            this.ctx.onButton('start');
            return;
          }
          // 맞춘 버튼이 없으면 아무 동작도 하지 않음 (결과 화면 등에서 빗나감)
          return;
        }

        if ((phase === 'PLAYING' || phase === 'TUTORIAL' || phase === 'SANDBOX') && !this.ctx.isPauseMenuOpen()) {
          // 새로 누른 한 발 (press)
          const res = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, now, 'press');
          this.ctx.onShot(res);
          if (res.selectedWeapon || res.selectedCard) {
            this.skillLockUntilMs = now + 300;
          }

          // fireUp까지 무기 간격대로 연사 (5ms polling)
          this.stopHoldFire();
          this.holdFireInterval = this.setIntervalFn(() => {
            const t = this.getNow();
            const holdRes = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, t, 'hold');
            if (holdRes.fired) {
              this.ctx.onShot(holdRes);
            }
          }, 5);
        }
        break;
      }
      case 'fireUp': {
        this.stopHoldFire();
        break;
      }
      case 'skill': {
        if (this.ctx.isPauseMenuOpen()) return;
        const phase = this.ctx.getPhase();
        if (phase !== 'PLAYING' && phase !== 'TUTORIAL') return;
        if (this.ctx.engine.isSelectPending) return;

        const now = this.getNow();
        if (now < this.ctx.getSkillGraceUntilMs()) return;
        if (now < this.skillLockUntilMs) return;

        const res = this.ctx.engine.triggerWeaponSkill(now);
        if (res.activated) {
          this.ctx.onSkill(res);
        }
        break;
      }
      case 'fever': {
        if (this.ctx.isPauseMenuOpen()) return;
        const now = this.getNow();
        const activated = this.ctx.engine.activateFever(now);
        if (activated) {
          this.ctx.onFeverStarted(this.ctx.playerIndex);
        }
        break;
      }
    }
  }

  public tick(): void {
    const phase = this.ctx.getPhase();
    const playerState = this.getState();
    const shouldFeverAutoFire =
      playerState.isFeverActive &&
      !this.ctx.engine.isPaused &&
      !this.ctx.engine.isSelectPending &&
      (phase === 'PLAYING' || phase === 'SANDBOX' || phase === 'TUTORIAL');

    if (shouldFeverAutoFire) {
      if (!this.feverAutoFireInterval) {
        this.feverAutoFireInterval = this.setIntervalFn(() => {
          const now = this.getNow();
          const res = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, now, 'fever');
          if (res.fired) {
            this.ctx.onShot(res);
          }
        }, 16);
      }
    } else {
      this.stopFeverAutoFire();
    }
  }

  public getState(): PlayerActionState {
    const player = this.ctx.engine.getPlayer(this.ctx.playerIndex);
    const fever = player.scoreManager.getState();
    const weapon = player.weaponSystem.getState();

    return {
      isFeverReady: fever.isFeverReady,
      isFeverActive: fever.isFeverActive,
      weaponKind: weapon.weaponKind,
      weaponLevel: weapon.weaponLevel,
      skillStock: weapon.skillStock,
      maxSkillStock: weapon.maxSkillStock,
      skillCooldownRemainingMs: weapon.skillCooldownRemainingMs,
      skillCooldownTotalMs: weapon.skillCooldownTotalMs,
    };
  }

  public stopAll(): void {
    this.stopHoldFire();
    this.stopFeverAutoFire();
  }

  private stopHoldFire(): void {
    if (this.holdFireInterval !== null) {
      this.clearIntervalFn(this.holdFireInterval);
      this.holdFireInterval = null;
    }
  }

  private stopFeverAutoFire(): void {
    if (this.feverAutoFireInterval !== null) {
      this.clearIntervalFn(this.feverAutoFireInterval);
      this.feverAutoFireInterval = null;
    }
  }
}
