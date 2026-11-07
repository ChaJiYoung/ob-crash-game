import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { detectDoubleClick } from '../src/pc/mouseFever';

describe('detectDoubleClick', () => {
  it('does not trigger on the first click and remembers its time', () => {
    expect(detectDoubleClick(0, 1000, 300)).toEqual({ triggered: false, nextLastClickMs: 1000 });
  });

  it('triggers on a second click inside the window and clears the reference', () => {
    expect(detectDoubleClick(1000, 1200, 300)).toEqual({ triggered: true, nextLastClickMs: 0 });
    expect(detectDoubleClick(1000, 1300, 300).triggered).toBe(true);
  });

  it('treats a slow second click as a new first click', () => {
    expect(detectDoubleClick(1000, 1301, 300)).toEqual({ triggered: false, nextLastClickMs: 1301 });
  });

  it('does not trigger twice on a triple click', () => {
    const second = detectDoubleClick(1000, 1100, 300);
    const third = detectDoubleClick(second.nextLastClickMs, 1200, 300);
    expect(second.triggered).toBe(true);
    expect(third.triggered).toBe(false);
  });
});

describe('mouse controls wiring', () => {
  const canvas = fs.readFileSync('src/pc/components/GameCanvas3D.tsx', 'utf8');
  const page = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
  const adapter = fs.readFileSync('src/pc/input/MouseAdapter.ts', 'utf8');
  const processor = fs.readFileSync('src/pc/input/PlayerActionProcessor.ts', 'utf8');

  it('fever uses the double-click helper and the shared window in MouseAdapter, not the Space key', () => {
    // T05: 마우스 피버 감지는 GameCanvas3D 대신 MouseAdapter가 수행
    expect(adapter).toContain('detectDoubleClick');
    expect(adapter).toContain('FEVER_DOUBLE_TAP_MS');
    expect(canvas).not.toContain("'Space'");
    expect(canvas).not.toContain("'keydown'");
  });

  it('the R key no longer fires the skill but right-click still does', () => {
    expect(page).not.toContain("'KeyR'");
    expect(page).toContain("'contextmenu'");
  });

  it('fever auto-fire also runs in the tutorial, where the fever training step needs it', () => {
    // T05: 피버 자동 연사 루프는 PCGamePage 대신 PlayerActionProcessor.tick()이 담당
    expect(processor).toContain("phase === 'TUTORIAL'");
  });
});
