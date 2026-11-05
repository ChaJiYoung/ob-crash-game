import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canOpenPauseMenu } from '../src/pc/pauseFlow';
import { PauseMenuOverlay } from '../src/pc/components/PauseMenuOverlay';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

const open = { phase: 'PLAYING' as const, isPaused: false, isMenuOpen: false, isGuideOpen: false, countdownSec: null };

describe('canOpenPauseMenu', () => {
  it('opens only for a live run with nothing else pausing it', () => {
    expect(canOpenPauseMenu(open)).toBe(true);
    for (const phase of ['PAIRING', 'ZEROING', 'TUTORIAL', 'SANDBOX', 'GAMEOVER', 'VICTORY'] as const) {
      expect(canOpenPauseMenu({ ...open, phase })).toBe(false);
    }
    expect(canOpenPauseMenu({ ...open, isPaused: true })).toBe(false);
    expect(canOpenPauseMenu({ ...open, isMenuOpen: true })).toBe(false);
    expect(canOpenPauseMenu({ ...open, isGuideOpen: true })).toBe(false);
    expect(canOpenPauseMenu({ ...open, countdownSec: 2 })).toBe(false);
  });
});

describe('restart from the pause menu', () => {
  it('goes back to wave 1 at the weapon select once the pause is lifted first', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true });
    engine.currentWave = 4;
    engine.lives = 1;
    engine.setPaused(true, 1000);

    // startGame() itself does not clear the pause flag, which is why the page lifts it first.
    engine.setPaused(false, 2000);
    engine.startGame({ withWeaponSelect: true });

    expect(engine.isPaused).toBe(false);
    expect(engine.currentWave).toBe(1);
    expect(engine.lives).toBe(engine.maxLives);
    expect(engine.isWeaponSelectPending).toBe(true);
  });

  it('startGame alone leaves a paused engine paused', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();
    engine.setPaused(true, 1000);
    engine.startGame();
    expect(engine.isPaused).toBe(true);
  });

  it('the page never submits the abandoned run', () => {
    const source = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    const match = source.match(/const handleRestartFromPause = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain('submitScore');
    expect(match![1]).toContain('engine.setPaused(false');
  });
});

describe('PauseMenuOverlay', () => {
  const render = (props: Partial<React.ComponentProps<typeof PauseMenuOverlay>>) =>
    renderToStaticMarkup(
      React.createElement(PauseMenuOverlay, {
        reason: 'USER',
        isControllerConnected: true,
        onResume: () => {},
        onRestart: () => {},
        ...props,
      })
    );

  it('offers resume and restart and warns that the score is dropped', () => {
    const html = render({});
    expect(html).toContain('이어하기');
    expect(html).toContain('다시시작');
    expect(html).toContain('점수는 저장되지 않습니다');
    expect(html).not.toContain('disabled');
  });
});

describe('controller lost state', () => {
  const render = (props: Partial<React.ComponentProps<typeof PauseMenuOverlay>>) =>
    renderToStaticMarkup(
      React.createElement(PauseMenuOverlay, {
        reason: 'USER',
        isControllerConnected: true,
        onResume: () => {},
        onRestart: () => {},
        ...props,
      })
    );

  it('waits for the phone and blocks resume while it is gone', () => {
    const html = render({ reason: 'CONTROLLER_LOST', isControllerConnected: false });
    expect(html).toContain('폰 재연결 중');
    expect(html).toContain('disabled');
    expect(html).toContain('다시시작');
  });

  it('re-enables resume once the phone is back', () => {
    const html = render({ reason: 'CONTROLLER_LOST', isControllerConnected: true });
    expect(html).toContain('다시 연결되었습니다');
    expect(html).not.toContain('disabled');
  });

  it('a manual pause never depends on the phone', () => {
    expect(render({ reason: 'USER', isControllerConnected: false })).not.toContain('disabled');
  });

  it('the page guards resume and the guide against a missing phone', () => {
    const source = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    expect(source).toContain("pauseMenuReasonRef.current === 'CONTROLLER_LOST' && !isControllerConnectedRef.current");
    expect(source).toContain("handleOpenPauseRef.current('CONTROLLER_LOST')");
  });
});
