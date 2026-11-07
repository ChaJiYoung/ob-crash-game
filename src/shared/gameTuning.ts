/**
 * 난이도 수치를 한 곳에 모은다. 직접 플레이하면서 이 파일만 고쳐 조정한다.
 * 다른 파일을 import하지 않는다(순환 참조 방지).
 */
/**
 * 랭킹 규칙 버전. 점수가 서로 비교되지 않을 만큼 규칙이 크게 바뀌면 올린다.
 * 서버는 시작할 때 버전이 다른 `players.json`을 백업한 뒤 점수만 초기화한다. (v2: 7웨이브 보스 러시, v3: 점수 규칙 개편, v4: 스킬·방패·탄창 완화, v5: 보스 거리·한맥 개편과 무기 레벨 보너스)
 */
export const RANKING_RULESET_VERSION = 5;

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
     * 현재 값은 보스 체력 상향·보스전 병행 후 30판씩 재측정한 결과다(2026-11-06, 14/18/34/23/38/23/45초). 직전 값(2026-11-05, 14/18/28/23/37/24/45초)은 대체됐다. 보스 웨이브(3·5·7)만 바뀌었고 나머지는 같다.
     */
    /** 클리어할 때의 무기 레벨이 낮을수록 기본 점수에 곱하는 배율. MAX는 1이다. */
    weaponLevelBonusMult: { 1: 1.2, 2: 1.1, 3: 1.05, 4: 1 },
    timeBonus: { maxPerWave: 700, bossWaveWeight: 4, zeroAtParMult: 1.6 },
  },
  skillCooldownMsByLevel: { 1: 21000, 2: 19000, 3: 16000, 4: 14000 },
  goldenCan: { feverGain: 30, skillStockGain: 1 },
  repairCard: { healAmount: 2 },
  /** 몬스터 처치 시 드롭되는 아이템 후보. 바 수리는 회복이 카드와 겹쳐 뺐다(튜토리얼·샌드박스·테스트에서는 지정해서 쓸 수 있다). */
  itemDropKinds: ['power_shot', 'wide_scope', 'ice_freeze'],
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
  weaponDamageScale: { shotgun: 1.2, revolver: 1.05, gatling: 1.5 },
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
    shotgun: { 1: 14, 2: 14, 3: 16, 4: 16 },
    revolver: { 1: 10, 2: 10, 3: 12, 4: 12 },
    gatling: { 1: 30, 2: 35, 3: 40, 4: 50 },
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
    /** 처치되면 터져 주변 몬스터에게 피해를 주는 폭탄 캔. 보스는 맞지 않는다. */
    hanmac: { blastRadiusM: 4, blastDamage: 2 },
    obi: { guardUpMs: 800, guardDownMs: 2400 },
    bottle: {
      bigScale: 1.2,
      splitCount: 2,
      splitOffsetRad: 0.1,
      childHp: 1,
      childSpeedMps: 3.0,
      childHitRadiusM: 0.85,
      childScale: 0.5,
      childKillBonus: 40,
      childBaseY: 0.35,
    },
  },
  /** 일반 몬스터 처치 시 아이템 드롭 기본 확률(행운 배율 전). */
  itemDropChance: 0.04,
  /** 웨이브당 일반 몬스터 속도 증가율(체력은 웨이브별로 올리지 않는다). 7웨이브에서 기본 속도의 1.48배. */
  speedPerWave: 0.08,
  /** 똥 포탄. baseY는 아래 단이 바닥에 닿는 높이, spring은 위아래로 늘고 주는 빠르기와 폭. */
  shell: { baseY: 0.28, springHz: 2.5, springAmount: 0.28 },
  boss: {
    startRadiusM: 20,
    stopRadiusM: 14,
    hitZoneScale: 0.6,
    kingScale: 1.5,
    /** 보스 등장 경고 띠가 떠 있는 시간. 이 안에서 나타났다가 사라진다. */
    warningMs: 2000,
    coolerSpreadRad: 0.34,
    /** 무기별 보스 피해 배율(샷건이 보스를 너무 빨리 녹이지 않게 조정). */
    damageScaleByWeapon: { shotgun: 0.7, revolver: 0.8, gatling: 2.2 },
    /** 일반 몬스터를 totalSpawns의 이 비율(올림)만큼 소환하면 보스가 등장한다. 보스가 살아 있는 동안 일반 몬스터는 계속 보충된다. */
    encounterStartRatio: 0.5,
    /** 보스 포탄 발사 간격. 보스 등장 후 everyMs마다 stepMs씩 줄어 minMs에서 멈춘다(오래 끄는 플레이에 압박). */
    shellInterval: { startMs: 3500, stepMs: 500, everyMs: 15000, minMs: 1500 },
    summonDropChance: 0.10,
    /** 마지막 보스를 잡은 뒤 연출 시간. 이 동안 남은 몬스터가 cascadeGapMs 간격으로 연쇄로 터진다. */
    clear: { durationMs: 1500, cascadeGapMs: 100 },
    /**
     * 보스 부하는 보스 뒤가 아니라 필드 곳곳(방어선에서 minRadiusM~maxRadiusM, 좌우 ±thetaRangeRad)에
     * 위에서 떨어진다. 착지(dropMs) 전에는 맞힐 수도 움직일 수도 없다. minSeparationM는 같은 소환 안 부하 사이 최소 거리.
     */
    minionDrop: { minRadiusM: 10, maxRadiusM: 18, thetaRangeRad: 0.55, dropMs: 1200, minSeparationM: 1.5 },
    /** 각 보스가 자기 최대 체력 대비 이 비율 아래로 내려갈 때마다 summonCountByStep의 해당 구간 마릿수를 소환한다(무기와 상관없이 보스당 같은 횟수, 필드 상한 없음). */
    summonHpThresholds: [0.99, 0.66, 0.33],
    summonCountByStep: [4, 5, 6],
    movement: {
      singleAmplitudeRad: 0.32, singleSpeed: 0.9,
      crossAmplitudeRad: 0.34, crossSpeed: 0.8,
      kingAmplitudeRad: 0.12, kingSpeed: 0.5,
      withKingOffsetRad: 0.34, withKingWobbleRad: 0.1,
    },
  },
  /** 선택 카드(무기·보상) 판정 반지름(m). 카드 몸체 반폭 0.9m × modelScaleMult. 무기 허용 배율·판정 강화 카드·와이드 스코프는 적용하지 않는다. */
  selectTargetHitHalfWidthM: 0.9,
  /**
   * 인원수별 규칙(D24). 1인과 2인은 이 표의 값만 다르고 엔진 로직은 같다.
   * selectLayout: 선택 라운드(무기·보상 카드) 표적 배치. 플레이어 p의 k번째(0~2) 카드 x = groupCentersX[p] + (k - 1) * spacingM,
   *   z = depthZ. P01-T04의 `GAME_TUNING.selectLayout`을 1인 행으로 옮긴 것이다(그 상수는 삭제). 화면 맞춤은 P01-T04 `computeSelectLayout`이 모든 인원에 똑같이 한다.
   */
  playerCountRules: {
    1: {
      monsterHpMult: 1,
      bossHpMult: 1,
      summonCountMult: 1,
      spawnCountMult: 1,
      cardKillTargetMult: 1,
      /** null이면 끊긴 플레이어를 이탈 처리하지 않고 무기한 기다린다(지금 1인 동작). */
      disconnectGraceMs: null as number | null,
      selectLayout: { depthZ: -3.5, groupCentersX: [0] as readonly number[], spacingM: 1.85 },
    },
    2: {
      monsterHpMult: 1,
      bossHpMult: 2,
      summonCountMult: 2,
      spawnCountMult: 2,
      cardKillTargetMult: 2,
      disconnectGraceMs: 30000 as number | null,
      selectLayout: { depthZ: -5.5, groupCentersX: [-3.2, 3.2] as readonly number[], spacingM: 2.05 },
    },
  },
  /**
   * 웨이브 표. kinds / summonKinds는 이 파일이 다른 파일을 import하지 않으므로 문자열 리터럴이며,
   * 엔진에서 TargetKind로 해석한다. kinds의 중복 항목은 등장 비중이 그만큼 큼을 뜻한다.
   * cardKillTarget이 null이면 중간 카드가 없다. 보스 웨이브(3·5·7)는 null이다(보스를 안 죽이고 처치 수로 카드를 모으는 파밍을 막으려고). 4·6웨이브는 그 처치 수마다 카드가 나온다.
   */
  waves: [
    { waveIndex: 1, parTimeSec: 14, totalSpawns: 20, maxSimultaneous: 5, spawnIntervalMs: 700, kinds: ['pilgood', 'caslight'], cardKillTarget: null, boss: null },
    { waveIndex: 2, parTimeSec: 18, totalSpawns: 26, maxSimultaneous: 6, spawnIntervalMs: 650, kinds: ['pilgood', 'pilgood', 'caslight', 'obi'], cardKillTarget: null, boss: null },
    { waveIndex: 3, parTimeSec: 34, totalSpawns: 15, maxSimultaneous: 6, spawnIntervalMs: 700, kinds: ['obi', 'caslight', 'caslight', 'hanmac'], cardKillTarget: null, boss: { coolerHp: [100], kingHp: null, summonKinds: ['obi', 'caslight', 'hanmac'] } },
    { waveIndex: 4, parTimeSec: 23, totalSpawns: 34, maxSimultaneous: 6, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'bottle'], cardKillTarget: 22, boss: null },
    { waveIndex: 5, parTimeSec: 38, totalSpawns: 20, maxSimultaneous: 7, spawnIntervalMs: 600, kinds: ['obi', 'hanmac', 'hanmac', 'bottle', 'bottle'], cardKillTarget: null, boss: { coolerHp: [120, 120], kingHp: null, summonKinds: ['pilgood', 'obi', 'hanmac', 'bottle'] } },
    { waveIndex: 6, parTimeSec: 24, totalSpawns: 40, maxSimultaneous: 7, spawnIntervalMs: 550, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'], cardKillTarget: 26, boss: null },
    { waveIndex: 7, parTimeSec: 45, totalSpawns: 25, maxSimultaneous: 8, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'hanmac', 'bottle', 'bottle'], cardKillTarget: null, boss: { coolerHp: [150, 150], kingHp: 250, summonKinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'] } },
  ],
  breachRespawnRadiusM: 16,
  /** 모드별 규칙(D31). 엔진은 모드를 묻지 않고 이 값만 읽는다. */
  modeRules: {
    game: {
      waveSpawning: true,
      breachEffect: 'damageLives' as const,
      pilgoodCharge: true,
      hanmacBlast: true,
      killEffects: true,
      bossEncounter: true,
      freezeOnSelect: true,
      waveTimeBonus: true,
      victoryBonus: true,
      holdDamagePenalty: true,
    },
    tutorial: {
      waveSpawning: false,
      breachEffect: 'remove' as const,
      pilgoodCharge: false,
      hanmacBlast: false,
      killEffects: false,
      bossEncounter: false,
      freezeOnSelect: false,
      waveTimeBonus: false,
      victoryBonus: false,
      holdDamagePenalty: false,
    },
    sandbox: {
      waveSpawning: false,
      breachEffect: 'respawnFar' as const,
      pilgoodCharge: false,
      hanmacBlast: false,
      killEffects: false,
      bossEncounter: false,
      freezeOnSelect: false,
      waveTimeBonus: false,
      victoryBonus: false,
      holdDamagePenalty: false,
    },
  },
} as const;

export type BreachEffect = 'damageLives' | 'respawnFar' | 'remove';
export type EngineMode = 'game' | 'tutorial' | 'sandbox';
export type PlayerCountRules = (typeof GAME_TUNING.playerCountRules)[1 | 2];
export type ModeRules = {
  readonly waveSpawning: boolean;
  readonly breachEffect: BreachEffect;
  readonly pilgoodCharge: boolean;
  readonly hanmacBlast: boolean;
  readonly killEffects: boolean;
  readonly bossEncounter: boolean;
  readonly freezeOnSelect: boolean;
  readonly waveTimeBonus: boolean;
  readonly victoryBonus: boolean;
  readonly holdDamagePenalty: boolean;
};
