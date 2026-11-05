/**
 * 난이도 수치를 한 곳에 모은다. 직접 플레이하면서 이 파일만 고쳐 조정한다.
 * 다른 파일을 import하지 않는다(순환 참조 방지).
 */
/**
 * 랭킹 규칙 버전. 점수가 서로 비교되지 않을 만큼 규칙이 크게 바뀌면 올린다.
 * 서버는 시작할 때 버전이 다른 `players.json`을 백업한 뒤 점수만 초기화한다. (v2: 7웨이브 보스 러시, v3: 점수 규칙 개편, v4: 스킬·방패·탄창 완화)
 */
export const RANKING_RULESET_VERSION = 4;

export const GAME_TUNING = {
  fever: { killDelta: 4, perfectDelta: 2, cardBoostGain: 50 },
  judgment: { perfectDamage: 2.0, greatDamage: 1.0, goodDamage: 0.5 },
  /**
   * scale: 명중 점수·처치 보너스에 곱하는 전체 점수 단위(표의 기본 점수 150/100/50, 처치 30~1500은 scale 1.0 기준).
   * 클리어(VICTORY) 시 한 번 더해지는 정밀도 보너스 = k × (가중 판정 비율)^power. k는 최종 점수 단위(scale 적용 후).
   * 비율은 (PERFECT·GREAT·GOOD 가중 합) ÷ 발사 수(MISS·방패 막힘 포함)라서 많이 쏴도 늘지 않는다.
   */
  score: {
    scale: 0.1,
    precisionBonus: { k: 12000, power: 2, minShots: 30, weights: { PERFECT: 1.0, GREAT: 0.5, GOOD: 0.2 } },
    /**
     * 웨이브 클리어 시간 보너스(최종 점수 단위). 기준 시간(parTimeSec) 이내면 maxPerWave,
     * 기준의 zeroAtParMult배에서 0까지 선형 감소. 보스 웨이브는 bossWaveWeight배.
     * parTimeSec는 정확 봇(세 무기 평균)의 웨이브별 클리어 시간이다(measure-wave-times.ts, 2026-11-05).
     * 현재 값은 무기 스킬 개편 후 30판씩 재측정한 결과다(2026-11-05, 15/19/21/24/23/24/50초). 직전 값(스킬·방패·탄창 완화 후, 14/18/20/24/22/23/48초)은 대체됐다.
     */
    timeBonus: { maxPerWave: 700, bossWaveWeight: 2, zeroAtParMult: 1.6 },
  },
  skillCooldownMsByLevel: { 1: 21000, 2: 19000, 3: 16000, 4: 14000 },
  goldenCan: { feverGain: 30, skillStockGain: 1 },
  repairCard: { healAmount: 2 },
  hitZone: {
    scale: 0.75,
    toleranceByWeapon: { shotgun: 1.40, revolver: 0.95, gatling: 1.05 },
  },
  fire: {
    intervalScale: 0.7,
    reloadScale: 1.2,
    holdDamageByWeapon: { shotgun: 0.6, revolver: 0.6, gatling: 0.85 },
    holdIntervalScaleByWeapon: { shotgun: 0.7, revolver: 0.7, gatling: 0.85 },
  },
  weaponDamageScale: { shotgun: 1.2, revolver: 1.0, gatling: 2.0 },
  /** 스킬 수치. 리볼버 칼날 피해는 평타 GREAT 한 발과 같아 무기 표에서 자동으로 맞춘다. */
  skills: {
    blade: {
      countByLevel: { 1: 3, 2: 3, 3: 5, 4: 7 },
      pierceByLevel: { 1: 0, 2: 1, 3: 1, 4: 2 },
      bossDamageByLevel: { 1: 2, 2: 2.5, 3: 3, 4: 3.5 },
      /** 칼날 좌우 절반 폭. 맞는 조건은 횡거리 <= halfWidthM + hitRadiusM. 화면 폭도 이 값으로 그린다. */
      halfWidthM: 0.7,
      speedMps: 40,
      startRadiusM: 3,
    },
    /** 개틀링 '거품 해일'. 밀어내기 전용이라 피해는 낮다. 거품 수(countByLevel)는 화면에만 쓰인다. */
    foam: {
      knockbackMByLevel: { 1: 3, 2: 3.5, 3: 4, 4: 5 },
      damageByLevel: { 1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5 },
      bossDamageByLevel: { 1: 2, 2: 2.5, 3: 3, 4: 3.5 },
      countByLevel: { 1: 120, 2: 160, 3: 210, 4: 280 },
      speedMps: 24,
      startRadiusM: 2,
      /** 밀려나는 속도. 3m면 약 0.25초. */
      slideSpeedMps: 12,
    },
  },
  /** 무기·레벨별 기본 탄수. rapid_reload 카드가 장당 +2발 더한다. */
  maxAmmoByWeapon: {
    shotgun: { 1: 10, 2: 10, 3: 12, 4: 12 },
    revolver: { 1: 10, 2: 10, 3: 12, 4: 12 },
    gatling: { 1: 20, 2: 25, 3: 30, 4: 35 },
  },
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
    pilgood: { chargeRadiusM: 12, chargeSpeedMult: 1.4 },
    caslight: { swayAmplitudeRad: 0.25, swayFrequency: 0.004 },
    hanmac: { stopRadiusM: 11, fireIntervalMs: 4000, firstShotDelayMs: 1000 },
    obi: { guardUpMs: 800, guardDownMs: 2400 },
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
    /** 무기별 보스 피해 배율(샷건이 보스를 너무 빨리 녹이지 않게 조정). */
    damageScaleByWeapon: { shotgun: 0.7, revolver: 0.8, gatling: 2.2 },
    summonDropChance: 0.20,
    summonIntervalMs: 8000,
    /** 보스 조우가 길어질수록 소환 간격이 summonIntervalMs에서 minIntervalMs까지 rampMs에 걸쳐 선형으로 줄어든다. */
    summonAccel: { minIntervalMs: 5000, rampMs: 60000 },
    /**
     * 보스 부하는 보스 뒤가 아니라 필드 곳곳(방어선에서 minRadiusM~maxRadiusM, 좌우 ±thetaRangeRad)에
     * 위에서 떨어진다. 착지(dropMs) 전에는 맞힐 수도 움직일 수도 없다. minSeparationM는 같은 소환 안 부하 사이 최소 거리.
     */
    minionDrop: { minRadiusM: 6, maxRadiusM: 14, thetaRangeRad: 0.55, dropMs: 1200, minSeparationM: 1.5 },
    summonCount: 3,
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
    { waveIndex: 1, parTimeSec: 15, totalSpawns: 20, maxSimultaneous: 5, spawnIntervalMs: 700, kinds: ['pilgood', 'caslight'], cardKillTarget: null, boss: null },
    { waveIndex: 2, parTimeSec: 19, totalSpawns: 26, maxSimultaneous: 6, spawnIntervalMs: 650, kinds: ['pilgood', 'obi'], cardKillTarget: null, boss: null },
    { waveIndex: 3, parTimeSec: 21, totalSpawns: 15, maxSimultaneous: 6, spawnIntervalMs: 700, kinds: ['obi', 'caslight', 'hanmac'], cardKillTarget: null, boss: { coolerHp: [45], kingHp: null, summonKinds: ['obi', 'caslight', 'hanmac'] } },
    { waveIndex: 4, parTimeSec: 24, totalSpawns: 34, maxSimultaneous: 6, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'bottle'], cardKillTarget: 22, boss: null },
    { waveIndex: 5, parTimeSec: 23, totalSpawns: 20, maxSimultaneous: 7, spawnIntervalMs: 600, kinds: ['obi', 'hanmac', 'bottle'], cardKillTarget: null, boss: { coolerHp: [40, 40], kingHp: null, summonKinds: ['pilgood', 'obi', 'hanmac', 'bottle'] } },
    { waveIndex: 6, parTimeSec: 24, totalSpawns: 40, maxSimultaneous: 7, spawnIntervalMs: 550, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'], cardKillTarget: 26, boss: null },
    { waveIndex: 7, parTimeSec: 50, totalSpawns: 25, maxSimultaneous: 8, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'hanmac', 'bottle', 'bottle'], cardKillTarget: null, boss: { coolerHp: [50, 50], kingHp: 120, summonKinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'] } },
  ],
} as const;
