import { ActiveBuffState, WeaponKind, WeaponLevel, TutorialStep } from '../shared/types';
import { BeerCrusherEngine, PassiveCardStack, WaveProgressInfo, SelectionStatus } from './engine/BeerCrusherEngine';
import { PlayerIndex } from './engine/PlayerCombatState';

/**
 * 전투 HUD가 그리는 값의 스냅샷.
 * 값이 바뀔 때만 React state를 갱신해 페이지 전체 리렌더 횟수를 줄인다.
 * 개인 필드는 players[]에만 두고, 최상위에는 팀 값만 남긴다(D24).
 */
export interface BossHudInfo {
  id: string;
  role: 'cooler' | 'king';
  hp: number;
  maxHp: number;
}

export interface PlayerHudSnapshot {
  index: PlayerIndex;
  score: number;
  combo: number;
  comboMultiplier: number;
  maxCombo: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadDurationMs: number;
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  /** 다음 스킬 스택이 차는 데 걸리는 전체 시간(조준경 링 게이지 비율용). */
  skillCooldownTotalMs: number;
  /** 개인 버프(파워샷·와이드 등). 아이스 프리즈는 팀이라 HudSnapshot.activeBuffs에 남는다. */
  personalBuffs: ActiveBuffState[];
  isWideScopeActive: boolean;
  isPowerShotActive: boolean;
  passiveCards: PassiveCardStack[];
  isAway: boolean;
}

export interface HudSnapshot {
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves?: number;
  waveProgress?: WaveProgressInfo;
  /** 팀 버프(ice_freeze)만 */
  activeBuffs: ActiveBuffState[];
  isWeaponSelectPending: boolean;
  isRewardCardPending: boolean;
  isPaused: boolean;
  tutorialStep: TutorialStep;
  targetsCount: number;
  bossHpKey: string;
  bosses: BossHudInfo[];
  isBossWarning: boolean;
  bossDown: boolean;
  waveClearKey: string;
  selection: SelectionStatus;
  players: PlayerHudSnapshot[];
}

export const WAVE_CLEAR_BANNER_MS = 2500;

export const roundTo100Ms = (ms: number): number => Math.round(ms / 100) * 100;

export function buildHudSnapshot(
  engine: BeerCrusherEngine,
  nowMs: number,
  tutorialStep: TutorialStep = 1
): HudSnapshot {
  // Team buffs: ice_freeze only
  const allBuffsP0 = engine.getActiveBuffs(nowMs, 0);
  const teamBuffs = allBuffsP0
    .filter((b) => b.kind === 'ice_freeze')
    .map((b) => ({ ...b, remainingMs: roundTo100Ms(b.remainingMs) }));

  const boss = engine.getBossEntity();

  const players: PlayerHudSnapshot[] = engine.players.map((p, i) => {
    const pIdx = i as PlayerIndex;
    const feverState = p.scoreManager.getState();
    const weaponState = p.weaponSystem.getState();
    const playerBuffs = engine.getActiveBuffs(nowMs, pIdx);
    const personalBuffs = playerBuffs
      .filter((b) => b.kind !== 'ice_freeze')
      .map((b) => ({ ...b, remainingMs: roundTo100Ms(b.remainingMs) }));
    const isWideScopeActive = engine.isBuffActive('wide_scope', nowMs, pIdx);
    const isPowerShotActive = engine.isBuffActive('power_shot', nowMs, pIdx);
    const passiveCards = engine.getPassiveCardStacks(pIdx);

    return {
      index: pIdx,
      score: feverState.totalScore,
      combo: feverState.combo,
      comboMultiplier: feverState.comboMultiplier,
      maxCombo: feverState.maxCombo,
      ammo: weaponState.ammo,
      maxAmmo: weaponState.maxAmmo,
      isReloading: weaponState.isReloading,
      reloadDurationMs: p.weaponSystem.getReloadDurationMs(),
      feverGauge: feverState.feverGauge,
      isFeverReady: feverState.isFeverReady,
      isFeverActive: feverState.isFeverActive,
      weaponKind: weaponState.weaponKind,
      weaponLevel: weaponState.weaponLevel,
      skillStock: weaponState.skillStock,
      maxSkillStock: weaponState.maxSkillStock,
      skillCooldownRemainingMs: roundTo100Ms(weaponState.skillCooldownRemainingMs),
      skillCooldownTotalMs: weaponState.skillCooldownTotalMs,
      personalBuffs,
      isWideScopeActive,
      isPowerShotActive,
      passiveCards,
      isAway: p.isAway,
    };
  });

  return {
    lives: engine.lives,
    maxLives: engine.maxLives,
    wave: engine.currentWave,
    activeBuffs: teamBuffs,
    waveProgress: engine.getWaveProgress(),
    isWeaponSelectPending: engine.isWeaponSelectPending,
    isRewardCardPending: engine.isRewardCardPending,
    isPaused: engine.isPaused,
    tutorialStep,
    targetsCount: engine.activeTargets.length,
    bossHpKey: boss ? `${boss.id}:${Math.ceil(boss.hp * 10) / 10}/${boss.maxHp}` : '',
    bosses: engine.getBossEntities().map((b) => ({
      id: b.id,
      role: b.bossRole ?? 'cooler',
      hp: Math.ceil(b.hp),
      maxHp: b.maxHp,
    })),
    isBossWarning: nowMs < engine.bossWarningUntilMs,
    bossDown: engine.isBossClearSequence(),
    waveClearKey:
      engine.lastWaveClear && nowMs - engine.lastWaveClear.atMs < WAVE_CLEAR_BANNER_MS
        ? `${engine.lastWaveClear.wave}|${engine.lastWaveClear.seconds.toFixed(1)}|${engine.lastWaveClear.bonus}`
        : '',
    selection: engine.getSelectionStatus(),
    players,
  };
}

export function isHudSnapshotEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof HudSnapshot)[];
  for (const key of keys) {
    if (key === 'activeBuffs' || key === 'waveProgress' || key === 'bosses' || key === 'players' || key === 'selection') continue;
    if (a[key] !== b[key]) return false;
  }
  if (JSON.stringify(a.activeBuffs) !== JSON.stringify(b.activeBuffs)) return false;
  if (JSON.stringify(a.waveProgress) !== JSON.stringify(b.waveProgress)) return false;
  if (JSON.stringify(a.bosses) !== JSON.stringify(b.bosses)) return false;
  if (JSON.stringify(a.selection) !== JSON.stringify(b.selection)) return false;
  if (JSON.stringify(a.players) !== JSON.stringify(b.players)) return false;
  return true;
}
