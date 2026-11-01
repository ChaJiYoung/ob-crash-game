import { WEAPON_CONSTANTS } from '../../shared/constants';

export interface TouchPadCallbacks {
  onRapidFireChange: (active: boolean) => void;
  onFeverTrigger: () => void;
}

export class UnifiedTouchPadController {
  private callbacks: TouchPadCallbacks;
  private lastTapMs = 0;
  private holdTimer: NodeJS.Timeout | null = null;
  private isRapidFiring = false;

  constructor(callbacks: TouchPadCallbacks) {
    this.callbacks = callbacks;
  }

  public handlePointerDown(nowMs?: number): void {
    const now = nowMs ?? performance.now();
    const doubleTapWindow = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS; // 300ms
    const holdThreshold = WEAPON_CONSTANTS.RAPID_FIRE_HOLD_MS; // 250ms

    // Check for double-tap
    if (this.lastTapMs > 0 && now - this.lastTapMs <= doubleTapWindow) {
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
      this.lastTapMs = 0;
      this.callbacks.onFeverTrigger();
      return;
    }

    this.lastTapMs = now;

    // Start hold timer for continuous rapid fire
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
    }

    this.holdTimer = setTimeout(() => {
      this.isRapidFiring = true;
      this.callbacks.onRapidFireChange(true);
      this.holdTimer = null;
    }, holdThreshold);
  }

  public handlePointerUp(nowMs?: number): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    if (this.isRapidFiring) {
      this.isRapidFiring = false;
      this.callbacks.onRapidFireChange(false);
    }
  }

  public dispose(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.isRapidFiring = false;
    this.lastTapMs = 0;
  }
}
