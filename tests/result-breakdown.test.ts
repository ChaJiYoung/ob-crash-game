import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultRankingModal } from '../src/pc/components/ResultRankingModal';

const base = {
  score: 18000,
  maxCombo: 120,
  waveReached: 7,
  rankings: [],
  onRestart: () => {},
  onReturnToLobby: () => {},
};

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(ResultRankingModal, { ...base, ...props } as any));

describe('result screen score breakdown (score-differentiation P01-T02)', () => {
  it('shows base, time bonus and precision bonus when the bonuses are non-zero', () => {
    const html = render({ gamePhase: 'VICTORY', breakdown: { base: 11000, timeBonus: 4200, precisionBonus: 2800 } });
    expect(html).toContain('score-breakdown');
    expect(html).toContain('기본 11000점');
    expect(html).toContain('시간 보너스 +4200점');
    expect(html).toContain('정밀도 보너스 +2800점');
  });

  it('hides zero bonuses (a defeat has no precision bonus)', () => {
    const html = render({ gamePhase: 'GAMEOVER', breakdown: { base: 9000, timeBonus: 1400, precisionBonus: 0 } });
    expect(html).toContain('시간 보너스 +1400점');
    expect(html).not.toContain('정밀도 보너스');
  });

  it('shows no breakdown block when there are no bonuses at all', () => {
    const html = render({ gamePhase: 'GAMEOVER', breakdown: { base: 500, timeBonus: 0, precisionBonus: 0 } });
    expect(html).not.toContain('score-breakdown');
  });

  it('shows the final wave clear on a victory (the last wave has no in-game banner)', () => {
    const html = render({
      gamePhase: 'VICTORY',
      breakdown: { base: 11000, timeBonus: 4200, precisionBonus: 2800 },
      lastWaveClear: { wave: 7, seconds: 58.34, bonus: 1260 },
    });
    expect(html).toContain('last-wave-clear');
    expect(html).toContain('WAVE 7 CLEAR');
    expect(html).toContain('58.3초');
    expect(html).toContain('+1260점');
  });

  it('does not show the last wave line on a defeat', () => {
    const html = render({
      gamePhase: 'GAMEOVER',
      breakdown: { base: 9000, timeBonus: 1400, precisionBonus: 0 },
      lastWaveClear: { wave: 4, seconds: 30, bonus: 700 },
    });
    expect(html).not.toContain('last-wave-clear');
  });
});
