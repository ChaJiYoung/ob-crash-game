import { ActiveBuffState, WeaponKind, WeaponLevel, TutorialStep } from '../shared/types';
import { BeerCrusherEngine, PassiveCardStack, WaveProgressInfo } from './engine/BeerCrusherEngine';

/**
 * 전투 HUD가 그리는 값의 스냅샷.
 * 값이 바뀔 때만 React state를 갱신해 페이지 전체 리렌더 횟수를 줄인다.
 * 렌더 중 engine에서 직접 읽는 값(카드 대기, 튜토리얼 단계, 보스 체력 등)도 함께 담아야
 * 값이 바뀌었을 때 화면이 갱신된다.
 */
export interface BossHudInfo {
  id: string;
  role: 'cooler' | 'king';
  hp: number;
  maxHp: number;
}

export interface HudSnapshot {
  score: number;
  combo: number;
  comboMultiplier: number;
  lives: number;
  maxLives: number;
  wave: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  /** 현재 무기·레벨·카드 보정이 반영된 장전 시간(ms). 장전 게이지 링의 애니메이션 길이. */
  reloadDurationMs: number;
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  activeBuffs: ActiveBuffState[];
  isWideScopeActive: boolean;
  isPowerShotActive: boolean;
  waveProgress?: WaveProgressInfo;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  // engine state read during render
  isWeaponSelectPending: boolean;
  isRewardCardPending: boolean;
  isPaused: boolean;
  tutorialStep: TutorialStep;
  targetsCount: number;
  maxCombo: number;
  bossHpKey: string;
  bosses: BossHudInfo[];
  isBossWarning: boolean;
  passiveCards: PassiveCardStack[];
  /** passiveCards의 변화 감지용. 배열은 매번 새로 만들어지므로 이 문자열로 비교한다. */
  passiveCardsKey: string;
  /** 마지막 보스를 잡은 뒤 연출이 진행 중이다. "BOSS DOWN!" 배너를 띄운다. */
  bossDown: boolean;
  /** `${wave}|${seconds}|${bonus}` while the wave-clear banner is up, '' otherwise. */
  waveClearKey: string;
}

export const WAVE_CLEAR_BANNER_MS = 2500;

export const roundTo100Ms = (ms: number): number => Math.round(ms / 100) * 100;

export function buildHudSnapshot(engine: BeerCrusherEngine, nowMs: number): HudSnapshot {
  const feverState = engine.scoreManager.getState();
  const weaponState = engine.weaponSystem.getState();
  const passiveCards = engine.getPassiveCardStacks();
  const activeBuffs = engine.getActiveBuffs(nowMs).map((b) => ({
    ...b,
    remainingMs: roundTo100Ms(b.remainingMs),
  }));
  const boss = engine.getBossEntity();

  return {
    score: feverState.totalScore,
    combo: feverState.combo,
    comboMultiplier: feverState.comboMultiplier,
    lives: engine.lives,
    maxLives: engine.maxLives,
    wave: engine.currentWave,
    ammo: weaponState.ammo,
    maxAmmo: weaponState.maxAmmo,
    isReloading: weaponState.isReloading,
    reloadDurationMs: engine.weaponSystem.getReloadDurationMs(),
    feverGauge: feverState.feverGauge,
    isFeverReady: feverState.isFeverReady,
    isFeverActive: feverState.isFeverActive,
    activeBuffs,
    isWideScopeActive: engine.isBuffActive('wide_scope', nowMs),
    isPowerShotActive: engine.isBuffActive('power_shot', nowMs),
    waveProgress: engine.getWaveProgress(),
    weaponKind: weaponState.weaponKind,
    weaponLevel: weaponState.weaponLevel,
    skillStock: weaponState.skillStock,
    maxSkillStock: weaponState.maxSkillStock,
    skillCooldownRemainingMs: roundTo100Ms(weaponState.skillCooldownRemainingMs),
    isWeaponSelectPending: engine.isWeaponSelectPending,
    isRewardCardPending: engine.isRewardCardPending,
    isPaused: engine.isPaused,
    tutorialStep: engine.tutorialStep,
    targetsCount: engine.activeTargets.length,
    maxCombo: feverState.maxCombo,
    bossHpKey: boss ? `${boss.id}:${Math.ceil(boss.hp * 10) / 10}/${boss.maxHp}` : '',
    bosses: engine.getBossEntities().map((b) => ({
      id: b.id,
      role: b.bossRole ?? 'cooler',
      hp: Math.ceil(b.hp),
      maxHp: b.maxHp,
    })),
    isBossWarning: nowMs < engine.bossWarningUntilMs,
    passiveCards,
    passiveCardsKey: passiveCards.map((c) => `${c.kind}:${c.count}`).join(','),
    bossDown: engine.isBossClearSequence(),
    waveClearKey:
      engine.lastWaveClear && nowMs - engine.lastWaveClear.atMs < WAVE_CLEAR_BANNER_MS
        ? `${engine.lastWaveClear.wave}|${engine.lastWaveClear.seconds.toFixed(1)}|${engine.lastWaveClear.bonus}`
        : '',
  };
}

export function isHudSnapshotEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof HudSnapshot)[];
  for (const key of keys) {
    if (key === 'activeBuffs' || key === 'waveProgress' || key === 'bosses' || key === 'passiveCards') continue;
    if (a[key] !== b[key]) return false;
  }
  if (JSON.stringify(a.activeBuffs) !== JSON.stringify(b.activeBuffs)) return false;
  if (JSON.stringify(a.waveProgress) !== JSON.stringify(b.waveProgress)) return false;
  if (JSON.stringify(a.bosses) !== JSON.stringify(b.bosses)) return false;
  return true;
}
