# Task: T02 인원수 규칙 표와 판 시작

## Status: done

## Goal
`GAME_TUNING.playerCountRules`에 1인·2인 값을 한 표로 두고, 엔진은 `startGame({ playerCount })` 때 그 행을 `this.rules`로 잡아 **같은 코드**로 체력·스폰 수·카드 목표·카드 배치·끊김 유예를 계산한다(D10, D24). 2인 행은 체력 1.6배·스폰 1.3배, 1인 행은 지금 값(배율 1, 제한 시간 없음, 지금 카드 배치)이라 1인 동작은 바뀌지 않는다. 이탈자가 생겨도 행은 판이 끝날 때까지 그대로다(D19).

## Decision Summary
- D24: 엔진 로직에 `isCoop` 분기를 두지 않는다. `hp * this.rules.hpMult`처럼 항상 곱하고, 1인 행의 값이 1이다.
- 킬 게이지 목표(`cardKillTarget`)도 `spawnCountMult`로 올린다(올림). 안 올리면 4·6웨이브 카드가 1장→2장으로 늘어 보상 밀도가 바뀐다. 계획 단계 판단이라 플레이 후 조정 대상.
- 튜토리얼·센서 랩은 항상 1인 행(D12). 이것도 분기가 아니라 "그 모드는 `playerCount: 1`로 시작한다"는 호출 규칙이다.

## Implementation

### I01. 규칙 표

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.playerCountRules`; modify

#### Details
- **Data & Schema Fields** (`waves` 앞에 추가):
  ```typescript
  /**
   * 인원수별 규칙(D24). 1인과 2인은 이 표의 값만 다르고 엔진 로직은 같다.
   * selectLayout: 선택 라운드(무기·보상 카드) 표적 배치. 플레이어 p의 k번째(0~2) 카드 x = groupCentersX[p] + (k - 1) * spacingM,
   *   z = depthZ. P01-T04의 `GAME_TUNING.selectLayout`을 1인 행으로 옮긴 것이다(그 상수는 삭제). 화면 맞춤은 P01-T04 `computeSelectLayout`이 모든 인원에 똑같이 한다.
   */
  playerCountRules: {
    1: {
      hpMult: 1,
      spawnCountMult: 1,
      /** null이면 끊긴 플레이어를 이탈 처리하지 않고 무기한 기다린다(지금 1인 동작). */
      disconnectGraceMs: null,
      selectLayout: { depthZ: -3.5, groupCentersX: [0], spacingM: 1.85, hitRadiusM: 1.75 },
    },
    2: {
      hpMult: 1.6,
      spawnCountMult: 1.3,
      disconnectGraceMs: 30000,
      selectLayout: { depthZ: -5.5, groupCentersX: [-3.2, 3.2], spacingM: 2.05, hitRadiusM: 1.0 },
    },
  },
  ```
  타입: `export type PlayerCountRules = (typeof GAME_TUNING.playerCountRules)[1 | 2];` 두 행의 키가 같아야 하므로 `disconnectGraceMs: null as number | null`처럼 넓혀 둔다(읽는 쪽은 `number | null`로 받는다). 선택 시간 제한 값은 두지 않는다(D34).
  - 2인 배치 근거: 카메라는 z=2.2, 깊이 7.7m에서 16:9 보이는 반폭은 약 6.68m. 바깥 카드 중심 5.25m + 카드 반폭 0.9m = 6.15m라 들어간다. 1인 배치는 지금 코드 값 그대로.

### I02. 엔진

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `rules`, `startGame`, `startTutorialMode`, `startSandboxMode`, `buildWaveDefinitions`, `spawnNextTarget`, `splitBottle`, `spawnBossMinionWave`, `spawnBossEncounter`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public rules: PlayerCountRules = GAME_TUNING.playerCountRules[1];
  public startGame(options?: { withWeaponSelect?: boolean; playerCount?: 1 | 2 }): void;
  /** 판 시작·튜토리얼·샌드박스가 공통으로 부른다. players를 n명으로 만들고 rules와 웨이브 표를 맞춘다. */
  private setupPlayers(count: 1 | 2): void;
  private buildWaveDefinitions(): void; // this.rules.spawnCountMult 사용
  ```
- **Execution Flow / Logic**:
  1. `setupPlayers(n)`: `this.players = Array.from({ length: n }, (_, i) => new PlayerCombatState(i as PlayerIndex)); this.rules = GAME_TUNING.playerCountRules[n]; this.buildWaveDefinitions();`
  2. `startGame(opts)`: 맨 앞에서 `setupPlayers(opts?.playerCount ?? 1)`. `startTutorialMode`/`startSandboxMode`: `setupPlayers(1)`.
  3. `buildWaveDefinitions()`: 기존 필드 초기화식(`waveDefinitions`, `waveCardKillTargets`)을 이 함수로 옮기고 `totalSpawns: Math.ceil(w.totalSpawns * this.rules.spawnCountMult)`, `cardKillTarget: w.cardKillTarget === null ? null : Math.ceil(w.cardKillTarget * this.rules.spawnCountMult)`. 생성자에서도 한 번 호출(1인 행이라 기존 값과 정확히 같다).
  4. 체력은 아래 4곳에서 **항상** `Number((기본 * this.rules.hpMult).toFixed(3))`: `spawnNextTarget`(`spec.maxHp`), `splitBottle`(`cfg.childHp`), `spawnBossMinionWave`(`spec.maxHp`), `spawnBossEncounter`의 `make` 호출부(`coolerHp[i]`, `kingHp`). 튜토리얼·샌드박스도 같은 함수를 지나지만 1인 행이라 배율 1.
  5. P01-T04 `computeSelectLayout`이 `GAME_TUNING.selectLayout` 대신 `this.rules.selectLayout`을 읽게 한 줄 바꾼다.
  5-1. 선택 표적·황금 캔·포탄(`hp: 1` 고정 대상)은 체력 배율 대상이 아니다(배율이 아니라 "한 방 대상"이라는 종류 규칙).
  6. 표시·통계용 `public get playerCount(): number { return this.players.length; }`만 둔다. `isCoop` getter는 만들지 않는다.

### I03. 테스트

- Related Files:
  - `tests/player-count-rules.test.ts`; new
  - `tests/game-tuning.test.ts` — 1인 행이 "배율 1, 제한 없음, 지금 배치"임을 고정; modify

#### Details
- `startGame({ playerCount: 2 })` → `players.length === 2`, `rules === playerCountRules[2]`. `startGame()` → 1.
- 같은 테스트 함수를 `playerCount` 1과 2로 두 번 돌려(`describe.each([1, 2])`) 첫 스폰 몬스터 `maxHp === TARGET_SPECS[kind].maxHp * rules.hpMult`, `getWaveProgress().totalSpawns === Math.ceil(20 * rules.spawnCountMult)`, 3웨이브 쿨러 `maxHp === 100 * rules.hpMult`를 확인 — 1인·2인이 같은 코드 경로임을 테스트 모양으로도 보인다.
- 2인 판 뒤 `startTutorialMode()` → `players.length === 1`, `rules.hpMult === 1`.

## Acceptance Criteria
- [x] 1인 수치가 하나도 바뀌지 않는다(기존 테스트 통과).
- [x] `grep -n "isCoop\|players.length === 2" src/pc/engine` 결과 0.

## Validation
- `npx vitest run tests/player-count-rules.test.ts tests/game-tuning.test.ts` — 통과
- `grep -n "isCoop\|players.length === 2" src/pc/engine | wc -l` — `0`
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(engine): player-count rules table drives HP, spawns and select layout

Plan: 2026-11-07-two-player-coop
Phase: P02-engine-players
Task: T02-player-count-rules

- GAME_TUNING.playerCountRules[1|2]: hpMult, spawnCountMult, disconnect grace, select layout
- startGame({ playerCount }) sets players and rules through one setupPlayers path; no coop branches
- Solo row keeps today's numbers; tutorial and sandbox always start with one player

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
