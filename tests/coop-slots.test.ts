import { describe, it, expect } from 'vitest';
import {
  createInitialSlots,
  chooseSlotInput,
  updateSlot,
  isSlotJoined,
  isSlotReady,
  getJoinedSlots,
  getStartGate,
  buildSlotIndexMap,
  indexToSlot,
  getSoloSlot,
  getMouseIndex,
  applyControllerPaired,
  applyControllerUnsupported,
  buildSandboxSlotMap,
  shouldShowLobbyCrosshair,
  createLobbySlots,
  applyLobbyReturnDefaults,
} from '../src/pc/coopSlots';
import { PlayerProfile } from '../src/shared/types';

function makeProfile(deviceId: string, nickname: string): PlayerProfile {
  return {
    deviceId,
    nickname,
    bestScore: 100,
    totalGames: 5,
    lastPlayedAt: '2026-11-07T12:00:00.000Z',
  };
}

describe('coopSlots pure model (P04-T01)', () => {
  it('rejects second mouse selection with MOUSE_TAKEN', () => {
    let slots = createInitialSlots();
    const res1 = chooseSlotInput(slots, 1, 'mouse');
    expect(res1.rejected).toBeUndefined();
    slots = res1.slots;
    expect(slots[0].input).toBe('mouse');

    // 2P tries to choose mouse -> rejected
    const res2 = chooseSlotInput(slots, 2, 'mouse');
    expect(res2.rejected).toBe('MOUSE_TAKEN');
    expect(res2.slots[1].input).toBeNull();

    // 2P chooses mobile -> ok
    const res3 = chooseSlotInput(slots, 2, 'mobile');
    expect(res3.rejected).toBeUndefined();
    expect(res3.slots[1].input).toBe('mobile');
  });

  it('allows start with single player when only 1P is joined and ready', () => {
    let slots = createInitialSlots();
    // 1P mobile chosen, paired, zero-calibrated
    slots = chooseSlotInput(slots, 1, 'mobile').slots;
    slots = updateSlot(slots, 1, {
      player: makeProfile('phone_1', '선수1'),
      isZeroCalibrated: true,
      isConnected: true,
    });

    const gate = getStartGate(slots);
    expect(gate.canStart).toBe(true);
    expect(gate.playerCount).toBe(1);
    expect(gate.waitingSlots).toHaveLength(0);
    expect(gate.message).toBeNull();
  });

  it('waits for 2P when 1P is ready mouse and 2P is joined mobile but not calibrated', () => {
    let slots = createInitialSlots();
    // 1P mouse joined
    slots = chooseSlotInput(slots, 1, 'mouse').slots;
    slots = updateSlot(slots, 1, {
      player: makeProfile('pc_mouse', '마우스왕'),
    });
    expect(isSlotReady(slots[0])).toBe(true);

    // 2P mobile joined but not calibrated
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, {
      player: makeProfile('phone_2', '폰선수2'),
      isZeroCalibrated: false,
      isConnected: true,
    });
    expect(isSlotReady(slots[1])).toBe(false);

    const gate = getStartGate(slots);
    expect(gate.canStart).toBe(false);
    expect(gate.playerCount).toBe(2);
    expect(gate.waitingSlots).toEqual([2]);
    expect(gate.message).toBe('2P 준비 중');

    // Once 2P is zero calibrated, start gate opens
    slots = updateSlot(slots, 2, { isZeroCalibrated: true });
    const readyGate = getStartGate(slots);
    expect(readyGate.canStart).toBe(true);
    expect(readyGate.playerCount).toBe(2);
    expect(readyGate.message).toBeNull();
  });

  it('shows 1P·2P 준비 중 when both joined but neither is ready', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mobile').slots;
    slots = updateSlot(slots, 1, {
      player: makeProfile('phone_1', '선수1'),
      isZeroCalibrated: false,
    });
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, {
      player: makeProfile('phone_2', '선수2'),
      isZeroCalibrated: false,
    });

    const gate = getStartGate(slots);
    expect(gate.canStart).toBe(false);
    expect(gate.waitingSlots).toEqual([1, 2]);
    expect(gate.message).toBe('1P·2P 준비 중');
  });

  it('builds slot index map correctly for two players and single 2P', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: makeProfile('m', 'M') });
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: makeProfile('p', 'P') });

    const map2 = buildSlotIndexMap(slots);
    expect(map2).toEqual({ 1: 0, 2: 1 });
    expect(indexToSlot(map2, 0)).toBe(1);
    expect(indexToSlot(map2, 1)).toBe(2);
    expect(getMouseIndex(slots, map2)).toBe(0);

    // Only 2P joined
    let single2PSlots = createInitialSlots();
    single2PSlots = chooseSlotInput(single2PSlots, 2, 'mouse').slots;
    single2PSlots = updateSlot(single2PSlots, 2, { player: makeProfile('m2', 'M2') });

    const mapSingle = buildSlotIndexMap(single2PSlots);
    expect(mapSingle).toEqual({ 2: 0 });
    expect(indexToSlot(mapSingle, 0)).toBe(2);
    expect(getMouseIndex(single2PSlots, mapSingle)).toBe(0);
  });

  it('marks slot not ready when phone isDisconnected', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mobile').slots;
    slots = updateSlot(slots, 1, {
      player: makeProfile('phone_1', '선수1'),
      isZeroCalibrated: true,
      isConnected: true,
    });
    expect(isSlotReady(slots[0])).toBe(true);

    slots = updateSlot(slots, 1, { isConnected: false });
    expect(isSlotReady(slots[0])).toBe(false);
  });

  it('resets player and calibration when input changes', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mobile').slots;
    slots = updateSlot(slots, 1, {
      player: makeProfile('phone_1', '선수1'),
      isZeroCalibrated: true,
    });

    const switched = chooseSlotInput(slots, 1, 'mouse').slots;
    expect(switched[0].input).toBe('mouse');
    expect(switched[0].player).toBeUndefined();
    expect(switched[0].isZeroCalibrated).toBe(false);
  });

  describe('getSoloSlot', () => {
    it('returns slot 2 when only slot 2 is joined (슬롯 2만 참여 → 슬롯 2)', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, {
        player: makeProfile('phone_2', '선수2'),
        isConnected: true,
        isZeroCalibrated: true,
      });

      // Before map is fixed (lobby state)
      expect(getSoloSlot(undefined, slots)).toBe(2);

      // Once map is built
      const map = buildSlotIndexMap(slots);
      expect(map).toEqual({ 2: 0 });
      expect(getSoloSlot(map, slots)).toBe(2);
      expect(getSoloSlot(map)).toBe(2);
    });

    it('returns slot 1 when both slots are joined or empty', () => {
      expect(getSoloSlot()).toBe(1);

      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: makeProfile('m', 'M') });
      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, { player: makeProfile('p', 'P') });

      const map = buildSlotIndexMap(slots);
      expect(getSoloSlot(map, slots)).toBe(1);
    });
  });
});

describe('applyControllerPaired (P03-T01)', () => {
  const X = makeProfile('X', 'xx');
  const Y = makeProfile('Y', 'yy');

  it('moves a device between slots, clearing the old slot', () => {
    let slots = applyControllerPaired(createInitialSlots(), 2, X);
    slots = applyControllerPaired(slots, 1, X);
    expect(slots[0].player?.deviceId).toBe('X');
    expect(slots[1].input).toBeNull();
    expect(slots[1].player).toBeUndefined();
    slots = applyControllerPaired(slots, 2, X);
    expect(slots[1].player?.deviceId).toBe('X');
    expect(slots[0].input).toBeNull();
    expect(slots[0].player).toBeUndefined();
  });

  it('keeps a different device in the other slot', () => {
    let slots = applyControllerPaired(createInitialSlots(), 1, Y);
    slots = applyControllerPaired(slots, 2, X);
    slots = applyControllerPaired(slots, 2, X);
    expect(slots[0].player?.deviceId).toBe('Y');
    expect(slots[1].player?.deviceId).toBe('X');
  });
});

describe('shouldShowLobbyCrosshair (playtest-feedback P02-T01)', () => {
  const base = { slot: 1 as const, isConnected: true, isAway: false };
  it('shows a mouse slot as soon as it has joined', () => {
    expect(shouldShowLobbyCrosshair({ ...base, input: 'mouse', player: makeProfile('m', 'M'), isZeroCalibrated: false })).toBe(true);
  });
  it('hides a mouse slot before the nickname is confirmed', () => {
    expect(shouldShowLobbyCrosshair({ ...base, input: 'mouse', player: undefined, isZeroCalibrated: false })).toBe(false);
  });
  it('shows a mobile slot only after zeroing', () => {
    const phone = { ...base, input: 'mobile' as const, player: makeProfile('p', 'P') };
    expect(shouldShowLobbyCrosshair({ ...phone, isZeroCalibrated: false })).toBe(false);
    expect(shouldShowLobbyCrosshair({ ...phone, isZeroCalibrated: true })).toBe(true);
  });
  it('hides an empty or missing slot', () => {
    expect(shouldShowLobbyCrosshair(undefined)).toBe(false);
    expect(shouldShowLobbyCrosshair({ ...base, input: null, player: undefined, isZeroCalibrated: false })).toBe(false);
  });
});

describe('applyControllerUnsupported (미지원 폰 차단 P02-T03)', () => {
  const X = makeProfile('X', 'xx');

  it('폰으로 참여한 슬롯의 입력·프로필·영점을 비운다', () => {
    let slots = applyControllerPaired(createInitialSlots(), 1, X);
    slots = updateSlot(slots, 1, { isZeroCalibrated: true });
    const next = applyControllerUnsupported(slots, 1);
    expect(next[0].input).toBeNull();
    expect(next[0].player).toBeUndefined();
    expect(next[0].isZeroCalibrated).toBe(false);
    expect(isSlotJoined(next[0])).toBe(false);
  });

  it('이미 빈 슬롯이면 같은 배열 참조를 돌려준다', () => {
    const slots = createInitialSlots();
    expect(applyControllerUnsupported(slots, 2)).toBe(slots);
  });

  it('다른 슬롯(마우스 참여)은 건드리지 않는다', () => {
    let slots = chooseSlotInput(createInitialSlots(), 2, 'mouse').slots;
    slots = updateSlot(slots, 2, { player: makeProfile('M', 'mm') });
    slots = applyControllerPaired(slots, 1, X);
    const next = applyControllerUnsupported(slots, 1);
    expect(next[0].input).toBeNull();
    expect(next[1].input).toBe('mouse');
    expect(next[1].player?.deviceId).toBe('M');
  });
});

describe('buildSandboxSlotMap (/sensor-test 직접 진입)', () => {
  it('참여한 슬롯이 없으면 1P를 플레이어 0에 묶는다(폰이 붙기 전에도 매핑이 비지 않는다)', () => {
    expect(buildSandboxSlotMap(createInitialSlots())).toEqual({ 1: 0 });
  });

  it('2P 슬롯으로 폰이 붙으면 그 슬롯이 플레이어 0을 조종한다', () => {
    const slots = applyControllerPaired(createInitialSlots(), 2, makeProfile('X', 'xx'));
    expect(buildSandboxSlotMap(slots)).toEqual({ 2: 0 });
  });
});

describe('applyLobbyReturnDefaults', () => {
  it('fills an empty 2P with mobile and 1P with the remembered input', () => {
    const out = applyLobbyReturnDefaults(createInitialSlots(), 'mobile');
    expect(out[0].input).toBe('mobile');
    expect(out[1].input).toBe('mobile');
  });

  it('clears both mouse slots, then refills 1P with firstInput and 2P with mobile', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: makeProfile('M', 'mm') });
    const out = applyLobbyReturnDefaults(slots, 'mouse');
    expect(out[0].input).toBe('mouse');
    expect(out[0].player).toBeUndefined();
    expect(out[1].input).toBe('mobile');

    let two = chooseSlotInput(createInitialSlots(), 2, 'mouse').slots;
    two = updateSlot(two, 2, { player: makeProfile('N', 'nn') });
    const out2 = applyLobbyReturnDefaults(two, 'mobile');
    expect(out2[1].input).toBe('mobile');
    expect(out2[1].player).toBeUndefined();
  });

  it('keeps a paired phone slot untouched', () => {
    const paired = applyControllerPaired(createLobbySlots('mobile'), 2, makeProfile('P', 'pp'));
    const slots = updateSlot(paired, 2, { isZeroCalibrated: true });
    const out = applyLobbyReturnDefaults(slots, 'mobile');
    expect(out[1].input).toBe('mobile');
    expect(out[1].player?.deviceId).toBe('P');
    expect(out[1].isZeroCalibrated).toBe(true);
  });

  it('an unpaired default 2P does not block a solo start', () => {
    let slots = createLobbySlots('mobile');
    slots = updateSlot(applyControllerPaired(slots, 1, makeProfile('A', 'aa')), 1, { isZeroCalibrated: true });
    const gate = getStartGate(slots);
    expect(gate.canStart).toBe(true);
    expect(gate.playerCount).toBe(1);
  });
});
