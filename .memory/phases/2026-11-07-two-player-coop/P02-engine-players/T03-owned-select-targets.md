# Task: T03 여러 플레이어의 선택 라운드

## Status: pending

## Goal
P01-T04에서 하나로 합친 선택 라운드가 플레이어 수만큼 표적 묶음을 만들고, 각자 자기 표적만 맞히며, 모두 골라야 끝나게 한다(D13). 시간 제한은 없다(1인·2인 모두, D34). 화면이 "누가 골랐고 누구를 기다리는지" 보여 줄 수 있게 선택 상태 조회와, 이탈자 몫을 고르는 자동 선택 함수(P02-T04가 사용)를 더한다. 새 분기 없이 P01-T04 흐름에 기능만 더한다(D24).

## Decision Summary
- 배치·주인·판정·고르기·종료는 P01-T04에 이미 있다(1인도 `ownerIndex 0`). 2인은 `rules.selectLayout`의 `groupCentersX`가 2개라 표적이 6개가 될 뿐이다(P02-T02가 배치를 인원수 표로 옮김).
- D34: 제한 시간·마감 시각·카운트다운은 만들지 않는다. 연결된 채 고르지 않으면 상대는 기다린다.
- 자동 선택은 이탈 처리된 플레이어(D20)에만 쓴다: 자기 표적 중 `dropRng`로 무작위 1개.
- 카드 선택 직후 스킬 잠금 0.3초(D27)는 처리부 규칙이라 P01-T05가 맡는다.

## Implementation

### I01. 선택 상태와 자동 선택

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `autoPickFor`(new), `getSelectionStatus`(new), `computeSelectLayout`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface SelectionStatus {
    kind: SelectRoundKind | null;
    /** players 순서. 이미 고른 사람 true. */
    done: boolean[];
  }
  public getSelectionStatus(): SelectionStatus;
  /** 그 플레이어 선택 표적 중 무작위 1개를 고른다(이탈자용, P02-T04). 표적이 없으면 selectionDone만 true. */
  public autoPickFor(playerIndex: PlayerIndex, nowMs: number): void;
  ```
- **Execution Flow / Logic**:
  1. `getSelectionStatus()`: `kind = selectRound?.kind ?? null`, `done = players.map(p => p.selectionDone)`.
  2. `autoPickFor(i, nowMs)`: 그 플레이어의 선택 표적(`ownerIndex === i`) n개 중 `Math.floor(dropRng() * n)`번째로 `applySelection`(P01-T04). 없으면 `selectionDone = true` 후 모든 플레이어 완료면 `finishSelectRound`.
  3. `computeSelectLayout`은 P02-T02와 함께 `this.rules.selectLayout`을 읽는다(플레이어 수만큼 묶음).

### I02. 테스트

- Related Files:
  - `tests/select-round-players.test.ts`; new

#### Details
- `describe.each([1, 2])`로 같은 시나리오를 인원수만 바꿔: 표적 수 `3 × n`, 플레이어별 3개, 모두 고르면 라운드 종료.
- 시간 제한 없음: 2인에서 1P만 고르고 엔진을 60초 진행해도 라운드 유지, `done = [true, false]`.
- 2인: 1P가 2P 표적 좌표를 쏘면 `fired: false`. 1P 선택 뒤 2P 표적은 남는다.
- `autoPickFor(1, now)`: `dropRng = () => 0`이면 2P 첫 표적이 골라지고, 1P가 이미 골랐다면 라운드 종료.
- 카드 라운드: 둘 다 골라야 다음 웨이브.

## Acceptance Criteria
- [ ] 1인·2인이 같은 선택 라운드 코드로 동작하고, 차이는 `rules.selectLayout` 배치뿐이다.
- [ ] 선택 라운드에 시간 제한이 없다.

## Validation
- `npx vitest run tests/select-round-players.test.ts tests/hit-and-select-round.test.ts tests/card-select-gate.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(engine): select rounds wait for every player

Plan: 2026-11-07-two-player-coop
Phase: P02-engine-players
Task: T03-owned-select-targets

- Each player gets their own select targets from rules.selectLayout; the round ends when all have picked
- No time limit (solo or coop); autoPickFor is kept for away players
- getSelectionStatus reports who has picked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
