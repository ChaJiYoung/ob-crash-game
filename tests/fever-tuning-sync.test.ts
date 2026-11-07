import { describe, it, expect } from 'vitest';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { FEVER_CONSTANTS } from '../src/shared/constants';
import { formatFeverStatusBadge } from '../src/pc/components/ArcadeOverlayHUD';

describe('fever values come from GAME_TUNING', () => {
  it('duration constant follows tuning', () => {
    expect(FEVER_CONSTANTS.DURATION_MS).toBe(GAME_TUNING.fever.durationMs);
  });
  it('active HUD label shows tuned score and damage multipliers', () => {
    const label = formatFeverStatusBadge(100, false, true).label;
    expect(label).toContain(`점수 ${GAME_TUNING.fever.scoreMult}배`);
    expect(label).toContain(`대미지 ${GAME_TUNING.judgment.feverDamage}배`);
  });
});
