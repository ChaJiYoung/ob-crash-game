import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PlayerActionProcessor } from '../src/pc/input/PlayerActionProcessor';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import type { GamePhase } from '../src/shared/types';

describe('game start order (P03-T06)', () => {
  it('while the phase is still ZEROING a first shot is a menu shot, not a weapon-select shot (pins current behavior)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true, playerCount: 1 });
    expect(engine.isWeaponSelectPending).toBe(true);
    const buttons: string[] = [];
    const shots: boolean[] = [];
    const phase: GamePhase = 'ZEROING';
    const processor = new PlayerActionProcessor({
      engine,
      playerIndex: 0,
      getPhase: () => phase,
      isPauseMenuOpen: () => false,
      hitTestButton: () => null,
      onButton: (b) => buttons.push(b),
      onShot: (r) => shots.push(r.fired),
    });
    processor.send({ type: 'aim', aimX: 0, aimY: 0 });
    processor.send({ type: 'fireDown' });
    expect(buttons).toEqual(['start']);
    expect(shots).toEqual([]);
    processor.stopAll();
  });

  const source = readFileSync('src/pc/PCGamePage.tsx', 'utf8');

  it('handleStartGame sets PLAYING before rebuilding processors', () => {
    const start = source.indexOf('const handleStartGame = useCallback');
    const body = source.slice(start, source.indexOf('handleStartGameRef.current = handleStartGame'));
    expect(body.indexOf("setPhase('PLAYING')")).toBeGreaterThan(-1);
    expect(body.indexOf("setPhase('PLAYING')")).toBeLessThan(body.indexOf('syncProcessors()'));
  });

  it('setGamePhase is only called inside the setPhase helper, which updates the ref first', () => {
    expect(source.match(/setGamePhase\(/g)?.length).toBe(1);
    expect(source).toMatch(/gamePhaseRef\.current = next;\s*setGamePhase\(next\);/);
  });
});
