# Task: T01 simulate-and-docs

## Status: done

## Goal
수치 변경 뒤 봇 클리어율을 재측정해 기록하고, 수치 변경 정리 문서를 새 값으로 갱신한다.

## Decision Summary
- D08: 클리어율이 크게 낮아지면 보정은 별도 결정으로 받는다(이 Task에서 임의 보정 금지).

## Implementation

### I01. 시뮬레이션 재측정
- Related Files:
  - `.memory/references/scripts/simulate-balance-bundles.ts` — read-only (실행)
  - `.memory/references/scripts/README.md` — 실행법 확인
#### Details
- README의 실행 명령으로 샷건·리볼버·개틀링 클리어율을 측정하고 결과를 `.memory/references/balance-changes-2026-11-10.md`에 표로 기록한다.

### I02. 문서 갱신
- Related Files:
  - `.memory/references/balance-changes-2026-11-10.md` — new (이전/현재 표)
  - `.memory/references/balance-changes-2026-11-09.md` — modify (상단에 "2026-11-10에 샷건 펠릿 피해·리볼버 관통 비율·판정 배율이 다시 바뀜" 링크 한 줄)
  - `.memory/decisions/2026-11-09-playtest-feedback-guide-lobby-shotgun.md` — modify (D23 아래에 "2026-11-10 결정으로 대체" 한 줄)

## Acceptance Criteria
- [ ] 클리어율 3종이 문서에 기록됨
- [ ] D23 대체 표시와 11-09 문서 링크가 있음

## Validation
- `npx vitest run` — 전체 통과 (문서만 바꾸므로 회귀 확인)

## Commit Message
```text
docs(memory): 무기 공격력 서열 재정의 수치 변경·시뮬레이션 결과 기록

Plan: 2026-11-10-weapon-power-order-and-radar
Phase: P03-verify-and-docs
Task: T01-simulate-and-docs

- 클리어율 재측정 결과
- balance-changes-2026-11-10 신규, D23 대체 표시
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
