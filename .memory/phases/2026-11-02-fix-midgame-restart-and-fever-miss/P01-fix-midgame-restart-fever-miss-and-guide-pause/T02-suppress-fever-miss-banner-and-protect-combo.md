# Task: T02 피버 타임 중 허공 자동 연사 `MISS` 배너 숨김 및 피버 충전/활성 중 콤보 100% 보호

## Status: pending

## Goal
피버 타임(`isFeverActive`) 동안 0.095초 간격으로 발사되는 초당 10발 자동 연사 중 허공에 빗맞은 탄환이 발생하더라도 화면에 `MISS` 판정 배너가 절대 표시되지 않도록(명중 시 `PERFECT!`만 표시) 수정하고, 피버 게이지가 100% 충전된 상태(`isFeverReady`) 및 피버 활성 상태(`isFeverActive`)에서는 빗맞은 탄환이 발생해도 콤보가 0으로 깨지지 않도록 `ScoreAndFeverManager`를 보강한다.

## Decision Summary
- [D02](../../decisions/2026-11-02-fix-midgame-restart-and-fever-miss.md): 피버 중 허공 탄환에 대한 `MISS` 판정 배너(`setLastJudgment`) 표시 차단 및 피버 충전 완료/활성 상태에서 콤보 100% 보존.

## Implementation

### I01. ScoreAndFeverManager 피버 충전/활성 시 콤보 보호 및 PCGamePage `MISS` 배너 억제

- Related Files:
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — `isFeverReady` 및 `isFeverActive` 상태에서 콤보 리셋 방지 및 `lastHitCombo` 보존; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage.handleShootEvent` — 피버 활성 중 `result.grade === 'MISS'`일 때 `setLastJudgment` 호출 생략; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 피버 100% 충전 상태 및 피버 활성 중 콤보 보호 검증; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/engine/ScoreAndFeverManager.ts
  export class ScoreAndFeverManager {
    private feverBaseCombo = 0;
    private lastHitCombo = 0;
    ...
  ```
- **Execution Flow / Logic**:
  1. `ScoreAndFeverManager.registerHit`:
     - `this.combo += 1;`
     - `this.lastHitCombo = this.combo;`
  2. `ScoreAndFeverManager.applyMissPenalty`:
     - 만약 `this.isFeverActive` 이면:
       - `this.combo = Math.max(this.feverBaseCombo, this.combo);`
       - 게이지 및 콤보 감소 없이 즉시 반환.
     - 만약 `this.feverGauge >= FEVER_CONSTANTS.MAX_GAUGE || this.isFeverReady` 이면:
       - 피버 게이지가 100% 찼을 때 더블탭 발동 직전 손목이 흔들려 1발이 빗맞더라도 콤보(`this.combo`)와 게이지(`this.feverGauge`) 모두 깎이지 않고 그대로 보존!
     - 일반 상태일 때만 `this.combo = 0` 및 게이지 차감 수행.
  3. `ScoreAndFeverManager.activateFever`:
     - `this.feverBaseCombo = Math.max(this.combo, this.lastHitCombo);`
     - `this.combo = this.feverBaseCombo;`
  4. `PCGamePage.handleShootEvent`:
     - `if (result.grade !== 'MISS')`:
       - `soundSynth.playHit(result.grade);`
       - `setLastJudgment({ grade: result.grade, key: Date.now() });`
     - `else if (!isFever)`:
       - 비피버 일반 사격에서 빗맞았을 때만 `setLastJudgment({ grade: 'MISS', key: Date.now() })` 호출! 피버 중에는 허공 탄환이 `MISS` 배너를 절대 띄우지 않음.

## Acceptance Criteria
- [ ] 피버 모드 자동 연사 도중 허공에 총알이 나가도 화면에 `MISS` 배너가 전혀 뜨지 않으며, 타겟을 맞혔을 때만 시원하게 `PERFECT!`가 표시된다.
- [ ] 피버 게이지 100% 충전 직후 또는 피버 도중 빗맞은 탄환이 있어도 쌓아둔 콤보가 절대 0으로 초기화되지 않는다.
- [ ] `tests/engine-judgment-and-spawn.test.ts` 통과.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 피버 충전/활성 중 콤보 보존 테스트 통과

## Commit Message
```text
fix(fever): suppress MISS banner during fever auto-fire and protect combo when fever ready/active

Plan: 2026-11-02-fix-midgame-restart-and-fever-miss
Phase: P01-fix-midgame-restart-fever-miss-and-guide-pause
Task: T02-suppress-fever-miss-banner-and-protect-combo

- Do not trigger MISS judgment banner on empty-air auto-fire shots during active fever
- Preserve combo without resetting to 0 when fever is ready (100% gauge) or active
- Ensure feverBaseCombo retains the player's accumulated combo upon fever activation
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
