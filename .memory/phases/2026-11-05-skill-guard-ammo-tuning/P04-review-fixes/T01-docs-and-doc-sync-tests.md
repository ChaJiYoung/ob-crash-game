# Task: T01 틀린·낡은 문서 수정과 문서 동기화 테스트 보강

## Status: done

## Goal
리뷰가 찾은 문서 오류(피버가 방패를 뚫는다는 틀린 설명, 옛 탄수·장전 시간, 없는 R키 재장전)를 고치고, 같은 오류가 다시 생기지 않게 `docs-sync` 테스트가 `GAME_TUNING`에서 기대값을 계산하게 한다.

## Decision Summary
- 코드가 진실이다: 오비 방패는 **액티브 스킬만** 뚫고 피버 사격은 막힌다(`BeerCrusherEngine.shootAt` 주석 "Only skills pierce it", `monster-traits.test.ts`, README 57행).
- `R` 키와 우클릭은 스킬 발동이다(`PCGamePage.tsx` `handleKeyDown`). 수동 재장전은 없다.

## Implementation

### I01. 문서 수정
- Related Files (modify):
  - `docs/몬스터_도감_설명서.md` :: 18, 43, 141행 — "피버·스킬은 방패를 뚫음/뚫습니다" → "액티브 스킬만 방패를 뚫고 피버 사격도 막힙니다"
  - `docs/비어 크러셔 요구사항 분석서.md` :: FR-MON-04 — "피버·스킬 관통" → "스킬 관통"
  - `docs/비어 크러셔 상세설계서.md` :: 344행 — "(피버·스킬은 관통)" → "(스킬만 관통)"
  - `docs/무기_및_스킬_가이드.md` :: 26~28행 개요 표 탄창 — "5 ~ 7발" → "10 ~ 12발"(샷건·리볼버), "13 ~ 25발" → "20 ~ 35발"(개틀링)
  - `docs/튜토리얼_훈련장_가이드.md` :: 63행 — "재장전: `R` 키 누르기 (…)" → "**스킬**: `R` 키 또는 마우스 우클릭 (탄창이 비면 자동 재장전)"; 200행 "무기별 1.0s~1.4s" → "무기별 1.2s~1.7s"
  - `docs/구동화면_쇼케이스.md` :: 51행 "1.0~1.4초" → "1.2~1.7초", 76행 "5~35발" → "10~35발"
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` :: 6번 — 백업 이름 `ruleset-3.bak` → `players.json`에 버전이 없으면 `ruleset-1.bak`(있으면 `ruleset-<이전 버전>.bak`)

### I02. 문서 동기화 테스트
- Related Files (modify): `tests/docs-sync.test.ts`
#### Details
- 무기 가이드 개요 표(26~28행)가 `WEAPON_ARCHETYPE_SPECS`의 레벨 1~4 탄창 최솟값~최댓값(`${min} ~ ${max}발`)과 같다.
- 장전 시간 범위(튜토리얼 가이드 200행, 쇼케이스 51행)가 모든 무기·레벨의 `reloadDurationMs` 최솟값~최댓값(소수 첫째 자리)과 같다: `${min.toFixed(1)}`, `${max.toFixed(1)}`가 해당 줄에 있다.
- README의 쿨타임 문장이 `skillCooldownMsByLevel`을 `/`로 이은 값(`21/19/16/14초`)을 포함한다.
- 몬스터 도감·요구사항·상세설계에 "피버·스킬" 다음에 "관통|뚫"이 오는 문구가 없다.
- 튜토리얼 가이드에 "`R` 키 누르기 (탄창" 같은 R=재장전 문구가 없다.

## Acceptance Criteria
- [ ] 위 문서가 코드와 일치하고 `npm test` 전체 통과
- [ ] 옛 값이 되살아나면 `docs-sync`가 실패한다

## Validation
- `npm test` — 전체 통과
- `grep -rnE "피버·스킬.{0,6}(관통|뚫)" docs README.md` — 결과 없음

## Commit Message
```text
docs(game): fix wrong obi shield and reload docs; derive doc-sync checks from GAME_TUNING

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P04-review-fixes
Task: T01-docs-and-doc-sync-tests

- fever shots do not pierce the obi shield, only skills do
- ammo/reload ranges follow the tuned values
- R is the skill key, there is no manual reload
- docs-sync computes expected ranges from the spec tables
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
