import { CardPickRecord, ItemBuffKind, RewardCardKind, WeaponKind } from '../../shared/types';
import { ScoreAndFeverManager } from './ScoreAndFeverManager';
import { WeaponSystem } from './WeaponSystem';

export type PlayerIndex = 0 | 1;
export type CardStackKind = 'damage_up' | 'skill_cooldown' | 'fever_extend' | 'hit_zone_up';
export type ShotGradeCounts = Record<'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', number>;

export class PlayerCombatState {
  public readonly index: PlayerIndex;
  public readonly scoreManager = new ScoreAndFeverManager();
  public readonly weaponSystem = new WeaponSystem();
  public cardStacks: Record<CardStackKind, number> = { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 };
  public luckyDropStacks = 0;
  public shotStats: ShotGradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  public totalKills = 0;
  public itemsCollected = 0;
  public precisionBonusApplied = 0;
  public levelBonusApplied = 0;
  public waveTimeBonusTotal = 0;
  public waveClears: { wave: number; seconds: number; bonus: number; damageTaken: number }[] = [];
  /** 이 플레이어에게 걸린 버프 만료 시각. 아이스 프리즈는 팀 효과라 모든 플레이어 맵에 같은 값으로 들어간다(P02-T01). */
  public buffUntilMs: Map<ItemBuffKind, number> = new Map();
  public selectionDone = false;
  /** 가장 최근 선택 라운드에서 고른 항목(상태 상자용) */
  public lastPick: { weapon?: WeaponKind; card?: RewardCardKind; auto: boolean } | null = null;
  /** 판 동안 고른 보상 카드(판 기록용, D09). */
  public cardPicks: CardPickRecord[] = [];
  public isAway = false;
  /** 마지막 스킬 발동 시각(엔진 시계). reuseLockMs 안의 재요청은 거부해 스냅 한 번에 스킬이 두 번 나가지 않게 한다. */
  public lastSkillActivatedMs = -Infinity;
  /** 이탈 시작 시각(엔진 시계). 복귀 때 그 사이만큼 개인 타이머를 민다. null이면 이탈 아님. */
  public awaySinceMs: number | null = null;

  constructor(index: PlayerIndex) {
    this.index = index;
  }

  /** startGame에서 부르는 전체 초기화. 엔진 startGame이 하던 개인 초기화와 정확히 같은 순서. */
  public reset(): void {
    this.scoreManager.reset();
    this.shotStats = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.totalKills = 0;
    this.itemsCollected = 0;
    this.precisionBonusApplied = 0;
    this.levelBonusApplied = 0;
    this.waveTimeBonusTotal = 0;
    this.waveClears = [];
    this.weaponSystem.reset();
    this.resetCardStacks();
    this.buffUntilMs.clear();
    this.luckyDropStacks = 0;
    this.selectionDone = false;
    this.lastPick = null;
    this.cardPicks = [];
    this.isAway = false;
    this.awaySinceMs = null;
    this.lastSkillActivatedMs = -Infinity;
  }

  /** 카드 스택 초기화 + 무기 쿨다운 배율 1.0 + 피버 연장 0. 엔진의 기존 private resetCardStacks와 같은 내용. */
  public resetCardStacks(): void {
    this.cardStacks = { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 };
    this.weaponSystem.setSkillCooldownScale(1.0);
    this.scoreManager.setFeverDurationBonusMs(0);
  }

  /** 개인 타이머를 deltaMs만큼 미룬다: 버프 만료, 피버 타이머(shiftFeverTimer), 장전 타이머(shiftReloadTimer). */
  public freezeTimers(deltaMs: number): void {
    if (deltaMs <= 0) return;
    for (const [kind, until] of this.buffUntilMs.entries()) {
      this.buffUntilMs.set(kind, until + deltaMs);
    }
    this.scoreManager.shiftFeverTimer(deltaMs);
    this.weaponSystem.shiftReloadTimer(deltaMs);
  }
}
