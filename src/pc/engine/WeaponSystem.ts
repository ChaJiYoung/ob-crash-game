import { WEAPON_ARCHETYPE_SPECS, WEAPON_CONSTANTS } from '../../shared/constants';
import { WeaponKind, WeaponLevel, WeaponLevelSpec } from '../../shared/types';

export interface WeaponState {
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadEndTimeMs: number;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  skillCooldownTotalMs: number;
  hasRapidReloadBuff: boolean;
}

export class WeaponSystem {
  private weaponKind: WeaponKind = 'shotgun';
  private weaponLevel: WeaponLevel = 1;
  private ammo: number = 5;
  private isReloading = false;
  private reloadEndTimeMs = 0;
  private lastFireTimeMs = 0;
  public infiniteAmmo = false;
  private hasRapidReloadBuff = false;

  // Active Skill State
  private skillStock = 1;
  private skillCooldownRemainingMs = 0;
  private lastUpdateMs = 0;

  constructor(initialKind: WeaponKind = 'shotgun', initialLevel: WeaponLevel = 1) {
    this.selectWeapon(initialKind, initialLevel);
  }

  public getCurrentLevelSpec(): WeaponLevelSpec {
    return WEAPON_ARCHETYPE_SPECS[this.weaponKind].levels[this.weaponLevel];
  }

  public getMaxAmmo(): number {
    const base = this.getCurrentLevelSpec().maxAmmo;
    return base + (this.hasRapidReloadBuff ? 2 : 0);
  }

  public getReloadDurationMs(): number {
    const base = this.getCurrentLevelSpec().reloadDurationMs;
    return Math.round(base * (this.hasRapidReloadBuff ? 0.8 : 1.0));
  }

  public getFireIntervalMs(): number {
    return this.getCurrentLevelSpec().fireIntervalMs;
  }

  public getMaxSkillStock(): number {
    return this.getCurrentLevelSpec().maxSkillStock;
  }

  public getSkillCooldownTotalMs(): number {
    return this.getCurrentLevelSpec().skillCooldownMs;
  }

  public selectWeapon(kind: WeaponKind, level: WeaponLevel = 1): void {
    this.weaponKind = kind;
    this.weaponLevel = level;
    this.ammo = this.getMaxAmmo();
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
    this.skillStock = this.getMaxSkillStock();
    this.skillCooldownRemainingMs = 0;
  }

  public upgradeWeaponLevel(): WeaponLevel {
    if (this.weaponLevel < 4) {
      this.weaponLevel = (this.weaponLevel + 1) as WeaponLevel;
      // Refill ammo on level up
      this.ammo = this.getMaxAmmo();
      this.isReloading = false;
      // If reached MAX (Lv.4), grant 2 skill stocks immediately
      if (this.weaponLevel === 4) {
        this.skillStock = 2;
        this.skillCooldownRemainingMs = 0;
      }
    } else {
      // Re-upgrading at MAX refills skill instant
      this.refillSkillInstant();
    }
    return this.weaponLevel;
  }

  public applyRapidReloadBuff(): void {
    this.hasRapidReloadBuff = true;
    this.ammo = Math.min(this.getMaxAmmo(), this.ammo + 2);
  }

  public consumeSkill(nowMs: number): boolean {
    if (this.skillStock <= 0) {
      return false;
    }
    this.skillStock -= 1;
    // If not already in cooldown countdown, start one
    if (this.skillCooldownRemainingMs <= 0) {
      this.skillCooldownRemainingMs = this.getSkillCooldownTotalMs();
    }
    this.lastUpdateMs = nowMs;
    return true;
  }

  public refillSkillInstant(): void {
    this.skillStock = this.getMaxSkillStock();
    this.skillCooldownRemainingMs = 0;
  }

  public setInfiniteAmmo(enabled: boolean): void {
    this.infiniteAmmo = enabled;
  }

  public canFire(nowMs: number, isFeverActive: boolean): boolean {
    const fireInterval = isFeverActive
      ? WEAPON_CONSTANTS.FEVER_AUTO_FIRE_INTERVAL_MS
      : this.getFireIntervalMs();

    if (nowMs - this.lastFireTimeMs < fireInterval) {
      return false;
    }

    if (this.infiniteAmmo || isFeverActive) {
      return true; // Infinite ammo during fever or sandbox mode
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

    if (this.infiniteAmmo || isFeverActive) {
      return { fired: true, ammo: this.getMaxAmmo(), isReloading: false };
    }

    this.ammo -= 1;
    if (this.ammo <= 0) {
      this.ammo = 0;
      this.isReloading = true;
      this.reloadEndTimeMs = nowMs + this.getReloadDurationMs();
    }

    return { fired: true, ammo: this.ammo, isReloading: this.isReloading };
  }

  public update(
    nowMs: number,
    isFeverActive: boolean = false,
    deltaMs?: number
  ): { reloadedJustNow: boolean } {
    const dt = deltaMs !== undefined ? deltaMs : this.lastUpdateMs > 0 ? Math.max(0, nowMs - this.lastUpdateMs) : 0;
    this.lastUpdateMs = nowMs;

    // Update skill cooldown
    const maxStock = this.getMaxSkillStock();
    if (this.skillStock < maxStock) {
      if (this.skillCooldownRemainingMs <= 0) {
        this.skillCooldownRemainingMs = this.getSkillCooldownTotalMs();
      }
      this.skillCooldownRemainingMs -= dt;
      if (this.skillCooldownRemainingMs <= 0) {
        this.skillStock += 1;
        if (this.skillStock < maxStock) {
          this.skillCooldownRemainingMs = this.getSkillCooldownTotalMs();
        } else {
          this.skillCooldownRemainingMs = 0;
        }
      }
    } else {
      this.skillCooldownRemainingMs = 0;
    }

    if (isFeverActive) {
      this.isReloading = false;
      this.ammo = this.getMaxAmmo();
      return { reloadedJustNow: false };
    }

    if (this.isReloading && nowMs >= this.reloadEndTimeMs) {
      this.ammo = this.getMaxAmmo();
      this.isReloading = false;
      return { reloadedJustNow: true };
    }

    return { reloadedJustNow: false };
  }

  public shiftReloadTimer(deltaMs: number): void {
    if (this.isReloading && deltaMs > 0) {
      this.reloadEndTimeMs += deltaMs;
    }
  }

  public getState(): WeaponState {
    return {
      ammo: this.ammo,
      maxAmmo: this.getMaxAmmo(),
      isReloading: this.isReloading,
      reloadEndTimeMs: this.reloadEndTimeMs,
      weaponKind: this.weaponKind,
      weaponLevel: this.weaponLevel,
      skillStock: this.skillStock,
      maxSkillStock: this.getMaxSkillStock(),
      skillCooldownRemainingMs: Math.max(0, this.skillCooldownRemainingMs),
      skillCooldownTotalMs: this.getSkillCooldownTotalMs(),
      hasRapidReloadBuff: this.hasRapidReloadBuff,
    };
  }

  public reset(): void {
    this.weaponKind = 'shotgun';
    this.weaponLevel = 1;
    this.hasRapidReloadBuff = false;
    this.ammo = this.getMaxAmmo();
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
    this.lastFireTimeMs = 0;
    this.lastUpdateMs = 0;
    this.infiniteAmmo = false;
    this.skillStock = 1;
    this.skillCooldownRemainingMs = 0;
  }
}
