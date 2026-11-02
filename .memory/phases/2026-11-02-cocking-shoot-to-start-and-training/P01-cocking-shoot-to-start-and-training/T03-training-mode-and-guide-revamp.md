# Task: T03 훈련장(TRAINING MODE) 3단계 미션 및 가이드 모달 신규 건슈팅 조작법 전면 개편

## Status: done

## Goal
훈련장(TRAINING MODE / Tutorial)의 안내 문구와 미션 판정에서 구시대의 "마우스 조작 / 연타(홀드) 연사" 설명을 완전히 걷어내고, 신규 건슈팅 아케이드 메커니즘("화면 터치 장전 ➔ 위로 채기 단발 사격", "더블탭 피버 발동")에 맞게 3단계 미션 가이드를 최신화한다. 아울러 게임 가이드 모달(`GuideModal`)의 조작법 탭 설명도 신규 조작법에 부합하도록 일괄 개편한다.

## Decision Summary
- 사용자 피드백 ("훈련장도 고쳐야해"): 훈련 모드의 안내 텍스트와 3단계 미션 조건이 과거의 홀드 연사/마우스 조작에 머물러 있어, 신규 "철컥 탕!" 조작법과 불일치하던 부분을 전면 갱신함.

## Implementation

### I01. TutorialGuideOverlay 훈련장 3단계 미션 가이드 개편

- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlay` — 3단계 미션 문구 및 팁 최신화; modify

#### Details
- **UI Elements**:
  - **STEP 1 (조준 & 단발 사격)**:
    - "스마트폰을 모니터로 겨누고 **화면 터치(철컥! 장전) 후 위로 휙 채어(탕! 발사)** 정지된 연습 캔 3개를 맞히세요!"
    - 💡 팁: 화면을 누르고 있을 때는 조준선이 타겟에 단단히 고정(Aim Lock)됩니다.
  - **STEP 2 (신속 코킹 & 연속 사격)**:
    - "다가오는 단단한 **카스 병맥주 (체력 3HP)**를 빠른 **코킹 & 스냅(장전 후 위로 채기 3회)**으로 격파하세요!"
    - 💡 팁: 10발 소진 시 1.2초간 자동으로 재장전됩니다.
  - **STEP 3 (피버 모드 대폭발)**:
    - "화면을 **따닥! 빠르게 두 번 탭**하여 피버 모드를 발동하고 쏟아지는 캔들을 격파하세요!"
    - 💡 팁: 피버 타임에는 손을 대지 않아도 초당 10발씩 자동으로 와다다다 연사되며 콤보가 유지됩니다.

### I02. GuideModal 조작법 탭 갱신

- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `GuideModal` — 스마트폰 컨트롤러 조작법 목록 최신화; modify

#### Details
- **UI Elements**:
  - 🔫 스마트폰 조작법 카드:
    - 🔒 **코킹 장전 (Aim Lock)**: 화면 터치 다운 시 "철컥!" 효과음과 함께 조준선 고정 (발사되지 않음)
    - ⚡ **단발 사격 (Fire)**: 터치 상태에서 손목을 위로 휙 채면 "탕!" 1발 격발
    - 🎯 **게임 시작 (Start)**: 대기 화면에서 모니터 중앙의 [SHOOT TO START] 과녁을 조준 사격
    - 🔥 **피버 발동 (Fever)**: 게이지 100% 충전 시 화면을 빠르게 따닥 더블탭 (피버 중 초당 10발 자동 난사)
    - 🔄 **자동 재장전**: 10발 소진 시 1.2초 후 자동 장전

## Acceptance Criteria
- [x] 훈련장(TRAINING MODE) 진입 시 Step 1, 2, 3 안내 배너에 "화면 터치 장전, 위로 채기 발사, 더블탭 피버"가 정확히 안내된다.
- [x] 가이드 모달(조작 방법 탭)에서 홀드 연사 설명이 사라지고 신규 코킹-스냅 메커니즘과 [SHOOT TO START] 시작법이 명시된다.
- [x] `tests/tutorial-and-guide.test.ts` 통과.

## Validation
- `npx vitest run tests/tutorial-and-guide.test.ts` — 훈련장 가이드 및 도감 텍스트 검증
- `npx vitest run` — 전체 9개 테스트 파일 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(tutorial): revamp training mode guides and controls modal for cocking-snap gunplay

Plan: 2026-11-02-cocking-shoot-to-start-and-training
Phase: P01-cocking-shoot-to-start-and-training
Task: T03-training-mode-and-guide-revamp

- Update 3-step tutorial instructions with cocking-snap gunplay mechanics
- Eliminate obsolete hold rapid-fire guides in tutorial overlay
- Refresh controls modal guide cards for aim-lock, snap fire and shoot-to-start flow
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
