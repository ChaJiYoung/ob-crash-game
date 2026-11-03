# Task: T03 Mobile Snap Aim Freeze & Arcade Feedback HUD

## Status: done

## Goal
모바일 컨트롤러의 '휙!' 스냅 액티브 스킬 시전 시 에임 고정 시간(Freeze Time)을 350ms로 연장하여 손목 반동으로 인한 에임 튐을 방지하고, 황금 캔 등장 알림(코인 차임 사운드 + 골드 테두리) 및 투사체 요격 시 `[INTERCEPTED! 🛡️]` 전용 아케이드 팝업을 구현한다.

## Decision Summary
- `MobileControllerPage.tsx`에서 스냅 감지 시 `tracker.lockAim(...)` 후 `350ms` 타이머로 해제하여 손목 복귀 시간 동안 에임을 정면에 고정.
- `SoundSynthesizer.ts`에 `playGoldenCanChime()` 및 `playInterceptSound()` 추가.
- `PCGamePage.tsx`에 황금 캔 등장 골드 테두리 플래시(`isGoldenCanAlertActive`) 및 투사체 요격 이벤트 시 `[INTERCEPTED! 🛡️]` 플로팅 배너 팝업 추가.

## Implementation

### I01. Mobile Snap 350ms Aim Freeze
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `onMotion` — 스냅 스킬 발동 시 350ms 에임 고정; modify

#### Details
- **Signatures & Logic**:
  ```typescript
  // Inside onMotion:
  if (snap) {
    skillSnapTriggeredRef.current = true;
    // Lock aim for 350ms to absorb wrist recoil and prevent crosshair flying to ceiling
    tracker.lockAim(latestOrientationRef.current);
    if (snapFreezeTimerRef.current) clearTimeout(snapFreezeTimerRef.current);
    snapFreezeTimerRef.current = setTimeout(() => {
      tracker.unlockAim();
    }, 350);
    ...
  }
  ```

### I02. SoundSynthesizer Audio Feedback
- Related Files:
  - `src/pc/audio/SoundSynthesizer.ts` :: `playGoldenCanChime`, `playInterceptSound` — 아케이드 특수 효과음; modify

#### Details
- **Signatures**:
  ```typescript
  public playGoldenCanChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // High-pitched bright double coin chime (988Hz -> 1318Hz)
    ...
  }

  public playInterceptSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Sci-fi shield defense zap sound (520Hz -> 880Hz upward chirp)
    ...
  }
  ```

### I03. Golden Can Alert & Projectile Intercepted HUD Popup
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 골드 테두리 인디케이터 및 요격 팝업 트리거; modify

#### Details
- 엔진 `onGoldenCanSpawned` 콜백 또는 상태 플래그 감지 시 `soundSynth.playGoldenCanChime()` 호출 및 2초간 화면 테두리 `boxShadow: inset 0 0 35px #fbbf24` 골드 네온 펄스 활성화.
- 사격 결과 `shotResult.interceptedProjectile === true`인 경우 `soundSynth.playInterceptSound()` 호출 및 `[INTERCEPTED! 🛡️]` 녹색 팝업 배너 표시.

## Acceptance Criteria
- [ ] 모바일에서 스냅 제스처 발동 시 350ms 동안 에임이 정면에 고정되어 위로 튀지 않는다.
- [ ] 황금 캔이 화면에 나타날 때 맑은 코인 차임 사운드와 골드 테두리 플래시가 작동한다.
- [ ] 적 투사체(거품, 미사일)를 요격했을 때 `[INTERCEPTED! 🛡️]` 팝업 배너와 실드 방어음이 출력된다.

## Validation
- `npx tsc --noEmit` — 0 errors
- `npx vitest run src/tests/` — 통과

## Commit Message
```text
feat(feedback): extend mobile snap aim freeze to 350ms and add golden can alert and projectile intercepted HUD

Plan: 2026-11-03-weapon-crosshairs-and-gameplay-polish
Phase: P01-crosshairs-and-gameplay-polish
Task: T03-mobile-snap-freeze-and-arcade-feedback

- Lock mobile aim tracker for 350ms on snap gesture to absorb wrist recoil
- Add playGoldenCanChime and playInterceptSound in SoundSynthesizer
- Add golden border alert on golden can spawn and INTERCEPTED popup on projectile hit
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
