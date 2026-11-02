# Task: T02 피버 타임 콤보 하한선 보호 (Combo Floor Protection) & 피버 도중 콤보 보존

## Status: done

## Goal
피버 타임(FEVER) 동안 초당 10발씩 빗발치듯 자동 연사가 나가는 도중 총알이 허공을 갈라 MISS가 발생하더라도, 쌓아둔 콤보가 0으로 날아가지 않고 **피버 시작 직전 콤보 값(`feverBaseCombo`)을 하한선으로 든든하게 보존**하며, 몬스터를 맞출 때마다 콤보가 계속 누적되도록 `ScoreAndFeverManager.ts`의 판정 로직을 개선한다.

## Decision Summary
- [D02](../../decisions/2026-11-02-aimlock-snap-fevercombo-startflow.md): 피버 활성화 시점의 콤보 값(`feverBaseCombo`)을 스냅샷으로 저장하고, 피버 중 MISS 발생 시 `this.combo = Math.max(this.feverBaseCombo, this.combo)` 적용.

## Implementation

### I01. ScoreAndFeverManager 피버 콤보 하한선 저장 및 페널티 면제 로직

- Related Files:
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — 피버 베이스 콤보 필드 추가 및 `applyMissPenalty` 수정; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export class ScoreAndFeverManager {
    ...
    private feverBaseCombo = 0; // 피버 시작 순간의 콤보 스냅샷
  ```
- **Execution Flow / Logic**:
  1. `activateFever(nowMs: number): boolean`:
     - 피버 발동 성공 시: `this.feverBaseCombo = this.combo;`
  2. `applyMissPenalty()`:
     - **피버 활성 중(`this.isFeverActive === true`) 분기**:
       - `this.combo = Math.max(this.feverBaseCombo, this.combo);`
       - 피버 게이지는 감소시키지 않고 유지.
       - 반환: `{ combo: this.combo, maxCombo: this.maxCombo, feverGauge: this.feverGauge, isFeverReady: this.isFeverReady }`
     - **비피버 상태 분기**:
       - `this.combo = 0;` (기존 페널티 수행)
       - `this.feverGauge = Math.max(0, this.feverGauge - FEVER_CONSTANTS.MISS_PENALTY);`

### I02. 유닛 테스트 검증 추가

- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 피버 콤보 하한선 보호 테스트 케이스 추가; modify

#### Details
- **Test Scenarios**:
  1. 10콤보 달성 후 피버 발동 (`feverBaseCombo = 10`).
  2. 피버 중 MISS 사격 발생 -> `combo`가 0이 아니라 10으로 유지되는지 검증 (`expect(result.combo).toBe(10)`).
  3. 피버 중 타겟 명중 시 11, 12로 정상 증가하는지 검증.
  4. 이후 다시 MISS 발생 시에도 10 미만으로 떨어지지 않는지 검증.

## Acceptance Criteria
- [x] 피버 타임 동안 허공 사격으로 MISS가 발생해도 콤보가 0으로 초기화되지 않는다.
- [x] 피버 시작 직전에 쌓아둔 콤보가 하한선(Floor)으로 100% 보존된다.
- [x] 피버 중 몬스터를 처치하면 콤보가 계속 누적 증가한다.
- [x] `tests/engine-judgment-and-spawn.test.ts` 통과.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 피버 콤보 보존 테스트 통과

## Commit Message
```text
feat(engine): implement fever combo floor protection against missed shots

Plan: 2026-11-02-cocking-snap-fevercombo-startflow
Phase: P01-cocking-snap-fevercombo-startflow
Task: T02-fever-combo-floor-protection

- Snapshot feverBaseCombo on activateFever
- Prevent combo reset to 0 during active fever on applyMissPenalty
- Ensure combo stays at or above feverBaseCombo throughout fever duration
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
