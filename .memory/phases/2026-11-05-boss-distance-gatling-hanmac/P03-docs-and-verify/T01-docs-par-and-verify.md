# Task: T01 기준 시간, 문서, 스크린샷, 검증

## Status: done

## Goal
웨이브 기준 시간과 문서가 새 규칙과 맞고 자동 검증을 통과한다.

## Decision Summary
- 결정 D05. 랭킹 규칙 버전은 올리지 않는다. 플레이 판정은 사용자 몫이다.

## Implementation
### I01. 측정
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30`으로 `waves[i].parTimeSec` 갱신, `simulate-current-decisions.ts`로 합산 클리어율 기록.
### I02. 문서
- Related Files: `src/pc/components/GuideModal.tsx`, `README.md`, `docs/몬스터_도감_설명서.md`, `docs/구동화면_쇼케이스.md`, `docs/무기_및_스킬_가이드.md`, `docs/비어 크러셔 요구사항 분석서.md`, `docs/비어 크러셔 상세설계서.md`, `tests/docs-sync.test.ts`; modify
- 한맥 포격 설명을 폭탄 캔으로, "한맥과 보스의 똥"을 보스 똥으로, 보스 10m를 14m로, 낙하 6~14m를 10~18m로, 개틀링 탄창을 30~50발로 고친다. 옛 표현을 FORBIDDEN에 추가한다.
### I03. 스크린샷
- `scripts/capture-boss-and-shell.mjs` 재실행.

## Acceptance Criteria
- [x] 문서에 옛 규칙이 없고 전체 검증이 통과한다.

## Validation
- `npm test && npx tsc --noEmit && npm run build`, `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs` — 통과

## Commit Message
```text
docs(game): sync par times and docs with the new distances and hanmac bomb

Plan: 2026-11-05-boss-distance-gatling-hanmac
Phase: P03-docs-and-verify
Task: T01-docs-par-and-verify

- Re-measure wave par times and record combined bot results
- Describe the hanmac blast, boss-only shells and new distances

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
