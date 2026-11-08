import { WEAPON_ARCHETYPE_SPECS, WEAPON_CONSTANTS } from '../../shared/constants';
import { ShotSource, WeaponKind, WeaponLevel, WeaponLevelSpec } from '../../shared/types';
import { GAME_TUNING } from '../../shared/gameTuning';

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
  private rapidReloadStacks = 0;
  private damageBonusMultiplier = 1.0;
  private skillCooldownScale = 1.0;

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
    return base + this.rapidReloadStacks * 2;
  }

  public getReloadDurationMs(): number {
    const base = this.getCurrentLevelSpec().reloadDurationMs;
    return Math.max(450, Math.round(base * Math.pow(0.8, this.rapidReloadStacks)));
  }

  public getFireIntervalMs(source: ShotSource = 'press'): number {
    const base = this.getCurrentLevelSpec().fireIntervalMs;
    if (source === 'hold') {
      return Math.round(base * GAME_TUNING.fire.holdIntervalScaleByWeapon[this.weaponKind]);
    }
    return base;
  }

  public getMaxSkillStock(): number {
    return this.getCurrentLevelSpec().maxSkillStock;
  }

  public getSkillCooldownTotalMs(): number {
    return Math.round(this.getCurrentLevelSpec().skillCooldownMs * this.skillCooldownScale);
  }

  public addDamageBonus(amount: number): void {
    this.damageBonusMultiplier = Number((this.damageBonusMultiplier + amount).toFixed(2));
  }

  public setSkillCooldownScale(scale: number): void {
    this.skillCooldownScale = scale;
  }

  public getRapidReloadStacks(): number {
    return this.rapidReloadStacks;
  }

  public getDamageBonusMultiplier(): number {
    return this.damageBonusMultiplier;
  }

  public selectWeapon(kind: WeaponKind, level: WeaponLevel = 1): void {
    this.weaponKind = kind;
    this.weaponLevel = level;
    this.ammo = this.getMaxAmmo();
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
    // Start with no charges: the first one arrives after a full cooldown
    this.skillStock = 0;
    this.skillCooldownRemainingMs = 0;
  }

  public upgradeWeaponLevel(): WeaponLevel {
    if (this.weaponLevel < 4) {
      this.weaponLevel = (this.weaponLevel + 1) as WeaponLevel;
      // Refill ammo on level up
      this.ammo = this.getMaxAmmo();
      this.isReloading = false;
    } else {
      // Re-upgrading at MAX refills skill instant and increases base damage by +15%
      this.refillSkillInstant();
      this.damageBonusMultiplier = Number((this.damageBonusMultiplier + 0.15).toFixed(2));
    }
    return this.weaponLevel;
  }

  public applyRapidReloadBuff(): void {
    this.rapidReloadStacks += 1;
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

  public addSkillStock(amount: number): void {
    this.skillStock = Math.min(this.getMaxSkillStock(), this.skillStock + amount);
    if (this.skillStock >= this.getMaxSkillStock()) this.skillCooldownRemainingMs = 0;
  }

  public refillSkillInstant(): void {
    this.skillStock = this.getMaxSkillStock();
    this.skillCooldownRemainingMs = 0;
  }

  public setInfiniteAmmo(enabled: boolean): void {
    this.infiniteAmmo = enabled;
  }

  public canFire(nowMs: number, isFeverActive: boolean, source: ShotSource = 'press'): boolean {
    // Fever only removes the ammo limit: the fire rate stays the weapon's normal tap rate.
    const fireInterval = this.getFireIntervalMs(isFeverActive ? 'press' : source);

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
    isFeverActive: boolean,
    source: ShotSource = 'press'
  ): { fired: boolean; ammo: number; isReloading: boolean } {
    if (!this.canFire(nowMs, isFeverActive, source)) {
      return { fired: false, ammo: this.ammo, isReloading: this.isReloading };
    }

    this.lastFireTimeMs = nowMs;

    if (this.infiniteAmmo || isFeverActive) {
      // 총알은 줄지 않는다. 탄창 수와 장전 상태는 실제 값 그대로 돌려준다(피버가 탄창을 채우지 않는다).
      return { fired: true, ammo: this.ammo, isReloading: this.isReloading };
    }

    this.ammo -= 1;
    if (this.ammo <= 0) {
      this.ammo = 0;
      this.isReloading = true;
      this.reloadEndTimeMs = nowMs + this.getReloadDurationMs();
    }

    return { fired: true, ammo: this.ammo, isReloading: this.isReloading };
  }

  public update(nowMs: number, deltaMs?: number): { reloadedJustNow: boolean } {
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

    // 피버 중에도 장전은 계속 진행된다(피버는 총알 소모만 면제하고 탄창·장전 상태는 건드리지 않는다).
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
    this.rapidReloadStacks = 0;
    this.damageBonusMultiplier = 1.0;
    this.skillCooldownScale = 1.0;
    this.ammo = this.getMaxAmmo();
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
    this.lastFireTimeMs = 0;
    this.lastUpdateMs = 0;
    this.infiniteAmmo = false;
    this.skillStock = 0;
    this.skillCooldownRemainingMs = 0;
  }
}
