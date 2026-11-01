import { WEAPON_CONSTANTS } from '../../shared/constants';

export class WeaponSystem {
  private ammo: number = WEAPON_CONSTANTS.MAX_AMMO;
  private isReloading = false;
  private reloadEndTimeMs = 0;
  private lastFireTimeMs = 0;

  public canFire(nowMs: number, isFeverActive: boolean): boolean {
    if (nowMs - this.lastFireTimeMs < WEAPON_CONSTANTS.RAPID_FIRE_INTERVAL_MS) {
      return false;
    }

    if (isFeverActive) {
      return true; // Infinite ammo during fever
    }

    if (this.isReloading) {
      return false;
    }

    return this.ammo > 0;
  }

  public consumeShot(
    nowMs: number,
    isFeverActive: boolean
  ): { fired: boolean; ammo: number; isReloading: boolean } {
    if (!this.canFire(nowMs, isFeverActive)) {
      return { fired: false, ammo: this.ammo, isReloading: this.isReloading };
    }

    this.lastFireTimeMs = nowMs;

    if (isFeverActive) {
      return { fired: true, ammo: WEAPON_CONSTANTS.MAX_AMMO, isReloading: false };
    }

    this.ammo -= 1;
    if (this.ammo <= 0) {
      this.ammo = 0;
      this.isReloading = true;
      this.reloadEndTimeMs = nowMs + WEAPON_CONSTANTS.AUTO_RELOAD_MS;
    }

    return { fired: true, ammo: this.ammo, isReloading: this.isReloading };
  }


  public update(nowMs: number, isFeverActive: boolean): { reloadedJustNow: boolean } {
    if (isFeverActive) {
      this.isReloading = false;
      this.ammo = WEAPON_CONSTANTS.MAX_AMMO;
      return { reloadedJustNow: false };
    }

    if (this.isReloading && nowMs >= this.reloadEndTimeMs) {
      this.ammo = WEAPON_CONSTANTS.MAX_AMMO;
      this.isReloading = false;
      return { reloadedJustNow: true };
    }

    return { reloadedJustNow: false };
  }

  public getState() {
    return {
      ammo: this.ammo,
      maxAmmo: WEAPON_CONSTANTS.MAX_AMMO,
      isReloading: this.isReloading,
      reloadEndTimeMs: this.reloadEndTimeMs,
    };
  }

  public reset(): void {
    this.ammo = WEAPON_CONSTANTS.MAX_AMMO;
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
    this.lastFireTimeMs = 0;
  }
}
