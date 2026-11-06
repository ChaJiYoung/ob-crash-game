# Task: T03 문서·가이드 문구 동기화

## Status: done

## Goal
게임 안 가이드와 문서가 새 보스 체력, 작은 병 속도, "보스와 일반 몬스터가 함께 나온다"는 흐름을 그대로 설명하고, `docs-sync` 테스트가 이를 고정한다.

## Decision Summary
- 결정 D01~D03, D06, D07. 문서의 숫자는 가능하면 `GAME_TUNING`에서 가져와 테스트로 묶는다(기존 `docs-sync.test.ts` 방식).
- 코드가 바뀐 뒤 문서를 쓰므로 T01·T02 다음에 한다.

## Implementation

### I01. 인게임 가이드
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 보스 항목 `description`(95행)·`tip`(96행), 카스 프레시 병 `description`(88행); modify
  - `src/pc/components/TutorialGuideOverlay.tsx`; read-only (보스 흐름 문구가 있는지 확인만)

#### Details
- 보스 `description`의 "3웨이브는 1대, 5웨이브는 2대, 7웨이브는 2대 + 대왕 냉각기(1.5배 크기)가 등장합니다." 뒤에 "일반 몬스터가 절반쯤 나온 시점에 등장하고, 보스가 살아 있는 동안 일반 몬스터도 계속 나옵니다."를 추가한다. 숫자 50%는 `Math.round(GAME_TUNING.boss.encounterStartRatio * 100)`로 만든다.
- 체력 숫자는 `GAME_TUNING.waves`에서 가져오는 템플릿으로 쓴다(하드코딩 금지).
- 카스 프레시 병 `description`의 "작고 빠른 병 2마리(체력 1)"는 그대로 두고 "속도 3.0m/s"처럼 숫자를 넣으려면 `GAME_TUNING.monsters.bottle.childSpeedMps`를 쓴다.

### I02. README·docs
- Related Files:
  - `README.md` 56~57행; modify
  - `docs/몬스터_도감_설명서.md` 21행(보스 체력 표기 "70~90 (3웨이브 75, 대왕 200)"), 64~68행 보스 표(각 70/90, 대왕 200), 73행; modify
  - `docs/비어 크러셔 요구사항 분석서.md` FR-MON-03(73행); modify
  - `docs/비어 크러셔 상세설계서.md` 보스 소환 절(333행 부근)과 보스 등장 조건 서술; modify
  - `docs/튜토리얼_훈련장_가이드.md` 220행 부근; modify
  - `docs/무기_및_스킬_가이드.md`; 보스 체력·등장 시점을 설명하는 문장이 있으면 modify

#### Details
- 바꿀 내용: 보스 체력(3웨이브 100, 5웨이브 각 120, 7웨이브 각 150 + 대왕 250), 작은 병 속도 3.0, "미니웨이브 후 보스 등장" → "일반 몬스터 절반 소환 후 보스 등장, 이후에도 일반 몬스터 보충".
- 먼저 `grep -rn "미니웨이브\|모두 처치\|70~90\|대왕 200\|각 90\|각 70\|75" README.md docs/*.md`로 남은 옛 표현을 찾고 전부 고친다.
- 문서에 이미 적힌 "중간 보스는 처치하면 카드를 고르고 다음 웨이브로"는 그대로 맞다.
- 중간 카드: `docs/몬스터_도감_설명서.md` 145·147행의 웨이브 표(4웨이브 22킬, 6웨이브 26킬)에 보스 웨이브 카드 목표(3웨이브 24, 5웨이브 40, 7웨이브 44킬)를 추가하고, 보스 웨이브에는 중간 카드가 없다고 적힌 문장이 있으면 고친다. 숫자는 `GAME_TUNING.waves[].cardKillTarget`에서 가져와 `docs-sync`로 묶는다.
- 이미지(`docs/screens/*`)는 다시 찍지 않는다.

### I03. 동기화 테스트
- Related Files:
  - `tests/docs-sync.test.ts` :: 보스 관련 `it`(140~155행 부근); modify

#### Details
- 기존 패턴(`read(file)` + `toContain(...)`)을 따른다. 추가 검증: 몬스터 도감과 상세설계서에 `kingHp`(250)와 `coolerHp` 값이, 요구사항 분석서에 "일반 몬스터" 병행 문구가 있는지. 값은 `GAME_TUNING`에서 계산해 문서 문자열과 비교한다.

## Acceptance Criteria
- [x] 문서·가이드 어디에도 옛 체력(70~90, 대왕 200)과 "모두 처치 후 보스 등장" 표현이 남지 않는다.
- [x] `docs-sync` 테스트가 새 체력과 병행 흐름을 검증한다.

## Validation
- `npx vitest run tests/docs-sync.test.ts tests/pc-hud-and-banner.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
docs(boss): describe new boss HP and the mixed boss fight

Plan: 2026-11-06-boss-hp-and-bottle-speed
Phase: P02-boss-concurrent-spawns
Task: T03-docs-sync

- Sync GuideModal, README and docs with boss HP 100/120/150/250 and bottle speed 3.0
- Describe the boss appearing at half of the wave spawns with regular monsters kept coming
- Pin the new numbers in docs-sync

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
