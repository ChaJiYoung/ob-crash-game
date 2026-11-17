import { GAME_TUNING } from '../../shared/gameTuning';
import type { BeerCrusherEngine } from '../engine/BeerCrusherEngine';
import type { DebugResultInfo } from '../components/ResultRankingModal';
import type { DebugStartConfig, DebugStartPoint, WeaponLevel } from '../../shared/types';

export const DEBUG_CONFIG_STORAGE_KEY = 'beer.debugStartConfig.v1';

export type DebugCardKey = keyof DebugStartConfig['cards'];

/** 카드별 최대 스택(GAME_TUNING.cards 기준). */
export const DEBUG_CARD_LIMITS: Record<DebugCardKey, number> = {
  damage_up: GAME_TUNING.cards.damageUp.maxStacks,
  skill_cooldown: GAME_TUNING.cards.skillCooldown.maxStacks,
  fever_extend: GAME_TUNING.cards.feverExtend.maxStacks,
  hit_zone_up: GAME_TUNING.cards.hitZoneUp.maxStacks,
  rapid_reload: GAME_TUNING.cards.rapidReloadMaxStacks,
  lucky_drop: GAME_TUNING.cards.luckyDropMaxStacks,
};

const CARD_KEYS = Object.keys(DEBUG_CARD_LIMITS) as DebugCardKey[];

/** PC 화면 URL에 `debug=1`이 있으면 디버그 모드. */
export function isDebugModeSearch(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** 시작 지점별 처음 값. */
export function presetForStart(startAt: DebugStartPoint): DebugStartConfig {
  if (startAt === 'EX') {
    return { startAt, weaponLevel: 4, cards: { ...DEBUG_CARD_LIMITS } };
  }
  if (startAt === 'W6') {
    return {
      startAt,
      weaponLevel: 3,
      cards: { damage_up: 2, skill_cooldown: 2, fever_extend: 2, hit_zone_up: 1, rapid_reload: 2, lucky_drop: 2 },
    };
  }
  return {
    startAt: 'W1',
    weaponLevel: 1,
    cards: { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0, rapid_reload: 0, lucky_drop: 0 },
  };
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** 저장된 값처럼 믿을 수 없는 값을 범위 안으로 보정한다. */
export function clampDebugStartConfig(v: unknown): DebugStartConfig {
  const raw = (v && typeof v === 'object' ? v : {}) as Record<string, any>;
  const startAt: DebugStartPoint = raw.startAt === 'W6' || raw.startAt === 'EX' ? raw.startAt : 'W1';
  const base = presetForStart(startAt);
  const rawCards = raw.cards && typeof raw.cards === 'object' ? raw.cards : {};
  const cards = { ...base.cards };
  for (const k of CARD_KEYS) cards[k] = clampInt(rawCards[k], 0, DEBUG_CARD_LIMITS[k], base.cards[k]);
  return { startAt, weaponLevel: clampInt(raw.weaponLevel, 1, 4, base.weaponLevel) as WeaponLevel, cards };
}

export function loadDebugStartConfig(): DebugStartConfig {
  try {
    const text = window.localStorage.getItem(DEBUG_CONFIG_STORAGE_KEY);
    if (!text) return presetForStart('W1');
    return clampDebugStartConfig(JSON.parse(text));
  } catch {
    return presetForStart('W1');
  }
}

export function saveDebugStartConfig(cfg: DebugStartConfig): void {
  try {
    window.localStorage.setItem(DEBUG_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // 저장 실패는 무시(사생활 보호 모드 등).
  }
}

/** 결과 화면 디버그 상세: 끝낸 웨이브별 피격 + EX DANGER별 피격. */
export function buildDebugResultInfo(engine: BeerCrusherEngine): DebugResultInfo {
  const stats = engine.getPlayRunStats(0, { allowExCheckpoint: true });
  const waves = (stats?.waves ?? []).map((w) => ({ label: `W${w.wave}`, damageTaken: w.damageTaken ?? 0 }));
  const dangers = engine.getExDangerDamage().map((d) => ({ label: `DANGER ${d.danger}`, damageTaken: d.damageTaken }));
  return { damageTaken: stats?.damageTaken ?? 0, waves: [...waves, ...dangers] };
}
