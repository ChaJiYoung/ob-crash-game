import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { shouldSendSkillSnap } from '../src/controller/sensors/GunGripTracker';
import { GAME_TUNING } from '../src/shared/gameTuning';

describe('one skill per wrist snap', () => {
  it('engine rejects a second skill inside the reuse lock without spending stock', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.weaponSystem.selectWeapon('revolver', 1);
    e.weaponSystem.refillSkillInstant();
    expect(e.weaponSystem.getState().skillStock).toBe(2);
    expect(e.triggerWeaponSkill(1000).activated).toBe(true);
    expect(e.triggerWeaponSkill(1000 + GAME_TUNING.skillInput.reuseLockMs - 1).activated).toBe(false);
    expect(e.weaponSystem.getState().skillStock).toBe(1);
    expect(e.triggerWeaponSkill(1000 + GAME_TUNING.skillInput.reuseLockMs).activated).toBe(true);
  });

  it('controller sends the skill signal once per debounce window', () => {
    const d = GAME_TUNING.skillInput.snapDebounceMs;
    expect(shouldSendSkillSnap(1000, -Infinity)).toBe(true);
    expect(shouldSendSkillSnap(1000 + d - 1, 1000)).toBe(false);
    expect(shouldSendSkillSnap(1000 + d, 1000)).toBe(true);
  });
});
