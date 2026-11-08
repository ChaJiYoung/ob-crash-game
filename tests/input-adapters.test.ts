import { describe, it, expect, beforeEach } from 'vitest';
import { MouseAdapter } from '../src/pc/input/MouseAdapter';
import { PhoneAdapter, applyZeroAndTuning } from '../src/pc/input/PhoneAdapter';
import type { InputSignal, InputSink } from '../src/pc/input/inputSignals';
import type { PlayerActionState } from '../src/pc/input/PlayerActionProcessor';
import type { ClientToServerMessage, SensorFramePayload } from '../src/shared/types';
import type { SensorTuningConfig } from '../src/pc/components/MobileSensorLabModal';

const makePayload = (overrides?: Partial<SensorFramePayload>): SensorFramePayload => ({
  aimX: 0,
  aimY: 0,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  snapFire: false,
  rapidFireHold: false,
  feverTriggered: false,
  isCocked: false,
  timestamp: Date.now(),
  ...overrides,
});

const makeTuning = (overrides?: Partial<SensorTuningConfig>): SensorTuningConfig => ({
  sensitivityX: 1.0,
  sensitivityY: 1.0,
  invertY: false,
  minCutoff: 1.0,
  beta: 0.0,
  dCutoff: 1.0,
  isStabilizedMode: true,
  preset: 'custom',
  deadzone: 0,
  ...overrides,
});

describe('Input Adapters (P01-T05)', () => {
  describe('MouseAdapter', () => {
    let signals: InputSignal[];
    let currentTime: number;

    const mockSink: InputSink = {
      send: (s) => signals.push(s),
    };

    beforeEach(() => {
      signals = [];
      currentTime = 1000;
    });

    it('emits aim on move, fireDown on click, and skill on right click', () => {
      const adapter = new MouseAdapter(() => mockSink, 300, () => currentTime);

      adapter.onMove(0.4, -0.3);
      expect(signals).toEqual([{ type: 'aim', aimX: 0.4, aimY: -0.3, immediate: true }]);

      signals = [];
      adapter.onLeftDown();
      expect(signals).toEqual([{ type: 'fireDown' }]);

      signals = [];
      adapter.onLeftUp();
      expect(signals).toEqual([{ type: 'fireUp' }]);

      signals = [];
      adapter.onRightClick();
      expect(signals).toEqual([{ type: 'skill' }]);
    });

    it('triggers fever on double-click within window, then clears reference', () => {
      const adapter = new MouseAdapter(() => mockSink, 300, () => currentTime);

      // 첫 번째 클릭
      adapter.onLeftDown();
      expect(signals).toEqual([{ type: 'fireDown' }]);

      // 200ms 뒤 두 번째 클릭 (더블클릭 창 300ms 안)
      currentTime += 200;
      signals = [];
      adapter.onLeftDown();
      expect(signals).toEqual([{ type: 'fever' }, { type: 'fireDown' }]);

      // 200ms 뒤 세 번째 클릭 (이전 더블클릭 트리거로 리셋되어 피버 재발동 안 됨)
      currentTime += 200;
      signals = [];
      adapter.onLeftDown();
      expect(signals).toEqual([{ type: 'fireDown' }]);
    });

    it('does nothing when sink is null', () => {
      const adapter = new MouseAdapter(() => null, 300, () => currentTime);

      expect(() => {
        adapter.onMove(0.1, 0.2);
        adapter.onLeftDown();
        adapter.onLeftUp();
        adapter.onRightClick();
      }).not.toThrow();
    });
  });

  describe('PhoneAdapter', () => {
    let signals: InputSignal[];
    let sentMessages: ClientToServerMessage[];
    let currentTime: number;

    const mockSink: InputSink = {
      send: (s) => signals.push(s),
    };

    beforeEach(() => {
      signals = [];
      sentMessages = [];
      currentTime = 5000;
    });

    it('applyZeroAndTuning computes exact coordinates with sensitivity, invertY, and offsets', () => {
      const payload = makePayload({
        aimX: 0.5,
        aimY: 0.4,
        rawAimX: 0.6,
        rawAimY: 0.5,
      });

      const zero = { offsetX: 0.1, offsetY: -0.2 };
      const tuning = makeTuning({
        sensitivityX: 1.2,
        sensitivityY: 1.5,
        invertY: true,
      });

      const res = applyZeroAndTuning(payload, zero, tuning);

      // aimX: (0.5 - 0.1) * 1.2 = 0.48
      expect(res.aimX).toBeCloseTo(0.48, 5);
      // signedAimY: invertY=true -> -0.4. rawAimY: (-0.4 - (-0.2)) * 1.5 = -0.3
      expect(res.aimY).toBeCloseTo(-0.3, 5);

      // rawAimX: (0.6 - 0.1) * 1.2 = 0.6
      expect(res.rawAimX).toBeCloseTo(0.6, 5);
      // signedRawY: invertY=true -> -0.5. offsetRawY: (-0.5 - (-0.2)) * 1.5 = -0.45
      expect(res.rawAimY).toBeCloseTo(-0.45, 5);
    });

    it('emits fireDown+fireUp on snapFire, and fireDown/fireUp on hold rising/falling edges', () => {
      const adapter = new PhoneAdapter({
        sink: () => mockSink,
        send: (m) => sentMessages.push(m),
        roomId: () => 'room-test',
        getTuning: () => makeTuning(),
        now: () => currentTime,
      });

      // snapFire: aim + fireDown + fireUp
      adapter.onSensorFrame(
        makePayload({
          aimX: 0.2,
          aimY: 0.3,
          snapFire: true,
        })
      );
      expect(signals).toEqual([
        { type: 'aim', aimX: 0.2, aimY: 0.3 },
        { type: 'fireDown' },
        { type: 'fireUp' },
      ]);

      // hold 상승 edge: fireDown
      signals = [];
      adapter.onSensorFrame(
        makePayload({
          aimX: 0.2,
          aimY: 0.3,
          rapidFireHold: true,
        })
      );
      expect(signals).toEqual([
        { type: 'aim', aimX: 0.2, aimY: 0.3 },
        { type: 'fireDown' },
      ]);

      // hold 유지: 신호 없음 (aim만)
      signals = [];
      adapter.onSensorFrame(
        makePayload({
          aimX: 0.25,
          aimY: 0.3,
          rapidFireHold: true,
        })
      );
      expect(signals).toEqual([{ type: 'aim', aimX: 0.25, aimY: 0.3 }]);

      // hold 하강 edge: fireUp
      signals = [];
      adapter.onSensorFrame(
        makePayload({
          aimX: 0.25,
          aimY: 0.3,
          rapidFireHold: false,
        })
      );
      expect(signals).toEqual([
        { type: 'aim', aimX: 0.25, aimY: 0.3 },
        { type: 'fireUp' },
      ]);
    });

    describe('autoZeroFromLatest', () => {
      const makeAdapter = (tuning: SensorTuningConfig) =>
        new PhoneAdapter({
          sink: () => mockSink,
          send: (m) => sentMessages.push(m),
          roomId: () => 'room-test',
          getTuning: () => tuning,
          now: () => currentTime,
        });

      const lastAim = () => {
        const aims = signals.filter((s) => s.type === 'aim') as Array<{ aimX: number; aimY: number }>;
        return aims[aims.length - 1];
      };

      it('yields (0,0) for the same input after every call, even with sensitivity != 1', () => {
        const adapter = makeAdapter(makeTuning({ sensitivityX: 1.5, sensitivityY: 1.5 }));

        adapter.onSensorFrame(makePayload({ aimX: 0.5, aimY: 0.4 }));
        adapter.autoZeroFromLatest();
        adapter.onSensorFrame(makePayload({ aimX: 0.5, aimY: 0.4 }));
        expect(lastAim().aimX).toBeCloseTo(0);
        expect(lastAim().aimY).toBeCloseTo(0);

        adapter.onSensorFrame(makePayload({ aimX: 0.8, aimY: 0.2 }));
        adapter.autoZeroFromLatest();
        adapter.onSensorFrame(makePayload({ aimX: 0.8, aimY: 0.2 }));
        expect(lastAim().aimX).toBeCloseTo(0);
        expect(lastAim().aimY).toBeCloseTo(0);
      });

      it('handles invertY', () => {
        const adapter = makeAdapter(makeTuning({ sensitivityY: 1.5, invertY: true }));
        adapter.onSensorFrame(makePayload({ aimY: 0.4 }));
        adapter.autoZeroFromLatest();
        adapter.onSensorFrame(makePayload({ aimY: 0.4 }));
        expect(lastAim().aimY).toBeCloseTo(0);
      });

      it('keeps the zero at (0,0) when no frame has arrived', () => {
        const adapter = makeAdapter(makeTuning());
        adapter.autoZeroFromLatest();
        expect(adapter.zeroOffset).toEqual({ offsetX: 0, offsetY: 0 });
      });

      it('moves relative to the new zero afterwards', () => {
        const adapter = makeAdapter(makeTuning({ sensitivityX: 2 }));
        adapter.onSensorFrame(makePayload({ aimX: 0.3 }));
        adapter.autoZeroFromLatest();
        adapter.onSensorFrame(makePayload({ aimX: 0.4 }));
        expect(lastAim().aimX).toBeCloseTo(0.2);
      });
    });

    it('syncFeedback sends FEVER_STATUS_SYNC on change and SKILL_STATE_SYNC throttled 150ms', () => {
      const adapter = new PhoneAdapter({
        sink: () => mockSink,
        send: (m) => sentMessages.push(m),
        roomId: () => 'room-test',
        getTuning: () => makeTuning(),
        now: () => currentTime,
      });

      const baseState: PlayerActionState = {
        isFeverReady: false,
        isFeverActive: false,
        weaponKind: 'shotgun',
        weaponLevel: 1,
        skillStock: 1,
        maxSkillStock: 1,
        skillCooldownRemainingMs: 0,
        skillCooldownTotalMs: 15_000,
      };

      // 첫 호출: FEVER_STATUS_SYNC(false) + SKILL_STATE_SYNC 전송
      adapter.syncFeedback(baseState);
      expect(sentMessages.length).toBe(2);
      expect(sentMessages[0].type).toBe('FEVER_STATUS_SYNC');
      expect(sentMessages[1].type).toBe('SKILL_STATE_SYNC');

      // 50ms 후 상태 변경 없음 -> 전송 없음
      sentMessages = [];
      currentTime += 50;
      adapter.syncFeedback(baseState);
      expect(sentMessages.length).toBe(0);

      // feverReady 변경 -> FEVER_STATUS_SYNC만 전송
      currentTime += 20;
      adapter.syncFeedback({ ...baseState, isFeverReady: true });
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('FEVER_STATUS_SYNC');

      // 150ms 이상 경과 -> SKILL_STATE_SYNC 전송
      sentMessages = [];
      currentTime += 160;
      adapter.syncFeedback({ ...baseState, isFeverReady: true });
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('SKILL_STATE_SYNC');
    });
  });
});
