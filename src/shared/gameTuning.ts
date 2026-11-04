/**
 * 난이도 수치를 한 곳에 모은다. 직접 플레이하면서 이 파일만 고쳐 조정한다.
 * 다른 파일을 import하지 않는다(순환 참조 방지).
 */
export const GAME_TUNING = {
  fever: { killDelta: 4, perfectDelta: 2, cardBoostGain: 50 },
  judgment: { perfectDamage: 2.0, greatDamage: 1.0, goodDamage: 0.5 },
  skillCooldownMsByLevel: { 1: 35000, 2: 31000, 3: 27000, 4: 23000 },
  goldenCan: { feverGain: 30, skillStockGain: 1 },
  repairCard: { healAmount: 2 },
  hitZone: {
    scale: 0.75,
    toleranceByWeapon: { shotgun: 1.40, revolver: 0.95, gatling: 1.05 },
  },
  fire: {
    intervalScale: 0.7,
    reloadScale: 2.0,
    holdDamageByWeapon: { shotgun: 0.6, revolver: 0.6, gatling: 0.85 },
    holdIntervalScaleByWeapon: { shotgun: 0.7, revolver: 0.7, gatling: 0.85 },
  },
  weaponDamageScale: { shotgun: 1.2, revolver: 1.0, gatling: 2.0 },
  gatlingMaxAmmoByLevel: { 1: 13, 2: 15, 3: 20, 4: 25 },
} as const;
