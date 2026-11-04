# Task: T02 Random Minion Drop

## Status: todo

## Goal
보스 부하를 보스 뒤가 아니라 필드 곳곳(반경 6~14m)에 무작위로 떨어뜨린다. 착지하기 전에는 맞힐 수도 움직일 수도 없다.

## Decision Summary
- D07: 위에서 필드에 무작위로 떨어뜨린다. 반경 6~14m [사용자 선택]. 좌우 범위는 화면 폭 안쪽으로 넓히고 가까운 쪽에 하한을 둔다.
- 착지 전 0.5~0.8초(`dropMs`)는 무적이며 이동·공격 타이머가 시작되지 않는다. 착지 위치를 미리 보여 주어 모바일 조준으로도 대응할 수 있게 한다(표식은 P02-T03).
- 한맥(정지 반경 11m)·필굿(돌격 반경 12m)은 착지 반경 안에서도 기존 규칙대로 동작한다.

## Implementation

### I01. 튜닝 값

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss.minionDrop` — 값 추가; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  minionDrop: { minRadiusM: 6, maxRadiusM: 14, thetaRangeRad: 0.55, dropMs: 700 }, // [초안]
  ```
- `thetaRangeRad`는 화면 밖으로 떨어지지 않도록 가장 좁은 화면비에서도 보이는 범위(카메라 수직 FOV 52°, 16:9에서 반폭 약 0.72rad)보다 작게 둔다.

### I02. 소환 위치와 착지 상태

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`(`dropLandAtMs?`), `spawnBossMinionWave`(`:919`), `isTargetLanded` — 위치와 무적; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity
  dropLandAtMs?: number;          // 이 시각 전에는 낙하 중
  public isTargetLanded(t: ActiveTargetEntity, nowMs: number): boolean; // dropLandAtMs === undefined || nowMs >= dropLandAtMs
  ```
- **Execution Flow / Logic**:
  1. `spawnBossMinionWave`: `theta = (dropRng() * 2 - 1) * thetaRangeRad`, `radius = minRadiusM + dropRng() * (maxRadiusM - minRadiusM)`. `dropLandAtMs = nowMs + dropMs`.
  2. 같은 소환 안의 부하끼리 너무 겹치지 않게 반경·각도가 가까우면(예: 거리 < 1.5m) 최대 3번 다시 뽑는다(`dropRng` 사용으로 결정적).
  3. 이동 갱신: 낙하 중(`!isTargetLanded`)인 대상은 이동하지 않는다. 한맥 포격 타이머(`hanmacArrivedAtMs`)와 오비 방패 위상(`guardPhaseMs`)은 착지 시각 이후에 시작한다.
  4. 피격: `shootAt` 판정 루프, 스킬 범위 계산, 관통(리볼버) 대상 수집에서 낙하 중 대상을 제외한다. 투사체 요격 대상에는 영향 없음.
  5. 웨이브 완료 판정과 `summonMaxActive` 집계에는 낙하 중 부하도 포함한다(소환이 끝없이 쌓이지 않게).
  6. `freezeTimers`에서 `dropLandAtMs`도 밀어서 카드 선택 중 낙하가 끝나 버리지 않게 한다.

### I03. 테스트

- Related Files:
  - `tests/boss-minion-drop.test.ts` :: 새 테스트; new
  - `tests/boss-encounters.test.ts` :: 부하 위치를 11.5~14.5m로 가정한 부분; modify

#### Details
- **새 테스트 시나리오**:
  - 소환된 부하의 반경이 `[minRadiusM, maxRadiusM]`, 각도가 `±thetaRangeRad` 안이다(`dropRng` 고정으로 반복 확인).
  - 착지 전에는 `shootAt`이 그 부하를 맞히지 못하고 이동하지 않는다. `dropMs` 후에는 맞힐 수 있고 움직인다.
  - 스킬(거품 해일 등) 범위에 낙하 중 부하가 들어가도 피해를 받지 않는다.
  - 낙하 중 부하도 `summonMaxActive` 집계에 들어간다.
  - `freezeTimers`로 시간을 밀면 착지 시각도 밀린다.
  - 같은 소환의 부하들이 서로 너무 가깝지 않다.


## Acceptance Criteria
- [ ] 부하가 반경 6~14m, 화면 폭 안에 무작위로 소환된다.
- [ ] 착지 전에는 맞지도 움직이지도 공격하지도 않는다.
- [ ] 카드 선택·일시정지 중에는 낙하 시간이 줄지 않는다.

## Validation
- `npx vitest run tests/boss-minion-drop.test.ts tests/boss-encounters.test.ts tests/monster-traits.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(boss): drop summoned minions across the field

Plan: 2026-11-05-score-differentiation
Phase: P02-boss-pressure
Task: T02-random-minion-drop

- Spawn minions at 6-14m with a wide angle instead of behind the boss
- Keep them untargetable and idle until they land
- Count falling minions toward the active minion cap
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
