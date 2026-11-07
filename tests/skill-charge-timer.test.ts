import { describe, it, expect } from 'vitest';
import { formatWeaponSkillBadge } from '../src/pc/components/ArcadeOverlayHUD';
import { formatControllerSkillStatus } from '../src/controller/components/GunGripPad';

describe('next skill charge timer', () => {
  it('PC badge shows next charge seconds only while partly charged', () => {
    expect(formatWeaponSkillBadge('revolver', 1, 1, 2, 4200).skillStatusText).toContain('[★1/2 · 다음 4.2s]');
    expect(formatWeaponSkillBadge('revolver', 1, 2, 2, 0).skillStatusText).toContain('[★2/2]');
    expect(formatWeaponSkillBadge('revolver', 1, 0, 2, 3000).skillStatusText).toBe('쿨다운 3.0s');
  });

  it('controller text shows stock and next charge seconds while partly charged', () => {
    expect(formatControllerSkillStatus('S', 1, 2, 4200)).toContain('(1/2 · 다음 충전 4.2s)');
    expect(formatControllerSkillStatus('S', 2, 2, 0)).toBe("⚡ S READY! 총구를 위로 '휙!' 젖히기");
    expect(formatControllerSkillStatus('S', 0, 2, 3000)).toBe('스킬 재충전 중... 3.0s');
  });
});
