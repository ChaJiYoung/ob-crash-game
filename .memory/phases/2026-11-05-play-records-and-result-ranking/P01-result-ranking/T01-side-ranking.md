# Task: T01 결과와 TOP 5 좌우 배치

## Status: done

## Goal
게임이 끝나면 결과 패널 오른쪽에 TOP 5가 함께 보여, 메인으로 가지 않아도 순위를 확인할 수 있다.

## Decision Summary
- 결정 D05. 데이터와 서버는 그대로이고 `ResultRankingModal` 레이아웃만 바꾼다.

## Implementation

### I01. 레이아웃
- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModal`; modify

#### Details
- 패널 폭 `680px`를 `min(1100px, 94vw)`로 넓히고, 제목과 점수·통계를 왼쪽 칸, "🏆 명예의 전당 TOP 5" 블록을 오른쪽 칸(폭 약 380px)에 둔다: `display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '24px'`.
- 버튼 줄은 격자 아래 전체 폭에 그대로 둔다. `restartButtonRef`, `lobbyButtonRef`, `hoveredAction`은 사격으로 버튼을 고르는 데 쓰이므로 건드리지 않는다.
- 패널에 `maxHeight: '94vh', overflowY: 'auto'`를 넣어 작은 화면에서 버튼이 잘리지 않게 한다.
- 폭이 900px 미만이면 세로로 쌓는다. 인라인 스타일이라 미디어 쿼리가 없으므로 `<style>`에 클래스 `.result-layout`을 정의한다.
- `rankings.length === 0`이면 "아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요!"를 표시한다.
- 함정: 점수 제출은 비동기라 결과 화면이 뜬 직후 목록이 잠깐 이전 값이다. `RANKING_UPDATED`가 오면 prop이 바뀌어 갱신되므로 별도 처리는 하지 않는다.

### I02. 테스트
- Related Files:
  - `tests/result-breakdown.test.ts`; modify

#### Details
- `renderToStaticMarkup`으로 빈 목록이면 안내 문구, 목록이 있으면 닉네임과 점수, `result-layout`, 두 버튼 문구가 나오는지 확인한다.

## Acceptance Criteria
- [x] 1440×900에서 결과, TOP 5, 버튼이 스크롤 없이 함께 보인다.
- [x] 사격으로 버튼을 고르는 동작이 그대로다.

## Validation
- `npx vitest run tests/result-breakdown.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(result): show the top 5 beside the result panel

Plan: 2026-11-05-play-records-and-result-ranking
Phase: P01-result-ranking
Task: T01-side-ranking

- Lay the result and hall of fame out side by side so ranks are visible right away

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
