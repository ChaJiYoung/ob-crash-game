# Decisions: 마우스 더블클릭 피버

- Date: 2026-11-06
- Status: Confirmed

## D01. 마우스 피버 발동을 Space 키에서 더블클릭으로 바꾼다
- **Chosen**: Space 키 발동을 제거하고 더블클릭만 남긴다. (`GameCanvas3D.tsx`의 `handleKeyDown` Space 분기 삭제)
- **Rationale**: 사용자가 "더블클릭만" 선택했다. 폰의 더블탭과 조작이 통일된다.

## D02. 판정 시간은 폰과 같은 `FEVER_DOUBLE_TAP_MS`(300ms)를 쓴다
- **Chosen**: 첫 클릭 시각 대비 300ms 이내의 두 번째 `mousedown`(왼쪽 버튼)이면 `engine.activateFever` 호출. 새 상수를 만들지 않는다.
- **Rationale**: `src/shared/constants.ts`의 `WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS`가 이미 폰 `UnifiedTouchPad`에서 쓰인다. 브라우저 `dblclick` 이벤트는 OS 설정 시간이라 불규칙하므로 쓰지 않는다. (코드로 확정)

## D03. 클릭의 발사 동작은 그대로 둔다
- **Chosen**: 첫·둘째 클릭 모두 평소처럼 발사(`press`)되고, 피버가 준비되지 않았으면 일반 연속 클릭으로만 동작한다. 판정 후 기준 시각을 비워 3연타가 두 번 발동하지 않게 한다.
- **Rationale**: 폰도 "첫 탭 즉시 발사 + 300ms 내 두 번째 탭에 피버"이고 지연 없는 반응성이 우선이다. (2026-11-03 컨트롤러 결정 D03과 동일)

## D04. 안내 문구·문서를 함께 바꾼다
- **Chosen**: `Space` 안내를 "더블클릭"으로 교체한다. 대상: `ArcadeOverlayHUD.tsx:129`, `TutorialGuideOverlay.tsx`(109, 275행), `GuideModal.tsx:654`, `docs/튜토리얼_훈련장_가이드.md`, `docs/비어 크러셔 요구사항 분석서.md`(87행). 튜토리얼 3단계 피버 발동(`spawnTutorialStep3Enemies`)은 그대로 동작해야 한다.
- **Rationale**: 키가 사라졌는데 안내가 남으면 플레이어가 막힌다. `tests/docs-sync.test.ts`와 튜토리얼 테스트가 문구를 검사할 수 있어 같이 갱신한다. (자동 확정)

## D05. 테스트
- **Chosen**: 더블클릭 판정을 순수 함수로 분리해 단위 테스트(300ms 안/밖, 3연타, 준비 안 됨)하고, 소스 검사로 Space 분기 제거를 확인한다.
- **Rationale**: `GameCanvas3D`는 three.js에 묶여 직접 테스트하기 어려워, 이 프로젝트가 쓰는 "순수 함수 + 소스 검사" 패턴을 따른다. (자동 확정)
