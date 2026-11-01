# Task: T02 3단계 미션 클리어형 실습 사격 훈련장 엔진/UI(TUTORIAL GamePhase) 구현 및 단위 테스트 검증

## Status: done ✅

## Goal
플레이어가 실전에 들어가기 전 3D 월드에서 직접 **1단계 조준 단발 사격 ➔ 2단계 3HP 연타/재장전 ➔ 3단계 피버 100% 무한 난사**를 차례대로 체험하며 조작 손맛을 익히는 실습 사격 훈련장 모드를 구축하고, 단위 테스트를 통해 스텝 전진 및 상태 격리(무적/점수 비기록)를 검증한다.

## Decision Summary
- `.memory/decisions/2026-11-02-tutorial-and-shooting-range.md`의 D03, D04 반영.
- `GamePhase`에 `'TUTORIAL'` 추가.
- `BeerCrusherEngine.ts`에 튜토리얼 전용 스텝 머신(`tutorialStep: 1 | 2 | 3 | 'COMPLETED'`) 추가.
- 훈련 중에는 방어선 도달 시 라이프 감소 방지(무적) 및 랭킹 서버 점수 전송 격리.
- 상단 미션 안내 UI 및 완료 시 `[실전 배틀 시작]` / `[로비 복귀]` 선택지 제공.

## Implementation

### I01. 타입 및 엔진 튜토리얼 상태 머신 구현

- Related Files:
  - `src/shared/types.ts` :: `GamePhase` — `'TUTORIAL'` 단계 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — 튜토리얼 스텝 제어 및 타겟 스폰 로직 추가; modify
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — `forceSetFeverGauge(gauge: number)` 메서드 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type TutorialStep = 1 | 2 | 3 | 'COMPLETED';

  export interface TutorialState {
    step: TutorialStep;
    targetsRemaining: number;
    guideMessage: string;
    isFeverTriggered: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `startTutorialMode()` 호출 시:
     - `gamePhase = 'TUTORIAL'`
     - `lives = 5` 고정, 방어선 침투 이벤트 시 라이프 감소 0 처리.
  2. **Step 1 (조준 & 단발 사격)**:
     - 3개의 정지된 1HP 연습 타겟(좌/중/우) 스폰.
     - 3개 모두 명중 파괴 시 `Step 2`로 자동 전환 + 효과음 재생.
  3. **Step 2 (연타 사격 & 재장전)**:
     - 1개의 전진 3HP 카스 병맥주(`bottle`) 스폰.
     - 3타 연타로 격파 필요, 10발 소진 시 자동 재장전(1.2초) 안내.
     - 격파 성공 시 `Step 3`으로 자동 전환.
  4. **Step 3 (피버 발동 & 무한 난사)**:
     - `feverManager.forceSetFeverGauge(100)` 즉시 호출 ➔ `isFeverReady = true`.
     - "Space바(또는 모바일 더블탭)를 눌러 피버를 켜세요!" 안내.
     - 피버 발동 시 8초간 다수의 타겟 무리(필굿/카스라이트 6개) 스폰 및 무한 탄창 난사 유도.
     - 타겟 전멸 또는 피버 종료 시 `step = 'COMPLETED'`로 전환.
  5. **완료 및 실전 전환**:
     - `startRealGame()` 호출 시 `gamePhase = 'PLAYING'`, Wave 1부터 일반 게임 개시.
     - `exitToLobby()` 호출 시 `gamePhase = 'PAIRING'`으로 복귀.

### I02. 튜토리얼 안내 UI (TutorialGuideOverlay) 및 PCGamePage 연동

- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlay` — 화면 상단 반투명 미션 안내 카드 및 완료 모달; new
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 튜토리얼 시작/종료 핸들러 및 키보드/마우스 입력 연동; modify

### I03. 단위 테스트 작성

- Related Files:
  - `tests/tutorial-and-guide.test.ts` :: `Tutorial Flow Tests` — 튜토리얼 스텝 전환, 피버 세팅, 무적 상태 검증; new

#### Details
- Step 1 ➔ Step 2 ➔ Step 3 ➔ COMPLETED 단계별 타겟 파괴 및 스텝 전진 검증.
- 훈련 모드 중 타겟 침투 시 라이프 감소가 0인지 검증.
- `forceSetFeverGauge(100)` 시 피버 발동 가능 상태 검증.

## Acceptance Criteria
- [x] `startTutorialMode()` 진입 시 3단계 미션이 순차적으로 진행됨.
- [x] Step 1에서 3개 타겟 파괴 시 Step 2로 전진하고, Step 2에서 3HP 타겟 파괴 시 Step 3으로 전진함.
- [x] Step 3에서 피버 100%가 충전되고 피버 발동 후 무한 탄창으로 타겟 무리를 난사할 수 있음.
- [x] 튜토리얼 완료 시 `실전 시작`을 누르면 Wave 1로 정상 시작되고, `로비 복귀`를 누르면 대기실로 정상 복귀함.
- [x] 신규 유닛 테스트(`tests/tutorial-and-guide.test.ts`) 및 기존 32개 테스트 모두 통과.

## Validation
- `npm test tests/tutorial-and-guide.test.ts && npm test && npx tsc --noEmit`

## Commit Message
```text
feat(engine): implement 3-step interactive shooting range tutorial mode and guide modal

Plan: 2026-11-02-tutorial-and-shooting-range
Phase: P01-tutorial-and-shooting-range
Task: T02-interactive-shooting-range-engine-and-flow

- Add TUTORIAL GamePhase and step-machine (Step 1 single-shot -> Step 2 rapid -> Step 3 fever)
- Implement invulnerable barrier and ranking isolation in BeerCrusherEngine
- Create TutorialGuideOverlay component with step banners and graduation modal
- Add comprehensive unit tests in tests/tutorial-and-guide.test.ts (6/6 passed, total 38/38)
- Capture full tutorial progression screenshots (screen-07 through screen-13)
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done ✅
