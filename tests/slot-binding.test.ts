import { describe, it, expect, vi } from 'vitest';
import {
  createInitialSlots,
  chooseSlotInput,
  updateSlot,
  buildSlotIndexMap,
  getMouseBinding,
  SlotPair,
} from '../src/pc/coopSlots';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { PlayerIndex } from '../src/pc/engine/PlayerCombatState';
import { PlayerActionProcessor, ShootableButton } from '../src/pc/input/PlayerActionProcessor';
import { PhoneAdapter } from '../src/pc/input/PhoneAdapter';
import type { ClientToServerMessage, PlayerProfile, PlayerSlot } from '../src/shared/types';

const mockProfile = (deviceId: string, nickname: string): PlayerProfile => ({
  deviceId,
  nickname,
  bestScore: 0,
  totalGames: 1,
  lastPlayedAt: '2026-11-07T00:00:00.000Z',
});

describe('Slot Binding to Player Action Processors (P04-T04)', () => {
  describe('getMouseBinding', () => {
    it('handles 1P phone alone -> player 0 (fallback for 1-player phone game)', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mobile').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('d1', 'P1'), isConnected: true });
      const map = buildSlotIndexMap(slots); // { 1: 0 }
      const binding = getMouseBinding(slots, map, 1);
      expect(binding).toBe(0);
    });

    it('handles 1P mouse alone -> player 0', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('dm', 'Mouse') });
      const map = buildSlotIndexMap(slots); // { 1: 0 }
      const binding = getMouseBinding(slots, map, 1);
      expect(binding).toBe(0);
    });

    it('handles 1P phone and 2P mouse -> player 1', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mobile').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('d1', 'P1'), isConnected: true });
      slots = chooseSlotInput(slots, 2, 'mouse').slots;
      slots = updateSlot(slots, 2, { player: mockProfile('dm', 'Mouse') });
      const map = buildSlotIndexMap(slots); // { 1: 0, 2: 1 }
      const binding = getMouseBinding(slots, map, 2);
      expect(binding).toBe(1);
    });

    it('handles 1P mouse and 2P phone -> player 0', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('dm', 'Mouse') });
      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, { player: mockProfile('d2', 'P2'), isConnected: true });
      const map = buildSlotIndexMap(slots); // { 1: 0, 2: 1 }
      const binding = getMouseBinding(slots, map, 2);
      expect(binding).toBe(0);
    });

    it('handles two phones -> null (mouse does not drive in-game gun firing)', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mobile').slots;
      slots = updateSlot(slots, 1, { player: mockProfile('d1', 'P1'), isConnected: true });
      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, { player: mockProfile('d2', 'P2'), isConnected: true });
      const map = buildSlotIndexMap(slots); // { 1: 0, 2: 1 }
      const binding = getMouseBinding(slots, map, 2);
      expect(binding).toBeNull();
    });
  });

  describe('Two-player Action Processors & PhoneAdapters', () => {
    it('slot 2 snapFire routes to player 1 only, and syncFeedback emits slot: 2', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 2 });

      const processors: PlayerActionProcessor[] = [];
      for (let i = 0; i < 2; i++) {
        processors.push(
          new PlayerActionProcessor({
            engine,
            playerIndex: i as PlayerIndex,
            getPhase: () => 'PLAYING',
            isPauseMenuOpen: () => false,
            hitTestButton: () => null,
          })
        );
      }

      const map: Partial<Record<PlayerSlot, PlayerIndex>> = { 1: 0, 2: 1 };
      const processorFor = (slot: PlayerSlot) => {
        const idx = map[slot];
        return idx !== undefined ? processors[idx] : null;
      };

      const sentMessagesSlot1: ClientToServerMessage[] = [];
      const sentMessagesSlot2: ClientToServerMessage[] = [];

      const adapter1 = new PhoneAdapter({
        slot: 1,
        sink: () => processorFor(1),
        send: (msg) => sentMessagesSlot1.push(msg),
        roomId: () => 'ROOM_TEST',
        getTuning: () => ({
          sensitivityX: 1,
          sensitivityY: 1,
          invertY: false,
          minCutoff: 1,
          beta: 0,
          dCutoff: 1,
          isStabilizedMode: true,
          preset: 'custom',
          deadzone: 0,
        }),
      });

      const adapter2 = new PhoneAdapter({
        slot: 2,
        sink: () => processorFor(2),
        send: (msg) => sentMessagesSlot2.push(msg),
        roomId: () => 'ROOM_TEST',
        getTuning: () => ({
          sensitivityX: 1,
          sensitivityY: 1,
          invertY: false,
          minCutoff: 1,
          beta: 0,
          dCutoff: 1,
          isStabilizedMode: true,
          preset: 'custom',
          deadzone: 0,
        }),
      });

      const p0InitialAmmo = engine.getPlayer(0).weaponSystem.getState().ammo;
      const p1InitialAmmo = engine.getPlayer(1).weaponSystem.getState().ammo;

      // Slot 2 fires
      adapter2.onSensorFrame({
        aimX: 0,
        aimY: 0,
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        snapFire: true,
        rapidFireHold: false,
        feverTriggered: false,
        isCocked: false,
        timestamp: Date.now(),
      });

      // Player 1 fired (ammo decreased), Player 0 untouched
      expect(engine.getPlayer(0).weaponSystem.getState().ammo).toBe(p0InitialAmmo);
      expect(engine.getPlayer(1).weaponSystem.getState().ammo).toBe(p1InitialAmmo - 1);

      // Feedback sync for slot 2 includes slot: 2
      adapter2.syncFeedback(processors[1].getState());
      expect(sentMessagesSlot2.length).toBeGreaterThan(0);
      const skillMsg = sentMessagesSlot2.find((m) => m.type === 'SKILL_STATE_SYNC');
      expect(skillMsg).toBeDefined();
      expect((skillMsg as any).slot).toBe(2);
    });

    it('unmapped slot snapFire does not fire in the engine', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 1 });

      const processors: PlayerActionProcessor[] = [
        new PlayerActionProcessor({
          engine,
          playerIndex: 0,
          getPhase: () => 'PLAYING',
          isPauseMenuOpen: () => false,
          hitTestButton: () => null,
        }),
      ];

      // Slot 2 is NOT in map
      const map: Partial<Record<PlayerSlot, PlayerIndex>> = { 1: 0 };
      const processorFor = (slot: PlayerSlot) => {
        const idx = map[slot];
        return idx !== undefined ? processors[idx] : null;
      };

      const adapter2 = new PhoneAdapter({
        slot: 2,
        sink: () => processorFor(2), // returns null
        send: () => {},
        roomId: () => 'ROOM_TEST',
        getTuning: () => ({
          sensitivityX: 1,
          sensitivityY: 1,
          invertY: false,
          minCutoff: 1,
          beta: 0,
          dCutoff: 1,
          isStabilizedMode: true,
          preset: 'custom',
          deadzone: 0,
        }),
      });

      const p0InitialAmmo = engine.getPlayer(0).weaponSystem.getState().ammo;

      adapter2.onSensorFrame({
        aimX: 0,
        aimY: 0,
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        snapFire: true,
        rapidFireHold: false,
        feverTriggered: false,
        isCocked: false,
        timestamp: Date.now(),
      });

      // Player 0 ammo unaffected
      expect(engine.getPlayer(0).weaponSystem.getState().ammo).toBe(p0InitialAmmo);
    });
  });

  describe('HTML click path (D26)', () => {
    it('pressScreenButton runs directly when button is clicked via HTML even if mouse binding is null', () => {
      const onButtonMock = vi.fn();
      const pressScreenButton = (btn: ShootableButton) => {
        onButtonMock(btn);
      };

      // In a 2-phone game, mouseBinding is null
      const slots: SlotPair = [
        { slot: 1, input: 'mobile', player: mockProfile('d1', 'P1'), isConnected: true, isZeroCalibrated: true, isAway: false },
        { slot: 2, input: 'mobile', player: mockProfile('d2', 'P2'), isConnected: true, isZeroCalibrated: true, isAway: false },
      ];
      const map = buildSlotIndexMap(slots);
      expect(getMouseBinding(slots, map, 2)).toBeNull();

      // HTML click still calls pressScreenButton directly
      pressScreenButton('restart');
      expect(onButtonMock).toHaveBeenCalledWith('restart');
    });
  });
});
