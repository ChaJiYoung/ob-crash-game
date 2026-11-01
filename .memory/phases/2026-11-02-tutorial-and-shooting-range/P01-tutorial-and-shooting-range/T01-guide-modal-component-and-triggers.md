# Task: T01 통합 가이드 모달 컴포넌트(GuideModal.tsx) 제작 및 대기실/HUD 트리거 연동

## Status: done ✅

## Goal
게임 시작 전 대기실(QR 모달)과 인게임 플레이 도중 언제든 조작법, 몬스터 6종 실물 도감, 소품 아이템 4종 및 피버 룰을 열람할 수 있는 탭형 통합 가이드 모달을 구현하고, 모달 하단에 3단계 실습 사격장으로 즉시 진입할 수 있는 트리거 버튼을 연결한다.

## Decision Summary
- `.memory/decisions/2026-11-02-tutorial-and-shooting-range.md`의 D01, D02 반영.
- `GuideModal.tsx`에 3개 탭(`controls`, `monsters`, `items`) 구성.
- 기존의 고화질 스크린샷(`docs/screens/*.png`)과 상수(`TARGET_SPECS`, `ITEM_BUFF_SPECS`)를 재활용.
- `QRPairingModal.tsx`와 `ArcadeOverlayHUD.tsx`에 가이드 열기 버튼 추가.

## Implementation

### I01. 통합 가이드 모달 컴포넌트 생성

- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `GuideModal` — 3개 탭 글래스모피즘 팝업 모달; new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartTutorial?: () => void; // 인게임 중에는 비활성화 또는 숨김
    showTutorialButton?: boolean;
  }
  ```
- **Tabs Specification**:
  1. `controls`:
     - **PC 조작**: 마우스 이동으로 조준, 좌클릭으로 단발 사격, 10발 소진 시 1.2초 자동 재장전, 피버 100% 충전 시 `Space` 바로 발동.
     - **스마트폰 조작**: 스마트폰을 권총처럼 쥐고 자이로 센서로 조준, 화면 터치로 사격, 0.25초 길게 눌러 연사, 피버 준비 시 `🔥 FEVER` 버튼 탭.
  2. `monsters`:
     - 6종 카드: 필굿(4.2m/s, 1HP), 카스라이트(3.6m/s, 1HP 날개), 오비라거(3.0m/s, 2HP 탱커), 한맥(3.2m/s, 2HP 엘리트), 카스병맥주(2.3m/s, 3HP 중장갑), 보스 냉각기(1.1m/s, 40HP 최종보스).
     - 각 카드마다 실물 컷 이미지(`public/textures/cass_official_cutout.png` 및 `docs/screens/` 에셋 연결)와 약점/팁 명시.
  3. `items`:
     - 4종 아이템: 💥 파워 샷(데미지 2배), 🎯 빅 스코프(조준경 1.6배), 🧊 아이스 프리즈(50% 감속), 🍺 바 수리(라이프 +1).
     - 피버 룰: PERFECT/GREAT 사격 시 게이지 누적, 100% 도달 시 8초간 무한 탄창 & 2배 화력 발동.
- **Bottom Actions**:
  - `showTutorialButton`이 true일 때: `🎯 지금 바로 사격 연습하기 (3단계 코스)` 큰 버튼 배치.

### I02. 대기실(QRPairingModal) 및 HUD(ArcadeOverlayHUD) 트리거 버튼 추가

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps` — `onOpenGuide: () => void` prop 추가 및 상단/하단 가이드 버튼 배치; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps` — `onOpenGuide?: () => void` prop 추가 및 우측 상단 `❓ 도감` 버튼 배치; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `isGuideOpen` state 관리 및 `GuideModal` 마운트; modify

## Acceptance Criteria
- [ ] 대기실에서 `📖 게임 가이드 & 사격 훈련` 클릭 시 `GuideModal`이 부드럽게 열림.
- [ ] 3개 탭(`조작 방법`, `몬스터 도감`, `아이템 & 피버`) 간 전환이 정상 동작함.
- [ ] 인게임 HUD 우측 상단 `❓` 버튼을 누르면 게임 중에도 가이드가 열리고 닫을 수 있음.
- [ ] `npm test && npx tsc --noEmit` 통과.

## Validation
- `npm test && npx tsc --noEmit` — 32 passed, 0 type errors

## Commit Message
```text
feat(pc): create comprehensive GuideModal and connect triggers in QR modal and HUD

Plan: 2026-11-02-tutorial-and-shooting-range
Phase: P01-tutorial-and-shooting-range
Task: T01-guide-modal-component-and-triggers

- Create GuideModal.tsx with 3 rich tabs: controls, monster codex, and items & fever
- Integrate "Game Guide & Tutorial" trigger into QRPairingModal.tsx
- Add quick in-game "Help / Codex" button to ArcadeOverlayHUD.tsx
- Verify typecheck and regression test suite
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
