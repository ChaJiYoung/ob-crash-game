# Task: T03 인게임 가이드 모달 열람 시 엔진 완벽 일시정지(Time Shift) 및 닫을 때 3-2-1 재개 카운트다운/영점 재보정

## Status: pending

## Goal
인게임(`PLAYING`, `TUTORIAL`) 도중 가이드 모달을 열었을 때 3D 게임 엔진(몬스터 이동, 스폰, 피버 자동 연사, 피버/아이템 버프/자동 재장전 남은 시간)이 완벽히 일시정지되도록 `engine.setPaused()` 및 타이머 시프트(Time Shift)를 구현하고, 가이드를 닫았을 때 즉시 재개되지 않고 3, 2, 1 재개 카운트다운을 거친 뒤 0초에 정면 영점을 자동 재보정하며 게임이 재개되도록 완성한다.

## Decision Summary
- [D03](../../decisions/2026-11-02-fix-midgame-restart-and-fever-miss.md): 인게임 가이드 열람 시 완벽 일시정지(Time Freeze & Shift) 및 닫을 때 3, 2, 1 재개 카운트다운 + 0초 정면 영점 자동 재보정.

## Implementation

### I01. 엔진 일시정지(`isPaused`) 및 타이머 만료 시각 시프트(Time Shift) 구현

- Related Files:
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager.shiftFeverTimer` — 일시정지 시간만큼 `feverEndTimeMs` 연장; modify
  - `src/pc/engine/WeaponSystem.ts` :: `WeaponSystem.shiftReloadTimer` — 일시정지 시간만큼 `reloadEndTimeMs` 연장; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine.setPaused` — 일시정지 상태 관리 및 해제 시 모든 타이머 보정; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/engine/ScoreAndFeverManager.ts
  public shiftFeverTimer(deltaMs: number): void {
    if (this.isFeverActive && deltaMs > 0) {
      this.feverEndTimeMs += deltaMs;
    }
  }

  // src/pc/engine/WeaponSystem.ts
  public shiftReloadTimer(deltaMs: number): void {
    if (this.isReloading && deltaMs > 0) {
      this.reloadEndTimeMs += deltaMs;
    }
  }

  // src/pc/engine/BeerCrusherEngine.ts
  public isPaused = false;
  private pausedAtMs: number | null = null;
  public setPaused(paused: boolean, nowMs = performance.now()): void
  ```
- **Execution Flow / Logic**:
  1. `BeerCrusherEngine.setPaused(paused, nowMs)`:
     - `paused === true && !this.isPaused`:
       - `this.isPaused = true;`
       - `this.pausedAtMs = nowMs;`
     - `paused === false && this.isPaused`:
       - `const pauseDurationMs = this.pausedAtMs !== null ? Math.max(0, nowMs - this.pausedAtMs) : 0;`
       - `this.lastSpawnTimeMs += pauseDurationMs;`
       - `this.activeBuffUntilMs.forEach((until, k) => this.activeBuffUntilMs.set(k, until + pauseDurationMs));`
       - `this.scoreManager.shiftFeverTimer(pauseDurationMs);`
       - `this.weaponSystem.shiftReloadTimer(pauseDurationMs);`
       - `this.isPaused = false;`
       - `this.pausedAtMs = null;`
  2. `BeerCrusherEngine.update(nowMs, dtSec)`:
     - 최상단에 `if (this.isPaused) { return { breaches: [], phaseChanged: false, reloadedJustNow: false }; }` 추가!
  3. `BeerCrusherEngine.shootAt(aimX, aimY, nowMs)`:
     - 최상단에 `if (this.isPaused) { return { fired: false, grade: 'MISS' }; }` 추가!

### I02. PCGamePage 가이드 열기/닫기 일시정지 및 3-2-1 재개 카운트다운 연동

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `handleOpenGuide`, `handleCloseGuide` 및 3-2-1 재개 카운트다운 구현; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 엔진 일시정지 및 타이머 보존 유닛 테스트 추가; modify

#### Details
- **Execution Flow / Logic**:
  1. `handleOpenGuide`:
     - `setIsGuideOpen(true);`
     - 만약 `gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL'` 이면:
       `engine.setPaused(true, performance.now());`
  2. 50ms HUD 인터벌 내부:
     - `feverState.isFeverActive && !engine.isPaused && (gamePhase === 'PLAYING' || gamePhase === 'SANDBOX')` 일 때만 피버 자동 연사 실행 (`engine.isPaused` 이면 즉시 `clearInterval(feverAutoFireTimerRef.current)`).
  3. `handleCloseGuide`:
     - `setIsGuideOpen(false);`
     - 만약 `gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL'` 이면:
       - `engine.setPaused(true, performance.now())` 유지한 상태에서 **3, 2, 1 재개 카운트다운** 시작!
       - 모바일 컨트롤러에도 `START_GAME_REQUEST`를 보내 폰에서도 3, 2, 1 카운트다운과 0초 자동 영점화가 동기화되도록 함.
       - 0초 도달 시:
         `zeroOffsetRef.current = { offsetX: latestAimRef.current.aimX, offsetY: latestAimRef.current.aimY };`
         `engine.setPaused(false, performance.now());` 실행하여 게임을 멈췄던 시점 그대로 재개!
     - 로비(`PAIRING`)에서 가이드를 닫을 때는 카운트다운 없이 모달만 즉시 닫힘.

## Acceptance Criteria
- [ ] 인게임(`PLAYING`, `TUTORIAL`) 도중 가이드 버튼을 누르면 몬스터 이동, 스폰, 피버 자동 연사가 즉시 멈추고 피버/버프 남은 시간이 줄어들지 않는다.
- [ ] 인게임 중 가이드를 닫으면 바로 시작되지 않고 3, 2, 1 카운트다운이 뜬 뒤 0초에 정면 영점이 재보정되며 멈췄던 시점부터 게임이 이어진다.
- [ ] `tests/engine-judgment-and-spawn.test.ts` 통과 및 `npm run build` 성공.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 일시정지 중 몬스터 위치 및 버프/피버 시간 동결 검증
- `npx vitest run` — 전체 테스트 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(pause): pause game engine on guide open and resume with 3-2-1 countdown and zero recalibration

Plan: 2026-11-02-fix-midgame-restart-and-fever-miss
Phase: P01-fix-midgame-restart-fever-miss-and-guide-pause
Task: T03-guide-modal-engine-pause-and-resume-countdown

- Add isPaused and setPaused with timer shift to BeerCrusherEngine, ScoreAndFeverManager, and WeaponSystem
- Freeze monster movement, spawns, fever auto-fire, and buff durations while guide modal is open
- Run 3-2-1 resume countdown upon closing guide in-game and recalibrate zero at 0s before unpausing
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
