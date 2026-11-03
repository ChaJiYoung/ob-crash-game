# Task: T03 피버 10초 및 충전율 조정, 아이템 주기/상한 제한, 웨이브 1.5~1.8배 확장

## Status: done

## Goal
3~4타 만에 차고 6초 만에 끝나던 피버를 10~12타 충전 및 10초 지속으로 상향하고, 흔하게 쏟아지던 아이템을 14마리 주기 및 웨이브당 1~2개 상한으로 제한하며, 웨이브당 몬스터 물량을 1.5~1.8배 확장(W1: 24, W2: 32, W3: 40, W4: 48, W5: 35+보스50HP)하여 40~60초의 쾌적한 아케이드 건슈팅 템포를 완성한다.

## Decision Summary
- [D01, D02, D03](../decisions/2026-11-03-difficulty-and-monsters.md): 피버 게이지 충전량 하향(PERFECT: 10, GREAT: 6, GOOD: 3), 지속시간 10초 상향, 아이템 스폰 14마리 주기 & 웨이브당 1~2개 상한, 웨이브 물량 1.5~1.8배 확장 및 보스 체력 50.

## Implementation

### I01. constants.ts 피버 및 판정 스펙 갱신

- Related Files:
  - `src/shared/constants.ts` :: `JUDGMENT_SPECS`, `FEVER_CONSTANTS`, `TARGET_SPECS` — 상수 정의; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export const JUDGMENT_SPECS: Record<Exclude<JudgmentGrade, 'MISS'>, JudgmentSpec> = {
    PERFECT: {
      maxErrorRatio: 0.25,
      baseScore: 150,
      feverDelta: 10, // 기존 30 -> 10 (10연속 PERFECT 시 100% 충전)
      colorHex: '#fbbf24',
    },
    GREAT: {
      maxErrorRatio: 0.55,
      baseScore: 100,
      feverDelta: 6, // 기존 20 -> 6
      colorHex: '#38bdf8',
    },
    GOOD: {
      maxErrorRatio: 1.00,
      baseScore: 50,
      feverDelta: 3, // 기존 10 -> 3
      colorHex: '#4ade80',
    },
  };

  export const FEVER_CONSTANTS = {
    MAX_GAUGE: 100,
    MISS_PENALTY: 5,
    DURATION_MS: 10000, // 기존 6000 -> 10000 (10초)
    LOCK_WHEN_FULL: true,
  } as const;

  // TARGET_SPECS.boss:
  // maxHp: 50 (기존 40 -> 50)
  ```

### I02. BeerCrusherEngine 웨이브 스폰 물량 및 아이템 상한 로직 개편

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — 웨이브 테이블 및 아이템 드롭 제어; modify

#### Details
- **Data & Fields**:
  - `BeerCrusherEngine`: `private itemsSpawnedInWave = 0;` 필드 추가.
  - 웨이브 전환 시 `this.itemsSpawnedInWave = 0;` 초기화.
- **Wave Definitions**:
  ```typescript
  private waveDefinitions: Record<number, WaveDefinition> = {
    1: {
      waveIndex: 1,
      totalSpawns: 24, // 기존 16 -> 24
      maxSimultaneous: 4,
      spawnIntervalMs: 950,
      kinds: ['pilgood', 'caslight'],
      allowedItems: ['wide_scope'],
      includesBoss: false,
    },
    2: {
      waveIndex: 2,
      totalSpawns: 32, // 기존 22 -> 32
      maxSimultaneous: 5,
      spawnIntervalMs: 850,
      kinds: ['obi', 'hanmac', 'pilgood'],
      allowedItems: ['power_shot', 'bar_repair'],
      includesBoss: false,
    },
    3: {
      waveIndex: 3,
      totalSpawns: 40, // 기존 26 -> 40
      maxSimultaneous: 6,
      spawnIntervalMs: 800,
      kinds: ['bottle', 'caslight', 'obi', 'hanmac'],
      allowedItems: ['wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: false,
    },
    4: {
      waveIndex: 4,
      totalSpawns: 48, // 기존 32 -> 48
      maxSimultaneous: 7,
      spawnIntervalMs: 700,
      kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'],
      allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: false,
    },
    5: {
      waveIndex: 5,
      totalSpawns: 35, // 기존 18 -> 35
      maxSimultaneous: 6,
      spawnIntervalMs: 800,
      kinds: ['hanmac', 'bottle', 'pilgood', 'caslight'],
      allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'],
      includesBoss: true,
    },
  };
  ```
- **Item Spawning Logic**:
  ```typescript
  const maxWaveItems = this.currentWave === 1 ? 1 : 2;
  const hasItemOnScreen = this.activeTargets.some((t) => t.isItem);
  if (
    !hasItemOnScreen &&
    this.itemsSpawnedInWave < maxWaveItems &&
    this.spawnedInWave > 0 &&
    this.spawnedInWave % 14 === 0 &&
    waveDef.allowedItems.length > 0 &&
    this.activeTargets.length < waveDef.maxSimultaneous
  ) {
    const itemKind = waveDef.allowedItems[Math.floor(Math.random() * waveDef.allowedItems.length)];
    this.spawnItemTarget(itemKind, nowMs);
    this.itemsSpawnedInWave += 1;
  }
  ```

### I03. 엔진 단위 테스트 갱신

- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` — 판정 피버 델타 및 스폰 테스트; modify

#### Details
- `evaluateHitJudgment` 테스트 검증값 갱신:
  - `expect(perfect.feverDelta).toBe(10);` (기존 30 ➔ 10)
  - `expect(great.feverDelta).toBe(6);` (기존 20 ➔ 6)
- 웨이브 총 스폰 수 및 아이템 상한선 테스트 추가/검증.

## Acceptance Criteria
- [x] PERFECT 판정 시 피버 게이지가 10씩 증가하여 10타 명중 시 100%가 된다.
- [x] 피버 활성화 시 지속 시간이 10초(10,000ms) 동안 유지된다.
- [x] 아이템은 14마리 스폰 간격으로 체크되며, Wave 1은 최대 1개, Wave 2~5는 최대 2개만 드롭된다.
- [x] Wave 1~5의 스폰 수가 각각 24, 32, 40, 48, 35(+보스 50HP)로 확장된다.
- [x] `tests/engine-judgment-and-spawn.test.ts` 테스트가 모두 통과한다.

## Validation
- `npm test tests/engine-judgment-and-spawn.test.ts` — 엔진 판정, 스폰, 피버 테스트 통과 (exit code 0)

## Commit Message
```text
feat(engine): rebalance fever rate, item spawn caps, and wave length

Plan: 2026-11-03-difficulty-controls-and-monsters
Phase: P01-controls-difficulty-and-monsters
Task: T03-fever-item-and-wave-scale-rebalance

- Rebalance fever delta (PERFECT +10, GREAT +6, GOOD +3) and set fever duration to 10s
- Cap item drops to 1-2 per wave with 14-spawn check interval
- Expand wave monster spawns by 1.5-1.8x and increase boss maxHp to 50
- Update judgment and spawn unit tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
