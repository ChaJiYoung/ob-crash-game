# Task: T01 샷건 균형 봇 측정·튜닝

## Status: pending

## Goal
P01·P02로 바뀐 샷건이 "게틀링보다 강하고 리볼버보다 약한" 서열에 들어오는지 봇 80판으로 측정하고, 안 맞으면 D08 규칙대로 수치를 조정해 최종값을 확정·기록한다(D08).

## Decision Summary
- 측정 도구는 기존 `.memory/references/scripts/boss-strategy-compare.ts`의 `minions-first`(정석 전략) 클리어율이다. `weapon-balance` 결정의 63/68/70%(샷건/게틀링/리볼버)도 이 방식이다.
- **같은 세션에서 세 무기를 모두 다시 측정**한다. 이전 측정(2026-11-07) 이후 다른 변경이 있었고 80판 오차가 ±5%p라서, 서열 판단은 이번 측정의 게틀링 G·리볼버 R로 한다.
- 합격선: **G − 3 ≤ S ≤ R + 3**(S = 샷건). 오차 범위(±5%p) 안에서 서열이 뒤집히지 않았다는 뜻이다. 이상적으로는 G < S < R.
- 조정은 **추가 명중 비율 세트를 한 단계씩**, 그래도 안 되면 폭발 피해·반경 순으로 바꾼다. 최대 3회 반복 후에도 합격선 밖이면 값을 더 만지지 말고 사용자에게 결과를 보고하고 결정을 받는다.

## Implementation

### I01. 기준선 측정
- Related Files:
  - `.memory/references/scripts/boss-strategy-compare.ts` — read-only (수정 금지)
  - `.memory/references/playtest-2026-11-09-shotgun-spread-and-plunger.md` :: 측정 기록 — new
#### Details
- 실행(프로젝트 루트에서, 각각 시간이 오래 걸리므로 `run_in_background`로 실행하고 출력을 스크래치패드의 파일로 저장):
  ```bash
  npx tsx .memory/references/scripts/boss-strategy-compare.ts 80 shotgun minions-first
  npx tsx .memory/references/scripts/boss-strategy-compare.ts 80 revolver minions-first
  npx tsx .memory/references/scripts/boss-strategy-compare.ts 80 gatling minions-first
  ```
  출력 한 줄 예: `shotgun minions-first 클리어 63% | 보스전 체력손실 … | 점수 …`. 클리어 % 세 개(S, R, G)와 보스전 시간·점수를 기록 문서에 표로 옮긴다.
- 현재 시작값(D05~D07)은 `shotgunSpread` 마릿수 2/2/3/3, 비율 B세트 10/15/20/25%, 반경 0.30, 폭발 0.7/0.8/0.9/1.0, 스케일 1.0이다.
- **함정**: 봇은 `e.startGame({ withWeaponSelect: false })`로 `selectWeapon(kind, 1)`부터 시작한다. 스킬 스톡이 0이므로 첫 스킬은 쿨다운 뒤에 나온다(정상). 샷건 봇이 새 스킬을 어떻게 쓰는지(`triggerWeaponSkill` 호출 조건)는 스크립트 안을 읽고 확인하되, 스크립트 자체는 고치지 않는다.

### I02. 조정 루프 (D08)
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.shotgunSpread`, `GAME_TUNING.skills.plunger.blastDamageByLevel` — modify (필요 시)
#### Details
- 판정과 조정 순서:
  | 상황 | 조치 |
  | :--- | :--- |
  | G − 3 ≤ S ≤ R + 3 | 통과. I03으로. |
  | S < G − 3 | 추가 명중 비율을 B(10/15/20/25) → C(15/20/25/30)로. 그래도 부족하면 폭발 피해 +0.1씩(0.8/0.9/1.0/1.1). 그래도 부족하면 반경 0.30 → 0.36. |
  | S > R + 3 | 비율을 B → A(5/10/15/20)로. 그래도 높으면 반경 0.30 → 0.24. 그래도 높으면 폭발 피해 −0.1씩(0.6/0.7/0.8/0.9). |
- 한 번에 **한 가지**만 바꿔 80판을 다시 돌린다(원인 추적). 빠른 사전 실험은 `TUNE` 환경변수로 `shotgunSpread`를 덮어쓸 수 있다(예: `TUNE='{"shotgunSpread":{"damageRatioByLevel":{"1":0.15,"2":0.2,"3":0.25,"4":0.3}}}'`) — `.memory/references/scripts/README.md`의 `simulate-current-decisions.ts` 설명을 따르되, `boss-strategy-compare.ts`가 `TUNE`을 읽는지 먼저 확인한다(읽지 않으면 `gameTuning.ts`를 직접 고치고 되돌릴 수 있게 한다). **무기 표에 import 시점에 계산되어 들어가는 값(`skills.plunger`의 기절·피해·마릿수, `weaponDamageScale`)은 `TUNE`으로 바뀌지 않는다** — `gameTuning.ts`를 직접 고친다.
- 반복은 최대 3회. 3회 후에도 합격선 밖이면 중단하고 측정표와 함께 사용자에게 보고한다.

### I03. 최종값 고정과 기록
- Related Files:
  - `src/shared/gameTuning.ts` — modify (최종값)
  - `tests/shotgun-spread.test.ts`, `tests/shotgun-plunger-skill.test.ts` :: 고정 값 기대 — modify (값이 바뀐 경우)
  - `docs/무기_및_스킬_가이드.md` :: 샷건 퍼짐·스킬 수치 — modify (값이 바뀐 경우)
  - `.memory/references/playtest-2026-11-09-shotgun-spread-and-plunger.md` — modify (최종 표)
  - `.memory/decisions/2026-11-09-playtest-feedback-guide-lobby-shotgun.md` :: 끝에 `## D20. 측정 결과와 최종 값` 소절 — modify
#### Details
- 기록 문서에 ① 측정 환경(커밋 해시, 판 수 80, 전략 minions-first), ② 반복별 값 세트와 S/G/R 표, ③ 최종 선택과 이유를 적는다.
- 결정 문서 D20에는 최종 마릿수·비율·반경·폭발 피해와 최종 S/G/R(클리어 %)을 적는다(값이 시작값 그대로면 "시작값 유지"라고 쓴다).
- 값이 바뀌었다면 위 테스트의 고정 기대값과 가이드 문서 표를 함께 고친다(`docs-sync`가 문서와 `WEAPON_ARCHETYPE_SPECS`를 비교하므로 전체 테스트로 확인).

## Acceptance Criteria
- [ ] 세 무기의 80판 클리어율이 기록 문서에 표로 남아 있다.
- [ ] 최종 샷건 클리어율 S가 `G − 3 ≤ S ≤ R + 3`을 만족한다(또는 3회 후에도 못 맞춘 경우 보고되고 사용자 결정을 기다린다).
- [ ] 최종 값이 `gameTuning.ts`, 테스트, 가이드 문서, 결정 문서 D20에 일치한다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx tsx .memory/references/scripts/boss-strategy-compare.ts 80 shotgun minions-first` — 최종 값에서 S가 합격선 안(기록)
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
chore(balance): 샷건 퍼짐·스킬 수치를 봇 80판 측정으로 확정

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P03-balance-measure
Task: T01-bot-measure-and-tune

- I01 세 무기 기준선 측정과 기록 문서
- I02 D08 규칙에 따른 조정(값 세트별 S/G/R)
- I03 최종값 고정, 테스트·가이드·결정 문서(D20) 동기화
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
