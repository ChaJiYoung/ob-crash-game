import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('combat HUD compositing cost (gameplay-polish P01-T06)', () => {
  it.each(['src/pc/components/ArcadeOverlayHUD.tsx', 'src/pc/components/CrosshairOverlay.tsx'])(
    '%s has no blur, shadow, or grayscale filters',
    (file) => {
      const src = read(file);
      expect(src).not.toContain('backdropFilter');
      expect(src).not.toContain('boxShadow');
      expect(src).not.toContain('drop-shadow');
      expect(src).not.toContain('grayscale(');
    }
  );

  it('JudgmentBanner uses a single-layer text shadow', () => {
    const src = read('src/pc/components/JudgmentBanner.tsx');
    const shadows = src.match(/textShadow:\s*[^\n]*/g) ?? [];
    shadows.forEach((line) => {
      expect(line).not.toMatch(/,\s*0\s/);
    });
  });

  it('PCGamePage no longer drives shot FX or HP bars through React state', () => {
    const src = read('src/pc/PCGamePage.tsx');
    expect(src).not.toContain('setLastShootResult');
    expect(src).not.toContain('setMonsterProjections');
  });

  it('plays the shoot and skill sounds exactly once (in the page, not the canvas)', () => {
    const canvas = read('src/pc/components/GameCanvas3D.tsx');
    expect(canvas).not.toContain('playWeaponShoot');
    expect(canvas).not.toContain('playSkillActivation');

    const page = read('src/pc/PCGamePage.tsx');
    expect(page.match(/playWeaponShoot/g)?.length).toBe(1);
    expect(page.match(/playSkillActivation/g)?.length).toBe(1);
  });

  it('PCGamePage has no INTERCEPTED banner (gameplay-polish P02-T02)', () => {
    const src = read('src/pc/PCGamePage.tsx');
    expect(src).not.toContain('INTERCEPTED');
    expect(src).not.toContain('interceptedBannerKey');
    expect(src).not.toContain('fadeUp');
    expect(src).toContain('playInterceptSound');
  });
});
