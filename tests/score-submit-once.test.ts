import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Regression (QA R3 Q2-5): the 100ms HUD tick must key the one-shot
// GAMEOVER/VICTORY transition off the synchronously-updated ref, not the
// stale React state captured by the effect closure, or a slow re-render
// makes the next tick submit scores a second time.
describe('end-of-match score submit is one-shot', () => {
  const src = readFileSync(resolve(__dirname, '../src/pc/PCGamePage.tsx'), 'utf8');

  it('GAMEOVER branch gates on gamePhaseRef.current', () => {
    expect(src).toMatch(/engine\.gamePhase === 'GAMEOVER' && gamePhaseRef\.current === 'PLAYING'/);
    expect(src).not.toMatch(/engine\.gamePhase === 'GAMEOVER' && gamePhase === 'PLAYING'/);
  });

  it('VICTORY branch gates on gamePhaseRef.current', () => {
    expect(src).toMatch(/engine\.gamePhase === 'VICTORY' && gamePhaseRef\.current === 'PLAYING'/);
    expect(src).not.toMatch(/engine\.gamePhase === 'VICTORY' && gamePhase === 'PLAYING'/);
  });
});
