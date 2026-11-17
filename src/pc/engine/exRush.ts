import { GAME_TUNING, ExRushTheme } from '../../shared/gameTuning';
import type { TargetKind } from '../../shared/types';

/** EX 경과 시간(ms) → DANGER(1부터). floor(elapsed / (rushDurationMs × rushesPerDanger)) + 1 */
export function getExDanger(elapsedMs: number): number {
  const ms = Math.max(0, elapsedMs);
  const dangerUnitMs = GAME_TUNING.exRush.rushDurationMs * GAME_TUNING.exRush.rushesPerDanger;
  return Math.floor(ms / dangerUnitMs) + 1;
}

/** EX 경과 시간(ms) → 러시 번호(0부터). floor(elapsed / rushDurationMs) */
export function getExRushIndex(elapsedMs: number): number {
  const ms = Math.max(0, elapsedMs);
  return Math.floor(ms / GAME_TUNING.exRush.rushDurationMs);
}

/** 러시 할당량. 1인: base + perDanger×(d-1). 2인: ceil(1인 × coopQuotaMult). */
export function getExRushQuota(danger: number, playerCount: 1 | 2): number {
  const d = Math.max(1, Math.floor(danger));
  const solo = GAME_TUNING.exRush.quota.base + GAME_TUNING.exRush.quota.perDanger * (d - 1);
  return playerCount === 2 ? Math.ceil(solo * GAME_TUNING.exRush.coopQuotaMult) : solo;
}

/** 필드 상한. 1인 fieldCap, 2인 ceil(fieldCap × coopQuotaMult). */
export function getExFieldCap(playerCount: 1 | 2): number {
  return playerCount === 2
    ? Math.ceil(GAME_TUNING.exRush.fieldCap * GAME_TUNING.exRush.coopQuotaMult)
    : GAME_TUNING.exRush.fieldCap;
}

/** min(max, start × perDangerMult^(d-1)) */
export function getExSpeedMult(danger: number): number {
  const d = Math.max(1, Math.floor(danger));
  const { start, perDangerMult, max } = GAME_TUNING.exRush.speed;
  return Math.min(max, start * Math.pow(perDangerMult, d - 1));
}

/** start × perDangerMult^(d-1), 소수 3자리 반올림 */
export function getExHpMult(danger: number): number {
  const d = Math.max(1, Math.floor(danger));
  const { start, perDangerMult } = GAME_TUNING.exRush.hp;
  return Number((start * Math.pow(perDangerMult, d - 1)).toFixed(3));
}

/** rushIndex 0이면 firstTheme. 아니면 prev를 뺀 나머지 5개 중 rng로 균등 선택. */
export function pickExTheme(rushIndex: number, prev: ExRushTheme | null, rng: () => number): ExRushTheme {
  if (rushIndex === 0) return GAME_TUNING.exRush.firstTheme;
  const all = Object.keys(GAME_TUNING.exRush.themes) as ExRushTheme[];
  const candidates = prev ? all.filter((t) => t !== prev) : all;
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[idx];
}

/**
 * 러시 스폰 순서(길이 = quota).
 * themeCount = round(quota × themeShare)
 * chalangCount = theme === 'dive' ? 0 : round(quota × chalangShare)
 * 나머지는 "테마 종류와 chalang을 뺀" 일반 종류 중 rng 균등 선택.
 * 마지막에 Fisher-Yates로 rng 셔플.
 */
export function buildExRushQueue(theme: ExRushTheme, quota: number, rng: () => number): TargetKind[] {
  const themeKind = GAME_TUNING.exRush.themes[theme].kind as TargetKind;
  const themeCount = Math.round(quota * GAME_TUNING.exRush.themeShare);
  const chalangCount = theme === 'dive' ? 0 : Math.round(quota * GAME_TUNING.exRush.chalangShare);
  const allKinds = Object.values(GAME_TUNING.exRush.themes).map((t) => t.kind as TargetKind);
  const otherKinds = allKinds.filter((k) => k !== themeKind && k !== 'chalang');

  const queue: TargetKind[] = [];
  for (let i = 0; i < themeCount; i += 1) queue.push(themeKind);
  for (let i = 0; i < chalangCount; i += 1) queue.push('chalang');
  while (queue.length < quota) {
    const idx = Math.min(otherKinds.length - 1, Math.floor(rng() * otherKinds.length));
    queue.push(otherKinds[idx]);
  }

  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}
