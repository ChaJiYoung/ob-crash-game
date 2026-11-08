import { describe, it, expect } from 'vitest';
import { formatPanelFeverText, formatPanelFeverBonus } from '../src/pc/components/PlayerPanel';
import { GAME_TUNING } from '../src/shared/gameTuning';

describe('player panel fever display', () => {
  it('shows the state text', () => {
    expect(formatPanelFeverText(true, false, 100)).toBe('⚡ FEVER TIME!');
    expect(formatPanelFeverText(false, true, 100)).toBe('FEVER READY');
    expect(formatPanelFeverText(false, false, 40)).toBe('FEVER GAUGE 40%');
  });

  it('bonus line uses the tuned score and damage multipliers', () => {
    const t = formatPanelFeverBonus();
    expect(t).toContain(`점수 ${GAME_TUNING.fever.scoreMult}배`);
    expect(t).toContain(`대미지 ${GAME_TUNING.judgment.feverDamage}배`);
  });
});
