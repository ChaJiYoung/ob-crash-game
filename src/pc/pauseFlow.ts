import type { GamePhase } from '../shared/types';

export type PauseReason = 'USER' | 'CONTROLLER_LOST';

/**
 * The pause menu is for a live run only. The guide already pauses the game on its own, a resume
 * countdown is already a pause, and the tutorial / sandbox / lobby have nothing to lose.
 */
export function canOpenPauseMenu(input: {
  phase: GamePhase;
  isPaused: boolean;
  isMenuOpen: boolean;
  isGuideOpen: boolean;
  countdownSec: number | null;
}): boolean {
  return (
    input.phase === 'PLAYING' &&
    !input.isPaused &&
    !input.isMenuOpen &&
    !input.isGuideOpen &&
    input.countdownSec === null
  );
}
