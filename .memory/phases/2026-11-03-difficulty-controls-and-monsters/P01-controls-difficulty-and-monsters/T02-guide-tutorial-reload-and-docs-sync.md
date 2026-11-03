# Task: T02 컨트롤러 가이드, 인게임 튜토리얼 문구, 리로드 안내 및 도감 동기화

## Status: done

## Goal
사용자가 결정한 새로운 조작법("화면 탭: 단발 발사 | 더블 탭: 피버 발동")에 맞추어 컨트롤러 UI 가이드, 인게임 튜토리얼 오버레이, 도움말 모달, 그리고 도감 문서의 낡은 '코킹/스냅' 설명을 일관되게 갱신하고 재장전(10발 소진) 안내를 명확화한다.

## Decision Summary
- [D04](../decisions/2026-11-03-controller-single-tap-and-double-tap-fever.md): 컨트롤러 및 인게임 튜토리얼의 모든 안내 텍스트를 "화면 탭: 단발 발사 / 더블 탭: 피버 발동"으로 갱신.
- 사용자 요청 (3번 둘다해): 튜토리얼 단계 가이드 문구 갱신 및 리로드 안내/도감 문서 동기화.

## Implementation

### I01. 모바일 컨트롤러 패드 안내 문구 및 HUD 리로드 동기화

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 모바일 터치패드 안내 텍스트; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUD` — PC HUD 탄약 및 리로드 안내; read-only/modify

#### Details
- **Execution Flow / Logic**:
  1. `GunGripPad.tsx`:
     - 중앙 및 하단 안내 문구를 기존 "터치 유지 + 위로 채기 스냅 발사"에서 **"화면 톡 탭: 단발 사격 | 따닥 두 번 탭: 피버 발동"**으로 변경.
     - 피버 준비 완료(`isFeverReady === true`) 시 "🔥 FEVER READY! 화면을 빠르게 2번 탭하세요!" 알림 강조.
  2. `ArcadeOverlayHUD.tsx`:
     - 10발 소진 시 1.2초간 표시되는 "RELOAD..." 인디케이터가 직관적으로 유지되는지 확인.

### I02. 인게임 튜토리얼 가이드 오버레이 문구 갱신

- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlay` — 튜토리얼 단계별 안내 모달; modify
  - `src/pc/components/GuideModal.tsx` :: `GuideModal` — PC 로비 도움말 모달; modify

#### Details
- **Execution Flow / Logic**:
  1. `TutorialGuideOverlay.tsx`:
     - Step 1: "화면을 가볍게 탭(클릭)하여 고정된 캔 3개를 사격하세요!"
     - Step 2: "다가오는 카스 병맥주(3HP)를 화면을 3번 탭하여 격파하세요! (10발 소진 시 1.2초 자동 재장전)"
     - Step 3: "화면을 따닥! 빠르게 두 번 탭(PC는 [Space])하여 피버를 발동하세요! (피버 10초 동안 무제한 난사 & 콤보 보존)"
     - Step COMPLETED: "단발 탭 사격과 더블 탭 피버 난사를 완벽히 마스터하셨습니다!"
  2. `GuideModal.tsx`:
     - 컨트롤러 조작 탭: "1회 탭 = 즉시 단발 발사", "더블 탭 = 피버 발동", "영점 조절 = 상단 오렌지 바 클릭".
     - 몬스터 도감 탭: 카스 병맥주(대형 탱커, 3HP), 비행 몬스터(S자 유영 비행) 설명 동기화.

### I03. 문서 파일(도감 및 튜토리얼 가이드) 동기화

- Related Files:
  - `docs/튜토리얼_훈련장_가이드.md` — 훈련장 가이드 문서; modify
  - `docs/몬스터_도감_설명서.md` — 몬스터 도감 설명서; modify

#### Details
- 조작법 명세를 새로운 탭/더블탭 방식으로 수정하고, 카스 병맥주의 대형 탱커 및 비행 몬스터 S자 유영 특징을 문서에 반영.

### I04. 튜토리얼 회귀 테스트 확인

- Related Files:
  - `tests/tutorial-and-guide.test.ts` — 튜토리얼 단계 전진 및 피버 발동 테스트; modify/verify

## Acceptance Criteria
- [x] 모바일 컨트롤러에 "화면 탭: 단발 발사 | 더블 탭: 피버 발동" 가이드가 노출된다.
- [x] 튜토리얼 Step 1~3 및 완료 화면에 '스냅' 문구가 제거되고 '탭/더블탭' 문구로 대체된다.
- [x] `docs/튜토리얼_훈련장_가이드.md`와 `docs/몬스터_도감_설명서.md`의 조작 및 몬스터 정보가 최신화된다.
- [x] `tests/tutorial-and-guide.test.ts` 테스트가 통과한다.

## Validation
- `npm test tests/tutorial-and-guide.test.ts` — 튜토리얼 테스트 통과 (exit code 0)

## Commit Message
```text
docs(guide): update tutorial overlays and docs for tap controls

Plan: 2026-11-03-difficulty-controls-and-monsters
Phase: P01-controls-difficulty-and-monsters
Task: T02-guide-tutorial-reload-and-docs-sync

- Update GunGripPad guide text to tap fire and double tap fever
- Revise TutorialGuideOverlay steps 1-3 guidance to match tap controls
- Synchronize docs for tutorial shooting range and monster encyclopedia
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
