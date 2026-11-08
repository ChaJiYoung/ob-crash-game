import { describe, it, expect } from 'vitest';
import {
  createInitialSlots,
  chooseSlotInput,
  updateSlot,
  decideLobbyStart,
  buildSlotIndexMap,
  SlotPair,
} from '../src/pc/coopSlots';
import { buildScoreSubmissions } from '../src/pc/scoreSubmission';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import type { PlayerProfile } from '../src/shared/types';

const mockProfile = (deviceId: string, nickname: string): PlayerProfile => ({
  deviceId,
  nickname,
  bestScore: 1000,
  totalGames: 5,
  lastPlayedAt: '2026-11-07T00:00:00.000Z',
});

describe('Coop Start and Result Flow (P04-T05)', () => {
  describe('decideLobbyStart', () => {
    it('returns start: false and notice when both slots are empty', () => {
      const slots = createInitialSlots();
      const res = decideLobbyStart(slots);
      expect(res.start).toBe(false);
      if (!res.start) {
        expect(res.notice).toBe('플레이어를 연결하세요');
      }
    });

    it('returns start: false and "2P 준비 중" when 1P is ready and 2P joined but zero not calibrated', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('dm', 'Mouse') });

      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, {
        player: mockProfile('dp2', 'Phone2'),
        isConnected: true,
        isZeroCalibrated: false,
      });

      const res = decideLobbyStart(slots);
      expect(res.start).toBe(false);
      if (!res.start) {
        expect(res.notice).toBe('2P 준비 중');
      }
    });

    it('returns start: true with playerCount: 1 for mouse-only solo', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('dm', 'Mouse') });

      const res = decideLobbyStart(slots);
      expect(res.start).toBe(true);
      if (res.start) {
        expect(res.playerCount).toBe(1);
        expect(res.map[1]).toBe(0);
      }
    });

    it('returns start: true with playerCount: 1 for single phone slot', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mobile').slots;
      slots = updateSlot(slots, 1, {
        player: mockProfile('dp1', 'Phone1'),
        isConnected: true,
        isZeroCalibrated: true,
      });

      const res = decideLobbyStart(slots);
      expect(res.start).toBe(true);
      if (res.start) {
        expect(res.playerCount).toBe(1);
        expect(res.map[1]).toBe(0);
      }
    });

    it('returns start: true with playerCount: 2 when both slots ready', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('dm', 'Mouse') });

      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, {
        player: mockProfile('dp2', 'Phone2'),
        isConnected: true,
        isZeroCalibrated: true,
      });

      const res = decideLobbyStart(slots);
      expect(res.start).toBe(true);
      if (res.start) {
        expect(res.playerCount).toBe(2);
        expect(res.map[1]).toBe(0);
        expect(res.map[2]).toBe(1);
      }
    });
  });

  describe('buildScoreSubmissions', () => {
    it('creates 1 submission message in solo mode with mode: solo and no coop info', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 1 });

      // Player 0 earns some score
      engine.getPlayer(0).scoreManager.registerHit('PERFECT', 100, true);
      engine.gamePhase = 'GAMEOVER';

      const slots: SlotPair = [
        {
          slot: 1,
          input: 'mouse',
          player: mockProfile('dev-solo', 'SoloPlayer'),
          isConnected: true,
          isZeroCalibrated: true,
          isAway: false,
        },
        {
          slot: 2,
          input: null,
          player: undefined,
          isConnected: true,
          isZeroCalibrated: false,
          isAway: false,
        },
      ];
      const map = buildSlotIndexMap(slots);

      const submissions = buildScoreSubmissions(engine, slots, map, 'ROOM_SOLO');
      expect(submissions).toHaveLength(1);
      const sub = submissions[0];
      expect(sub.type).toBe('GAME_SCORE_SUBMIT');
      expect(sub.roomId).toBe('ROOM_SOLO');
      expect(sub.deviceId).toBe('dev-solo');
      expect(sub.mode).toBe('solo');
      expect(sub.stats?.mode).toBe('solo');
      expect(sub.stats?.coop).toBeUndefined();
      expect(sub.stats?.inputKind).toBe('mouse');
    });

    it('creates 2 submission messages in coop mode with mode: coop, partner info cross-linked, and teamScore', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 2 });

      // Player 0 and Player 1 earn scores
      engine.getPlayer(0).scoreManager.registerHit('PERFECT', 100, true);
      engine.getPlayer(1).scoreManager.registerHit('PERFECT', 200, true);
      engine.gamePhase = 'GAMEOVER';

      const slots: SlotPair = [
        {
          slot: 1,
          input: 'mouse',
          player: mockProfile('dev-p1', 'PlayerOne'),
          isConnected: true,
          isZeroCalibrated: true,
          isAway: false,
        },
        {
          slot: 2,
          input: 'mobile',
          player: mockProfile('dev-p2', 'PlayerTwo'),
          isConnected: true,
          isZeroCalibrated: true,
          isAway: false,
        },
      ];
      const map = buildSlotIndexMap(slots);

      const submissions = buildScoreSubmissions(engine, slots, map, 'ROOM_COOP');
      expect(submissions).toHaveLength(2);

      const [sub1, sub2] = submissions;
      expect(sub1.mode).toBe('coop');
      expect(sub2.mode).toBe('coop');

      expect(sub1.deviceId).toBe('dev-p1');
      expect(sub2.deviceId).toBe('dev-p2');

      // Check partner linking
      expect(sub1.stats?.coop?.slot).toBe(1);
      expect(sub1.stats?.coop?.partnerDeviceId).toBe('dev-p2');
      expect(sub1.stats?.coop?.partnerNickname).toBe('PlayerTwo');

      expect(sub2.stats?.coop?.slot).toBe(2);
      expect(sub2.stats?.coop?.partnerDeviceId).toBe('dev-p1');
      expect(sub2.stats?.coop?.partnerNickname).toBe('PlayerOne');

      // Team scores match
      expect(sub1.stats?.coop?.teamScore).toBe(sub2.stats?.coop?.teamScore);

      // Input kinds and partner weapon/input are cross-linked
      expect(sub1.stats?.inputKind).toBe('mouse');
      expect(sub2.stats?.inputKind).toBe('mobile');
      expect(sub1.stats?.coop?.partnerInputKind).toBe('mobile');
      expect(sub2.stats?.coop?.partnerInputKind).toBe('mouse');
      expect(sub1.stats?.coop?.partnerWeaponKind).toBe(engine.getPlayRunStats(1)?.weaponKind);
      expect(sub2.stats?.coop?.partnerWeaponKind).toBe(engine.getPlayRunStats(0)?.weaponKind);
    });
  });
});
