import { WEAPON_CONSTANTS } from '../../shared/constants';

export interface TouchPadCallbacks {
  onSingleTapFire: () => void;
  onFeverTrigger: () => void;
  onRapidFireHoldChange?: (holding: boolean) => void;
}

export class UnifiedTouchPadController {
  private callbacks: TouchPadCallbacks;
  private lastTapMs = 0;
  private isPointerHeld = false;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private isRapidHolding = false;

  constructor(callbacks: TouchPadCallbacks) {
    this.callbacks = callbacks;
  }

  public handlePointerDown(nowMs?: number): void {
    if (this.isPointerHeld) {
      return;
    }
    this.isPointerHeld = true;

    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    const now = nowMs ?? performance.now();
    const doubleTapWindow = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS; // 300ms

    // Immediately fire 1 shot with 0ms delay
    this.callbacks.onSingleTapFire();

    // Check for double-tap to trigger Fever
    if (this.lastTapMs > 0 && now - this.lastTapMs <= doubleTapWindow) {
      this.lastTapMs = 0;
      this.callbacks.onFeverTrigger();
    } else {
      this.lastTapMs = now;
    }

    // Start 180ms hold timer to trigger continuous rapid-fire
    this.holdTimer = setTimeout(() => {
      if (this.isPointerHeld) {
        this.isRapidHolding = true;
        this.callbacks.onRapidFireHoldChange?.(true);
      }
    }, 180);
  }

  public handlePointerUp(_nowMs?: number): void {
    this.isPointerHeld = false;
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.isRapidHolding) {
      this.isRapidHolding = false;
      this.callbacks.onRapidFireHoldChange?.(false);
    }
  }

  public dispose(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.isRapidHolding) {
      this.isRapidHolding = false;
      this.callbacks.onRapidFireHoldChange?.(false);
    }
    this.lastTapMs = 0;
    this.isPointerHeld = false;
  }
}
