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
  cards: {
    damageUp: { amount: 0.1, maxStacks: 3 },
    skillCooldown: { multiplier: 0.9, maxStacks: 3 },
    feverExtend: { amountMs: 500, maxStacks: 3 },
    hitZoneUp: { amount: 0.05, maxStacks: 2 },
    rapidReloadMaxStacks: 3,
    luckyDropMaxStacks: 3,
  },
  /** 웨이브별 무기 레벨 상한. 무기 MAX(Lv.4)는 5웨이브부터. */
  weaponLevelCapByWave: { 1: 2, 2: 3, 3: 3, 4: 3, 5: 4, 6: 4, 7: 4 },
  monsters: {
    pilgood: { chargeRadiusM: 12, chargeSpeedMult: 2 },
    caslight: { swayAmplitudeRad: 0.25, swayFrequency: 0.004 },
    hanmac: { stopRadiusM: 11, fireIntervalMs: 3000, firstShotDelayMs: 1000 },
    obi: { guardUpMs: 2000, guardDownMs: 1000 },
    bottle: {
      bigScale: 1.2,
      splitCount: 2,
      splitOffsetRad: 0.1,
      childHp: 1,
      childSpeedMps: 2.2,
      childHitRadiusM: 0.85,
      childScale: 0.5,
      childKillBonus: 40,
      childBaseY: 0.35,
    },
  },
  /** 일반 몬스터 처치 시 아이템 드롭 기본 확률(행운 배율 전). */
  itemDropChance: 0.04,
  /** 웨이브당 일반 몬스터 속도 증가율(체력은 웨이브별로 올리지 않는다). */
  speedPerWave: 0.04,
  boss: {
    startRadiusM: 16,
    stopRadiusM: 10,
    summonRadiusM: 12.5,
    hitZoneScale: 0.6,
    kingScale: 1.5,
    coolerSpreadRad: 0.34,
    summonDropChance: 0.20,
    summonIntervalMs: 8000,
    summonCount: 4,
    summonMaxActive: 7,
    firstSummonDelayMs: 2500,
    shieldReleaseKills: 6,
    shieldHpThresholds: [2 / 3, 1 / 3],
    movement: {
      singleAmplitudeRad: 0.32, singleSpeed: 0.9,
      crossAmplitudeRad: 0.34, crossSpeed: 0.8,
      kingAmplitudeRad: 0.12, kingSpeed: 0.5,
      withKingOffsetRad: 0.34, withKingWobbleRad: 0.1,
    },
  },
  /**
   * 웨이브 표. kinds / summonKinds는 이 파일이 다른 파일을 import하지 않으므로 문자열 리터럴이며,
   * 엔진에서 TargetKind로 해석한다. kinds의 중복 항목은 등장 비중이 그만큼 큼을 뜻한다.
   * cardKillTarget이 null이면 중간 카드가 없다.
   */
  waves: [
    { waveIndex: 1, totalSpawns: 20, maxSimultaneous: 5, spawnIntervalMs: 700, kinds: ['pilgood', 'caslight'], cardKillTarget: null, boss: null },
    { waveIndex: 2, totalSpawns: 26, maxSimultaneous: 6, spawnIntervalMs: 650, kinds: ['pilgood', 'obi'], cardKillTarget: null, boss: null },
    { waveIndex: 3, totalSpawns: 15, maxSimultaneous: 6, spawnIntervalMs: 700, kinds: ['obi', 'caslight', 'hanmac'], cardKillTarget: null, boss: { coolerHp: [40], kingHp: null, summonKinds: ['obi', 'caslight', 'hanmac'] } },
    { waveIndex: 4, totalSpawns: 34, maxSimultaneous: 6, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'bottle'], cardKillTarget: 22, boss: null },
    { waveIndex: 5, totalSpawns: 20, maxSimultaneous: 7, spawnIntervalMs: 600, kinds: ['obi', 'hanmac', 'bottle'], cardKillTarget: null, boss: { coolerHp: [35, 35], kingHp: null, summonKinds: ['pilgood', 'obi', 'hanmac', 'bottle'] } },
    { waveIndex: 6, totalSpawns: 40, maxSimultaneous: 7, spawnIntervalMs: 550, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'], cardKillTarget: 26, boss: null },
    { waveIndex: 7, totalSpawns: 25, maxSimultaneous: 8, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'hanmac', 'bottle', 'bottle'], cardKillTarget: null, boss: { coolerHp: [45, 45], kingHp: 110, summonKinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'] } },
  ],
} as const;
