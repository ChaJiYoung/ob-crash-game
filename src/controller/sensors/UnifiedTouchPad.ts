import { WEAPON_CONSTANTS } from '../../shared/constants';

export interface TouchPadCallbacks {
  onSingleTapFire: () => void;
  onFeverTrigger: () => void;
}

export class UnifiedTouchPadController {
  private callbacks: TouchPadCallbacks;
  private lastTapMs = 0;
  private isPointerHeld = false;

  constructor(callbacks: TouchPadCallbacks) {
    this.callbacks = callbacks;
  }

  public handlePointerDown(nowMs?: number): void {
    if (this.isPointerHeld) {
      return;
    }
    this.isPointerHeld = true;

    const now = nowMs ?? performance.now();
    const doubleTapWindow = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS; // 300ms

    // Immediately fire 1 shot with 0ms delay
    this.callbacks.onSingleTapFire();

    // Check for double-tap to trigger Fever
    if (this.lastTapMs > 0 && now - this.lastTapMs <= doubleTapWindow) {
      this.lastTapMs = 0;
      this.callbacks.onFeverTrigger();
      return;
    }

    this.lastTapMs = now;
  }

  public handlePointerUp(_nowMs?: number): void {
    this.isPointerHeld = false;
  }

  public dispose(): void {
    this.lastTapMs = 0;
    this.isPointerHeld = false;
  }
}
