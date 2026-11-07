import type { InputSink } from './inputSignals';
import type { PlayerActionState } from './PlayerActionProcessor';
import type { SensorFramePayload, ClientToServerMessage } from '../../shared/types';
import type { SensorTuningConfig } from '../components/MobileSensorLabModal';

export interface ZeroOffset {
  offsetX: number;
  offsetY: number;
}

export function applyZeroAndTuning(
  payload: SensorFramePayload,
  zero: ZeroOffset,
  tuning: SensorTuningConfig
): { aimX: number; aimY: number; rawAimX: number; rawAimY: number } {
  const rawAimX = (payload.aimX - zero.offsetX) * tuning.sensitivityX;
  const signedAimY = tuning.invertY ? -payload.aimY : payload.aimY;
  const rawAimY = (signedAimY - zero.offsetY) * tuning.sensitivityY;
  const effectiveAimX = Math.max(-1, Math.min(1, rawAimX));
  const effectiveAimY = Math.max(-1, Math.min(1, rawAimY));

  const rawFromPayloadX = payload.rawAimX ?? payload.aimX;
  const rawFromPayloadY = payload.rawAimY ?? payload.aimY;
  const offsetRawX = Math.max(-1, Math.min(1, (rawFromPayloadX - zero.offsetX) * tuning.sensitivityX));
  const signedRawY = tuning.invertY ? -rawFromPayloadY : rawFromPayloadY;
  const offsetRawY = Math.max(-1, Math.min(1, (signedRawY - zero.offsetY) * tuning.sensitivityY));

  return {
    aimX: effectiveAimX,
    aimY: effectiveAimY,
    rawAimX: offsetRawX,
    rawAimY: offsetRawY,
  };
}

export interface PhoneAdapterOptions {
  sink: () => InputSink | null;
  send: (msg: ClientToServerMessage) => void;
  roomId: () => string;
  getTuning: () => SensorTuningConfig;
  now?: () => number;
}

export interface SensorFrameResult {
  aimX: number;
  aimY: number;
  rawAimX: number;
  rawAimY: number;
  isAimLocked: boolean;
  cockedJustNow: boolean;
}

export class PhoneAdapter {
  public zeroOffset: ZeroOffset = { offsetX: 0, offsetY: 0 };
  public latestAim = { aimX: 0, aimY: 0 };

  private lastRapidFireHold = false;
  private lastIsCocked = false;
  private lastSentFeverReady: boolean | null = null;
  private lastSentSkillStock: number | null = null;
  private lastSkillSyncTimeMs = 0;

  constructor(private readonly opts: PhoneAdapterOptions) {}

  private getNow(): number {
    return this.opts.now ? this.opts.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  /**
   * SENSOR_RELAY payload 해석:
   * 영점·감도 → aim,
   * snapFire → fireDown + fireUp,
   * rapidFireHold 상승 → fireDown / 하강 → fireUp,
   * feverTriggered → fever,
   * skillSnapTriggered → skill.
   * 진단용 원시값을 돌려준다.
   */
  public onSensorFrame(p: SensorFramePayload): SensorFrameResult {
    const tuning = this.opts.getTuning();
    const { aimX, aimY, rawAimX, rawAimY } = applyZeroAndTuning(p, this.zeroOffset, tuning);
    this.latestAim = { aimX, aimY };

    const sink = this.opts.sink();

    // 1. 조준 갱신
    if (sink) {
      sink.send({ type: 'aim', aimX, aimY });
    }

    // 2. snapFire (단발 사격)
    if (p.snapFire && sink) {
      sink.send({ type: 'fireDown' });
      sink.send({ type: 'fireUp' });
    }

    // 3. 홀드 변화 (연사 시작/중지)
    const hold = !!p.rapidFireHold;
    if (hold !== this.lastRapidFireHold && sink) {
      if (hold) {
        sink.send({ type: 'fireDown' });
      } else {
        sink.send({ type: 'fireUp' });
      }
    }
    this.lastRapidFireHold = hold;

    // 4. 피버 발동
    if (p.feverTriggered && sink) {
      sink.send({ type: 'fever' });
    }

    // 5. 스킬 발동
    if (p.skillSnapTriggered && sink) {
      sink.send({ type: 'skill' });
    }

    const cockedJustNow = !!p.isCocked && !this.lastIsCocked;
    this.lastIsCocked = !!p.isCocked;
    const isAimLocked = Boolean(p.isCocked && !p.rapidFireHold);

    return {
      aimX,
      aimY,
      rawAimX,
      rawAimY,
      isAimLocked,
      cockedJustNow,
    };
  }

  public resetZero(): void {
    this.zeroOffset = { offsetX: 0, offsetY: 0 };
  }

  public autoZeroFromLatest(): void {
    this.zeroOffset = {
      offsetX: this.latestAim.aimX,
      offsetY: this.latestAim.aimY,
    };
  }

  /**
   * HUD 틱마다: 처리부 상태로 FEVER_STATUS_SYNC(변경 시)·SKILL_STATE_SYNC(스톡 변경 또는 150ms) 전송(D28).
   */
  public syncFeedback(state: PlayerActionState): void {
    const roomId = this.opts.roomId();
    if (!roomId) return;

    // FEVER_STATUS_SYNC: 변경 시 전송
    if (this.lastSentFeverReady !== state.isFeverReady) {
      this.lastSentFeverReady = state.isFeverReady;
      this.opts.send({
        type: 'FEVER_STATUS_SYNC',
        roomId,
        isFeverReady: state.isFeverReady,
      });
    }

    // SKILL_STATE_SYNC: 스톡 변경 또는 150ms 마다 전송
    const now = this.getNow();
    const stockChanged = this.lastSentSkillStock !== state.skillStock;
    if (stockChanged || now - this.lastSkillSyncTimeMs >= 150) {
      this.lastSkillSyncTimeMs = now;
      this.lastSentSkillStock = state.skillStock;
      this.opts.send({
        type: 'SKILL_STATE_SYNC',
        roomId,
        weaponKind: state.weaponKind,
        weaponLevel: state.weaponLevel,
        skillStock: state.skillStock,
        maxSkillStock: state.maxSkillStock,
        skillCooldownRemainingMs: state.skillCooldownRemainingMs,
        skillCooldownTotalMs: state.skillCooldownTotalMs,
      });
    }
  }
}
