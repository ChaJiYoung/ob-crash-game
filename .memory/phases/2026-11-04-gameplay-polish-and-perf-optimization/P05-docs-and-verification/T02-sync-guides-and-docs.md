# Task: T02 Sync Guides and Docs

## Status: pending

## Goal
게임 내 안내와 문서가 실제 동작과 다르지 않게 한다. 플레이어가 "빗나가도 부담 없이 난사하세요" 같은 낡은 안내를 보지 않게 하기 위해서다.

## Decision Summary
- D17: README, `docs/`, `GuideModal`, `TutorialGuideOverlay`의 문구를 갱신한다. 수치는 P04-T06 이후의 `GAME_TUNING` 값을 쓴다.
- 코드에서 읽어 표시할 수 있는 값은 문구에 직접 쓰지 않고 상수에서 읽는다.

## Implementation

### I01. 게임 내 안내

- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `:63`, `:305-308`, `:420`, 카드 탭 — 사양 갱신; modify
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `:75`, `:87` — 판정 배율 갱신; modify
  - `tests/tutorial-and-guide.test.ts`, `tests/pc-modals-and-pairing.test.ts` — 문구 검사 갱신; modify

#### Details
- **`GuideModal.tsx`**:
  - `:63` 보스 팁: 3·5·7웨이브 보스전, 부하를 잡아 피버와 아이템을 모으기, 대왕 쉴드, 마지막 보스전을 모두 잡아야 승리.
  - `:305-308`: PERFECT 2.0배, GREAT 1.0배, GOOD 0.5배. MISS 페널티는 없지만 **"호쾌하게 난사"** 문구를 지우고, 빗나가면 탄약과 장전 시간을 낭비한다고 쓴다. 누르고 쏘면 피해가 줄어든다는 설명을 추가한다.
  - 웨이브 수와 무기 설명이 하드코딩되어 있으면 7웨이브 사양으로 고친다.
  - 몬스터 탭(`:41`, `:49` 등): 필굿 지상 돌격, 카스 라이트 회피 비행, 오비 방패병, 한맥 포격, 병맥주 분열로 설명과 팁을 고친다. 한맥의 "피격 시 분노" 문구를 지운다.
- **`TutorialGuideOverlay.tsx`**:
  - `:75`: `정밀 조준 배율(2.0x/1.0x/0.5x)`
  - `:87`: `PERFECT(2.0배)·GREAT(1.0배)`, `GOOD(0.5배)`
- 문구를 `GAME_TUNING.judgment`에서 읽어 만들 수 있으면 그렇게 한다.

### I02. README

- Related Files:
  - `README.md` :: `:5`, `:29-32`, `:38`, `:48`, `:53-55` — 사양 갱신; modify

#### Details
- `:5` "네온 블룸" 표현을 지운다.
- `:29-31` 판정 배율, `:32` MISS 문구(`부담 없이 호쾌하게 난사 가능` 삭제)
- `:38` 카드 9종과 수리 카드 효과
- `:53-55` "Wave 5 보스 레이드" 표현을 3회 보스전으로 고친다. 이미지 파일명은 유지한다.

### I03. docs

- Related Files:
  - `docs/비어 크러셔 요구사항 분석서.md` :: `:23`, `:34`, `:63`, `:65`, `:71-72`, `:75` — 요구사항 갱신; modify
  - `docs/비어 크러셔 상세설계서.md` :: `:301`, `:331`, `:367-369`, `:557`, `:564`, `:567` — 설계 갱신; modify
  - `docs/무기_및_스킬_가이드.md` :: `:28`, `:145`, `:152-153`, `:161-164`, `:173` — 무기·카드 갱신; modify
  - `docs/몬스터_도감_설명서.md` :: `:4`, `:94`, `:115`, `:121-135`, `:144` — 웨이브·보스 갱신; modify
  - `docs/튜토리얼_훈련장_가이드.md` :: `:132`, `:137`, `:140` — 배율 갱신; modify
  - `docs/구동화면_쇼케이스.md` :: `:71`, `:103`, `:186-191` — 사양 갱신; modify

#### Details
- **바꿀 내용**:
  | 항목 | 이전 | 최종 |
  | :--- | :--- | :--- |
  | 판정 피해 | 1.5 / 1.0 / 0.8 | 2.0 / 1.0 / 0.5 |
  | 피버 충전 | PERFECT +8, 처치 +12 | PERFECT +2, 처치 +4(`GAME_TUNING` 최종값) |
  | 웨이브 | 5웨이브 | 7웨이브, 3·5·7 보스전 |
  | 보스 | 냉각기 1대, 처치 즉시 승리 | 냉각기 1대 → 2대 → 2대 + 대왕, 마지막 전투 승리. 소환 부하 3종 → 4종 → 5종 |
  | 몬스터 | 비행 2종, 체력 차이 위주 | 필굿 지상 돌격, 카스 라이트 회피 비행, 오비 방패병, 한맥 포격, 병맥주 분열 |
  | 웨이브 구성 | 이전 5웨이브 표 | 결정 문서 D11 표 |
  | 카드 | 5종 | 9종, 무작위 3장, 수리 +2 |
  | 카드 등장 | 10/14/18/20/15킬 | 웨이브 클리어 + 4·6웨이브 중간 카드 |
  | 요격 | INTERCEPTED 배너(FR-GIM-03) | 투사체 폭발과 요격음 |
  | 방어선 | 원목 바 카운터 | 바닥 네온 라인 |
  | 카드 선택 | 0.8초 면역 | 새로 누른 입력만 인정, 0.8초 잠금, 전체 정지 |
  | 연사 | 난사 권장 | 빠른 연사 + 긴 장전, 누른 채 사격 피해 감소 |
  | 무기 표 | 탄창 18~35발 등 | `applyWeaponTuning` 최종값 |
- `docs/비어 크러셔 요구사항 분석서.md`의 FR 번호는 유지하고 내용만 고친다.
- 수치는 `src/shared/gameTuning.ts`와 `WEAPON_ARCHETYPE_SPECS` 값을 확인해 쓴다.
- 스크린샷은 P05-T05에서 다시 찍는다. 이 Task에서는 캡션만 내용에 맞게 조정하고, 파일 이름 변경은 P05-T05에서 한다.

### I04. 누락 검사

#### Details
아래 명령 결과에 낡은 사양이 남아 있지 않은지 확인한다. 과거 기록인 `.memory/`는 대상이 아니다.
```bash
grep -rnE "INTERCEPTED|5웨이브|5단계|1\.5배|0\.8배|1\.5x|0\.8x|바 카운터|호쾌하게 난사|부담 없이" README.md docs/*.md src/pc/components
```
의도적으로 남긴 항목이 있으면 이유를 Task에 적는다.

## Acceptance Criteria
- [ ] 게임 안내와 튜토리얼의 배율이 실제와 같다.
- [ ] 문서가 7웨이브, 보스 3회, 카드 9종 기준이다.
- [ ] 난사를 권장하는 문구가 없다.
- [ ] 누락 검사 결과에 낡은 사양이 없다.

## Validation
- `npx vitest run tests/tutorial-and-guide.test.ts tests/pc-modals-and-pairing.test.ts` — 통과
- 위 `grep` 명령 — 의도한 항목 외 없음
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
docs(game): align guides and documents with the new game rules

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P05-docs-and-verification
Task: T02-sync-guides-and-docs

- Update in-game guide and tutorial text
- Update README and design documents for waves, bosses, cards, and weapons
- Remove outdated spray-and-pray guidance
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
