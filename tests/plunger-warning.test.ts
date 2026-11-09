import { describe, it, expect } from 'vitest';
import { isPlungerBlastImminent, PLUNGER_BLAST_WARNING_MS } from '../src/pc/three/plungerWarning';

describe('isPlungerBlastImminent', () => {
  const blast = { damage: 0.7, ownerIndex: 0 };
  it('is true only in the last 500ms before the blast', () => {
    expect(PLUNGER_BLAST_WARNING_MS).toBe(500);
    expect(isPlungerBlastImminent(blast, 3000, 2499)).toBe(false); // 남은 501ms
    expect(isPlungerBlastImminent(blast, 3000, 2500)).toBe(true); // 남은 500ms
    expect(isPlungerBlastImminent(blast, 3000, 2999)).toBe(true); // 남은 1ms
  });
  it('is false once the stun is over or without a stuck plunger', () => {
    expect(isPlungerBlastImminent(blast, 3000, 3000)).toBe(false);
    expect(isPlungerBlastImminent(blast, 3000, 3500)).toBe(false);
    expect(isPlungerBlastImminent(undefined, 3000, 2800)).toBe(false);
    expect(isPlungerBlastImminent(blast, undefined, 2800)).toBe(false);
  });
});
