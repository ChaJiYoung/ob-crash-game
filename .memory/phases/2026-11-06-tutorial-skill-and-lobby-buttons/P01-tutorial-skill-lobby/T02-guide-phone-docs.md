# Task: T02 튜토리얼 안내·폰 스킬·문서

## Status: done

## Goal
튜토리얼 화면이 4단계를 안내하고, 폰 "휙"으로도 튜토리얼에서 스킬이 나가며, 문서가 4단계 구성이다.

## Decision Summary
- 폰 스킬 조건 `gamePhaseRef.current === 'PLAYING'` 을 `TUTORIAL` 도 허용(샌드박스는 이번 범위 밖).

## Implementation

### I01. 안내 오버레이
- Related Files: `src/pc/components/TutorialGuideOverlay.tsx` :: 제목 줄(76~79행), 본문 `step === 3` 블록(107행) — modify
#### Details
- 제목: `step === 3` → `'⚡ STEP 3. 액티브 스킬 (우클릭 / 폰 휙!)'`, `step === 4` → `'🔥 STEP 4. 피버 모드 & 무제한 탄창'`.
- 본문 `step === 3` (신규): `정지한 몬스터 편대 앞에서 <strong>마우스 우클릭</strong> 또는 폰을 위로 <strong>'휙!'</strong> 젖혀 무기 스킬을 발동하세요!` + 보조 문구 `💡 샷건 스킬은 화면의 모든 몬스터를 기절시키고 피해를 줍니다. 한 번만 쓰면 통과!`
- 기존 피버 본문은 `step === 4` 로 이동. 수료 문구에 스킬을 추가(`…홀드 자동 연발, 스킬, 더블탭 피버…`).

### I02. 폰 스킬
- Related Files: `src/pc/PCGamePage.tsx` :: `skillSnapTriggered` 처리(약 490~496행) — modify
#### Details
- `if (gamePhaseRef.current === 'PLAYING' && !isPendingCard && !inGrace)` → `(gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL') && …`.

### I03. 문서
- Related Files: `docs/튜토리얼_훈련장_가이드.md` — Step 3 절을 스킬 단계로 추가하고 피버를 Step 4 로, "3단계 훈련" 문구 → "4단계"; `README.md` 에 튜토리얼 단계 설명이 있으면 맞춤 — modify

### I04. 테스트
- Related Files: `tests/tutorial-and-guide.test.ts` — modify
#### Details
- `renderToStaticMarkup(createElement(TutorialGuideOverlay, …))` 로 step 3 에 `액티브 스킬`·`우클릭`, step 4 에 `피버`·`더블클릭` 포함 검사(props 는 컴포넌트 시그니처 확인 후 채움). 소스 검사: `PCGamePage.tsx` 의 `skillSnapTriggered` 블록에 `'TUTORIAL'` 포함.

## Acceptance Criteria
- [x] 튜토리얼 3단계 안내에 스킬, 4단계에 피버가 보인다
- [x] 폰 스냅 스킬이 튜토리얼에서 처리된다

## Validation
- `npx tsc --noEmit && npx vitest run` — 전체 통과

## Commit Message
```text
feat(tutorial): guide the skill step, allow phone snap skill, update docs

Plan: 2026-11-06-tutorial-skill-and-lobby-buttons
Phase: P01-tutorial-skill-lobby
Task: T02-guide-phone-docs

- add STEP 3 skill guidance and renumber the fever guidance to STEP 4
- let the phone snap trigger the skill in the tutorial
- describe the four-step tutorial in the docs
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
