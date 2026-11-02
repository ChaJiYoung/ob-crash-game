import { WEAPON_CONSTANTS } from '../../shared/constants';

export interface TouchPadCallbacks {
  onFeverTrigger: () => void;
}

export class UnifiedTouchPadController {
  private callbacks: TouchPadCallbacks;
  private lastTapMs = 0;

  constructor(callbacks: TouchPadCallbacks) {
    this.callbacks = callbacks;
  }

  public handlePointerDown(nowMs?: number): void {
    const now = nowMs ?? performance.now();
    const doubleTapWindow = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS; // 300ms

    // Check for double-tap to trigger Fever
    if (this.lastTapMs > 0 && now - this.lastTapMs <= doubleTapWindow) {
      this.lastTapMs = 0;
      this.callbacks.onFeverTrigger();
      return;
    }

    this.lastTapMs = now;
  }

  public handlePointerUp(_nowMs?: number): void {
    // Pure cocking/snap: touch release does not trigger shots or timer cleanup
  }

  public dispose(): void {
    this.lastTapMs = 0;
  }
}
