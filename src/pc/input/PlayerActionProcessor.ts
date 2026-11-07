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
  getSkillGraceUntilMs?: () => number;
  /** 조준점(−1~1) 아래 쏠 수 있는 버튼. 화면이 DOM 사각형으로 판정해 돌려준다(없으면 null). */
  hitTestButton: (aimX: number, aimY: number) => ShootableButton | null;
  /** = pressScreenButton. HTML onClick도 같은 함수를 부른다. */
  onButton?: (button: ShootableButton) => void;
  /** 게임 밖(PAIRING, ZEROING, GAMEOVER, VICTORY) 화면 사격 시 호출 (사격음 및 버튼 적중/빗나감 판정음). */
  onMenuShot?: (hit: boolean) => void;
  onShot?: (result: EngineShootResult) => void;     // 소리·연출·판정 배너
  onSkill?: (result: SkillExecuteResult) => void;
  onFeverStarted?: (playerIndex: PlayerIndex) => void;
  onAim?: (aimX: number, aimY: number, playerIndex: PlayerIndex, immediate: boolean) => void; // 십자선·총 조준 표시
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

type IntervalFns = {
  set: (cb: () => void, ms: number) => ReturnType<typeof setInterval>;
  clear: (id: ReturnType<typeof setInterval>) => void;
};

export class PlayerActionProcessor implements InputSink {
  public readonly aim = { aimX: 0, aimY: 0 };
  private holdFireInterval: ReturnType<typeof setInterval> | null = null;
  private feverAutoFireInterval: ReturnType<typeof setInterval> | null = null;
  private skillLockUntilMs = 0;
  private readonly timers: IntervalFns;

  constructor(private readonly ctx: ProcessorContext) {
    const t = ctx.timers;
    this.timers = t
      ? { set: (cb, ms) => t.setInterval(cb, ms), clear: (id) => t.clearInterval(id) }
      : { set: (cb, ms) => setInterval(cb, ms), clear: (id) => clearInterval(id) };
  }

  private getNow(): number {
    return this.ctx.now ? this.ctx.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  public send(signal: InputSignal): void {
    switch (signal.type) {
      case 'aim': {
        this.aim.aimX = signal.aimX;
        this.aim.aimY = signal.aimY;
        this.ctx.onAim?.(signal.aimX, signal.aimY, this.ctx.playerIndex, Boolean(signal.immediate));
        break;
      }
      case 'fireDown': {
        const phase = this.ctx.getPhase();
        const now = this.getNow();

        if (phase === 'PAIRING' || phase === 'ZEROING' || phase === 'GAMEOVER' || phase === 'VICTORY') {
          const button = this.ctx.hitTestButton(this.aim.aimX, this.aim.aimY);
          if (button) {
            this.ctx.onButton?.(button);
            this.ctx.onMenuShot?.(true);
            return;
          }
          if (
            (phase === 'PAIRING' || phase === 'ZEROING') &&
            Math.abs(this.aim.aimX) < LOBBY_START_ZONE &&
            Math.abs(this.aim.aimY) < LOBBY_START_ZONE
          ) {
            this.ctx.onButton?.('start');
            this.ctx.onMenuShot?.(true);
            return;
          }
          // 맞춘 버튼이 없으면 아무 동작도 하지 않음 (결과 화면 등에서 빗나감)
          this.ctx.onMenuShot?.(false);
          return;
        }

        if ((phase === 'PLAYING' || phase === 'TUTORIAL' || phase === 'SANDBOX') && !this.ctx.isPauseMenuOpen()) {
          // 새로 누른 한 발 (press)
          const res = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, now, 'press', this.ctx.playerIndex);
          this.ctx.onShot?.(res);
          if (res.selectedWeapon || res.selectedCard) {
            this.skillLockUntilMs = now + 300;
          }

          // fireUp까지 무기 간격대로 연사 (5ms polling)
          this.stopHoldFire();
          this.holdFireInterval = this.timers.set(() => {
            const t = this.getNow();
            const holdRes = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, t, 'hold', this.ctx.playerIndex);
            if (holdRes.fired) {
              this.ctx.onShot?.(holdRes);
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
        const graceUntil = this.ctx.getSkillGraceUntilMs ? this.ctx.getSkillGraceUntilMs() : 0;
        if (now < graceUntil) return;
        if (now < this.skillLockUntilMs) return;

        const res = this.ctx.engine.triggerWeaponSkill(now, this.ctx.playerIndex);
        if (res.activated) {
          this.ctx.onSkill?.(res);
        }
        break;
      }
      case 'fever': {
        if (this.ctx.isPauseMenuOpen()) return;
        const now = this.getNow();
        const activated = this.ctx.engine.activateFever(now, this.ctx.playerIndex);
        if (activated) {
          this.ctx.onFeverStarted?.(this.ctx.playerIndex);
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
        this.feverAutoFireInterval = this.timers.set(() => {
          const now = this.getNow();
          const res = this.ctx.engine.shootAt(this.aim.aimX, this.aim.aimY, now, 'fever', this.ctx.playerIndex);
          if (res.fired) {
            this.ctx.onShot?.(res);
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
      this.timers.clear(this.holdFireInterval);
      this.holdFireInterval = null;
    }
  }

  private stopFeverAutoFire(): void {
    if (this.feverAutoFireInterval !== null) {
      this.timers.clear(this.feverAutoFireInterval);
      this.feverAutoFireInterval = null;
    }
  }
}
