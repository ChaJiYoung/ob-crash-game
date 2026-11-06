export interface DoubleClickResult {
  triggered: boolean;
  nextLastClickMs: number;
}

/**
 * Same rule as the phone's double tap: the second press within the window triggers, and the
 * reference time is cleared so a third quick click does not trigger again.
 * (The browser's own dblclick event is not used: its timing is an OS setting.)
 */
export function detectDoubleClick(lastClickMs: number, nowMs: number, windowMs: number): DoubleClickResult {
  if (lastClickMs > 0 && nowMs - lastClickMs <= windowMs) {
    return { triggered: true, nextLastClickMs: 0 };
  }
  return { triggered: false, nextLastClickMs: nowMs };
}
