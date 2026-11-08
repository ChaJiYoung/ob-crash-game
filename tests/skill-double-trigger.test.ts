import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

describe('one skill per wrist snap', () => {
  it('engine rejects a second skill inside the reuse lock without spending stock', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
    e.getPlayer(0).weaponSystem.refillSkillInstant();
    expect(e.getPlayer(0).weaponSystem.getState().skillStock).toBe(2);
    expect(e.triggerWeaponSkill(1000).activated).toBe(true);
    expect(e.triggerWeaponSkill(1000 + GAME_TUNING.skillInput.reuseLockMs - 1).activated).toBe(false);
    expect(e.getPlayer(0).weaponSystem.getState().skillStock).toBe(1);
    expect(e.triggerWeaponSkill(1000 + GAME_TUNING.skillInput.reuseLockMs).activated).toBe(true);
  });

  it('lock is per player', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false, playerCount: 2 });
    for (const i of [0, 1] as const) {
      e.getPlayer(i).weaponSystem.selectWeapon('revolver', 1);
      e.getPlayer(i).weaponSystem.refillSkillInstant();
    }
    expect(e.triggerWeaponSkill(1000, 0).activated).toBe(true);
    expect(e.triggerWeaponSkill(1100, 1).activated).toBe(true);
    expect(e.triggerWeaponSkill(1200, 0).activated).toBe(false);
  });
});
