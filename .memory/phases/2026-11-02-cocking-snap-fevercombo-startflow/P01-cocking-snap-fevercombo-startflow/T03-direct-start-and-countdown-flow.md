# Task: T03 사전 영점 화면 폐지, 패드 직행, 대형 시작 버튼 & 전체화면 3,2,1 카운트다운/0초 자동 영점화

## Status: done

## Goal
닉네임 등록 및 권한 승인 후 텍스트가 많아 사용자에게 혼란을 주던 사전 영점 가이드(`ZeroingGuide`)를 전면 폐지하고 메인 컨트롤러 패드로 직행하도록 개선하며, 폰 화면 한가운데에 누르기 편한 대형 `🚀 준비 완료! 게임 시작` 버튼을 배치하여 누르는 순간 전체화면 3, 2, 1 대형 카운트다운과 초당 햅틱 진동이 100% 뜨고 0초에 자동 영점화가 되도록 모바일 시작 동선을 완성한다.

## Decision Summary
- [D03](../../decisions/2026-11-02-aimlock-snap-fevercombo-startflow.md): 닉네임 입력 후 `ZeroingGuide` 생략하고 `PAD`로 직행. 화면 중앙 대형 시작 버튼 및 풀스크린 3, 2, 1 카운트다운 ➔ 0초 자동 영점화.

## Implementation

### I01. MobileControllerPage 단계 단순화 및 패드 직행 플로우

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 권한 허용 시 `PAD`로 즉시 전환 및 카운트다운 렌더링 보강; modify

#### Details
- **Execution Flow / Logic**:
  1. `handlePermissionGranted`:
     - `setSensorsActive(true);`
     - `setStep('PAD');` // 기존 'ZEROING' 대신 곧바로 메인 조작 패드로 직행!
  2. 카운트다운 오버레이 렌더링 최적화:
     - `countdownSec !== null` 상태일 때 `GunGripPad` 상위에 `fixed, inset 0, zIndex 9999`로 카운트다운 오버레이 보장.
     - 1초마다 `triggerHaptic(60)` 울림 및 "🎯 폰을 모니터 정중앙으로 겨누세요!" 시각 가이드.
     - 0초 도달 시 `handleCalibrateZero()` 자동 실행 후 시작 격발 햅틱.

### I02. GunGripPad 대형 시작 버튼 및 "철컥 탕!" 조작 가이드 안내 개편

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 대형 시작 버튼 UI 및 신규 조작법 안내 텍스트 반영; modify

#### Details
- **UI Elements**:
  - 시작 대기 상태(`isGameWaiting === true`):
    - 패드 중앙에 눈에 띄는 대형 골드/에메랄드 그라데이션 `🚀 준비 완료! 게임 시작` 버튼 배치.
  - 조작법 카드 안내:
    - 🔒 **화면 터치**: "철컥!" 코킹 장전 & 조준 고정 (Aim Lock)
    - ⚡ **위로 휙 채기**: "탕!" 반동 스냅 사격
    - 🔥 **빠르게 두번 탭**: 피버 모드 발동

## Acceptance Criteria
- [x] 닉네임 입력 및 권한 허용 후 글자가 많은 `ZeroingGuide`를 거치지 않고 바로 컨트롤러 패드로 진입한다.
- [x] 폰 화면에 커다란 `🚀 준비 완료! 게임 시작` 버튼이 명확히 보인다.
- [x] 시작 버튼을 누르면 폰 화면에 3, 2, 1 카운트다운과 초당 햅틱 진동이 100% 확실하게 표시된다.
- [x] 0초 도달 시 현재 겨눈 방향이 자동으로 정면 영점으로 잡히며 게임이 시작된다.
- [x] 전체 45개 유닛 테스트 및 `npm run build` 성공.

## Validation
- `npx vitest run tests/controller-ui-and-routing.test.ts` — 컨트롤러 라우팅 및 렌더링 통과
- `npx vitest run` — 전체 테스트 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(flow): bypass zeroing guide directly to pad with big start button and 3-2-1 countdown

Plan: 2026-11-02-cocking-snap-fevercombo-startflow
Phase: P01-cocking-snap-fevercombo-startflow
Task: T03-direct-start-and-countdown-flow

- Transition directly from LOGIN_GATE to PAD upon permission grant
- Add prominent centered game start button on mobile pad
- Render high-priority fullscreen 3-2-1 countdown overlay with per-second haptics
- Update pad guide text for cocking-snap shooting mechanics
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
