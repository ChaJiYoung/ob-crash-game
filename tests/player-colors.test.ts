import { describe, it, expect } from 'vitest';
import {
  computeCrosshairVisualSpec,
  formatCrosshairNameTag,
} from '../src/pc/components/CrosshairOverlay';
import { getPlayerPresentation } from '../src/pc/playerPresentation';
import { createInitialSlots, chooseSlotInput } from '../src/pc/coopSlots';

describe('Player colors and crosshair visual spec', () => {
  it('applies playerColor while preserving badgeText during fever', () => {
    const spec = computeCrosshairVisualSpec({
      playerColor: '#ff6b3d',
      isFeverActive: true,
      weaponKind: 'shotgun',
    });
    expect(spec.primaryColor).toBe('#ff6b3d');
    expect(spec.glowColor).toBe('#ff6b3d99');
    expect(spec.badgeText).toBe('FEVER UNLIMITED');
  });

  it('keeps original amber / gold color when playerColor is omitted (solo fallback)', () => {
    const feverSpec = computeCrosshairVisualSpec({
      isFeverActive: true,
      weaponKind: 'shotgun',
    });
    expect(feverSpec.primaryColor).toBe('#fbbf24');
    expect(feverSpec.badgeText).toBe('FEVER UNLIMITED');

    const defaultShotgunSpec = computeCrosshairVisualSpec({
      weaponKind: 'shotgun',
    });
    expect(defaultShotgunSpec.primaryColor).toBe('#f59e0b');
  });

  it('formats crosshair name tags according to weapon, level, and player slot', () => {
    expect(formatCrosshairNameTag('shotgun', 1, '1P')).toBe('1P · SHOTGUN Lv.1');
    expect(formatCrosshairNameTag('gatling', 4, null)).toBe('GATLING Lv.MAX');
    expect(formatCrosshairNameTag('revolver', 3, '2P')).toBe('2P · REVOLVER Lv.3');
    expect(formatCrosshairNameTag('shotgun', 2, null)).toBe('SHOTGUN Lv.2');
  });

  it('getPlayerPresentation returns player colors for coop and solo fallback', () => {
    const soloRes = chooseSlotInput(createInitialSlots(), 1, 'mouse');
    const [solo] = getPlayerPresentation({
      playerCount: 1,
      slotIndexMap: { 1: 0 },
      slots: soloRes.slots,
    });
    expect(solo.ringColorMode).toBe('state');
    expect(solo.slotLabel).toBeNull();
    expect(solo.popupSide).toBe('center');

    const p1Res = chooseSlotInput(createInitialSlots(), 1, 'mobile');
    const coopRes = chooseSlotInput(p1Res.slots, 2, 'mouse');
    const [p1, p2] = getPlayerPresentation({
      playerCount: 2,
      slotIndexMap: { 1: 0, 2: 1 },
      slots: coopRes.slots,
    });
    expect(p1.ringColorMode).toBe('player');
    expect(p1.color).toBe('#38bdf8');
    expect(p1.slotLabel).toBe('1P');
    expect(p1.popupSide).toBe('left');

    expect(p2.ringColorMode).toBe('player');
    expect(p2.color).toBe('#ff6b3d');
    expect(p2.slotLabel).toBe('2P');
    expect(p2.popupSide).toBe('right');
  });
});
