import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultRankingModal } from '../src/pc/components/ResultRankingModal';
import { WaveLabel } from '../src/pc/components/RankingTabs';

describe('EX result modal and ranking wave label (P02-T02)', () => {
  it('renders CLEAR! · DANGER n 도달 when gamePhase is GAMEOVER and exDangerReached > 0', () => {
    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="GAMEOVER"
        score={150000}
        maxCombo={42}
        kills={300}
        waveReached={7}
        exDangerReached={3}
        rankings={[]}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('CLEAR! · DANGER 3 도달');
    expect(html).toContain('CLEAR · DANGER 3');
    expect(html).toContain('도달 단계');
    expect(html).not.toContain('GAME OVER');
  });

  it('renders GAME OVER when exDangerReached is omitted on GAMEOVER', () => {
    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="GAMEOVER"
        score={12000}
        maxCombo={10}
        kills={50}
        waveReached={4}
        rankings={[]}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('GAME OVER');
    expect(html).toContain('WAVE 4');
    expect(html).not.toContain('DANGER');
  });

  it('renders WaveLabel as CLEAR+D{n} for EX runs, CLEAR for W7, and W{n} for GAMEOVER', () => {
    const exHtml = renderToStaticMarkup(<WaveLabel waveReached={10} outcome="VICTORY" />);
    expect(exHtml).toContain('CLEAR+D3');

    const w7Html = renderToStaticMarkup(<WaveLabel waveReached={7} outcome="VICTORY" />);
    expect(w7Html).toContain('>CLEAR<');

    const deadHtml = renderToStaticMarkup(<WaveLabel waveReached={4} outcome="GAMEOVER" />);
    expect(deadHtml).toContain('W4');
  });

  it('preserves pre-run bestScore in PCGamePage so EX checkpoint does not hide NEW RECORD', () => {
    const src = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    expect(src).toContain('preRunBestScoreRef.current = pairedPlayerRef.current?.bestScore ?? 0');
    expect(src).toContain('const baseBest = preRunBestScoreRef.current ?? (curP.bestScore || 0)');
    expect(src).toContain('setIsNewRecord(up.bestScore > baseBest)');
  });
});
