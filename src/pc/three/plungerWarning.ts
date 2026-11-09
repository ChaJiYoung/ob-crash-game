/** 박힌 몬스터가 터지기 직전(남은 시간 0 초과 500ms 이하)에 뚫어뻥이 더 세게 떨리게 하는 판정. */
export const PLUNGER_BLAST_WARNING_MS = 500;

export function isPlungerBlastImminent(plungerBlast: unknown, stunUntilMs: number | undefined, nowMs: number): boolean {
  if (!plungerBlast || stunUntilMs === undefined) return false;
  const remaining = stunUntilMs - nowMs;
  return remaining > 0 && remaining <= PLUNGER_BLAST_WARNING_MS;
}
