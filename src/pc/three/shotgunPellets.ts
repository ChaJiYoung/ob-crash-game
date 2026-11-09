/** THREE에 의존하지 않는 샷건 탄 배분 계산. 테스트하기 쉽게 순수 함수로 둔다. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** 탄 가로 간격. 이전(0.28)의 2배. */
export const SHOTGUN_PELLET_SPREAD_STEP = 0.56;
/** 세로 흔들림 폭(이전 0.25의 2배). */
export const SHOTGUN_PELLET_JITTER_Y = 0.5;

/**
 * 탄마다 날아갈 목표점. 반환 길이 = pelletCount.
 * extras가 없으면 모든 탄이 primary 주변에 가로로 퍼진다(탄 i의 x 오프셋 = (i - (n-1)/2) * step).
 * extras가 k개(1~3)이면 i % (k+1) === 0인 탄은 primary 주변, 나머지 탄은 extras[(i % (k+1)) - 1] 근처(오프셋의 반만)로 보낸다.
 * rand는 세로 흔들림용 [0,1) 난수 함수(테스트에서 고정값 주입).
 */
export function computeShotgunPelletTargets(
  primary: Vec3Like,
  extras: readonly Vec3Like[],
  pelletCount: number,
  rand: () => number = Math.random
): Vec3Like[] {
  const result: Vec3Like[] = [];
  const k = extras.length;
  for (let i = 0; i < pelletCount; i++) {
    const offsetX = (i - (pelletCount - 1) / 2) * SHOTGUN_PELLET_SPREAD_STEP;
    const jitterY = (rand() - 0.5) * SHOTGUN_PELLET_JITTER_Y;
    const slot = k === 0 ? 0 : i % (k + 1);
    if (slot === 0) {
      result.push({ x: primary.x + offsetX, y: primary.y + jitterY, z: primary.z });
    } else {
      const base = extras[slot - 1];
      result.push({ x: base.x + offsetX * 0.5, y: base.y + jitterY, z: base.z });
    }
  }
  return result;
}
