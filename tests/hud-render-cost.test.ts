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
});
