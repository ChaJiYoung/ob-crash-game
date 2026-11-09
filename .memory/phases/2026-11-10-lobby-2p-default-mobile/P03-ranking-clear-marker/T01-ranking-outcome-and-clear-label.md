# Task: T01 랭킹 outcome 노출 + 클리어 글자 표시

## Status: done

## Goal
로비와 결과 화면의 랭킹(솔로·팀)에서, 최종 웨이브를 깨 클리어한 기록은 `W7` 대신 금색 "CLEAR"로, 7웨이브에서 죽은 기록은 지금처럼 회색 `W7`로 보인다.

## Decision Summary
- D09: 아이콘 없이 글자 "CLEAR"만, 금색(`#fbbf24`). `outcome`이 없으면 사망으로 취급(`W{n}` 회색).
- D10: DB에 이미 `games.outcome`('GAMEOVER'|'VICTORY')이 저장됨 → 조회 SELECT와 타입에 노출만 추가. 마이그레이션 없음, 옛 기록에도 적용.
- 서버(타입·쿼리)와 클라이언트(렌더)를 한 Task로 묶는다: 타입에 필수 필드를 넣으면 양쪽이 같이 컴파일돼야 하기 때문.

## Implementation

### I01. 타입 + 조회 쿼리

- Related Files:
  - `src/shared/types.ts` :: `RunRankingEntry`, `TeamRankingEntry`, `PlayRunStats.outcome` — modify
  - `server/PlayRecordStore.ts` :: `RunRow`, `TeamGameRow`, `getTopRuns`, `getTopTeams` — modify

#### Details
- **Signatures & Types**:
  ```typescript
  // types.ts
  export type RunOutcome = 'GAMEOVER' | 'VICTORY';          // PlayRunStats.outcome도 이 타입으로
  export interface RunRankingEntry { /* 기존 */ outcome?: RunOutcome; }
  export interface TeamRankingEntry { /* 기존 */ outcome?: RunOutcome; }
  // PlayRecordStore.ts
  interface RunRow { /* 기존 */ outcome: RunOutcome | null; }
  interface TeamGameRow { /* 기존 */ outcome: RunOutcome | null; }
  ```
- **Execution Flow / Logic**:
  1. `getTopRuns` SELECT에 `g.outcome`을 추가하고 결과 객체에 `...(r.outcome ? { outcome: r.outcome } : {})`(기존 `inputKind` 패턴과 동일).
  2. `getTopTeams`: `WITH ranked` 안 SELECT에 `g.outcome`, 바깥 `SELECT id, team_key, total_score, wave_reached, outcome, ended_at`. `rn = 1`(팀 최고점 판)의 outcome이다. `out.push`에 `...(g.outcome ? { outcome: g.outcome } : {})`.
  3. `outcome`은 **optional**로 둔다: 구버전 클라이언트/저장 데이터 호환, 기존 테스트 픽스처(`ranking-tabs.test.tsx`의 항목 리터럴)가 깨지지 않는다.
  4. **함정**: `PlayRunStats.outcome`의 인라인 유니온을 `RunOutcome`으로 바꿀 때 `server/PlayRecordStore.ts:49`의 검증(`s.outcome !== 'GAMEOVER' && ... 'VICTORY'`)은 그대로 둔다(런타임 검증이라 타입과 별개).

### I02. RankingTabs 렌더

- Related Files:
  - `src/pc/components/RankingTabs.tsx` :: 솔로 항목(약 215행), 팀 항목(약 313행) — modify
  - `src/shared/constants.ts` :: `TOTAL_WAVES`(7) — read-only(필요 시 참고)

#### Details
- 같은 모양 두 곳을 작은 컴포넌트/함수 하나로 합친다: `const WaveLabel = ({ waveReached, outcome }) => outcome === 'VICTORY' ? <div style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 800 }}>CLEAR</div> : <div style={{ fontSize: '10px', color: '#64748b' }}>W{waveReached}</div>`. 두 `W{entry.waveReached}` div를 `<WaveLabel waveReached={entry.waveReached} outcome={entry.outcome} />`로 교체. 이모지·아이콘 없음.
- `data-testid`: `ranking-wave-clear` / `ranking-wave-dead`(테스트용).

### I03. 테스트

- Related Files:
  - `tests/team-rankings.test.ts`, `tests/play-records.test.ts`(또는 `coop-records.test.ts`) — modify(케이스 추가)
  - `tests/helpers/dbFixtures.ts` :: `coopStats`, `playCoop` — read-only(outcome 인자를 받는지 확인; 없으면 옵션 추가)
  - `tests/ranking-tabs.test.tsx` — modify(케이스 추가)

#### Details
- 서버: 솔로 VICTORY 1판 + 솔로 GAMEOVER(waveReached 7) 1판을 저장 → `getTopRuns()`가 각각 `outcome: 'VICTORY'`/`'GAMEOVER'`를 돌려준다. 팀: 같은 팀의 낮은 점수 VICTORY와 높은 점수 GAMEOVER → 최고점 판(GAMEOVER)의 outcome이 나온다(함정 확인).
- 화면: `outcome:'VICTORY'` 솔로·팀 항목 렌더에 `CLEAR`가 있고 해당 항목에 `W7` 텍스트가 없다. `outcome:'GAMEOVER'`와 outcome 없는 항목은 `W7`이 있고 `CLEAR`가 없다.

## Acceptance Criteria
- [ ] 클리어 기록은 "CLEAR"(금색), 사망·옛 기록은 `W{n}`(회색)로 솔로·팀 모두 구분된다
- [ ] `getTopRuns`/`getTopTeams`가 outcome을 돌려준다(팀은 최고점 판 기준)
- [ ] `npm test`, `tsc` 통과

## Validation
- `npx vitest run tests/ranking-tabs.test.tsx tests/team-rankings.test.ts tests/play-records.test.ts tests/coop-records.test.ts` — 통과
- `npm test` · `npx tsc --noEmit` — 통과

## Commit Message
```text
feat(ranking): 클리어 기록을 금색 CLEAR 글자로 구분 표시

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P03-ranking-clear-marker
Task: T01-ranking-outcome-and-clear-label

- RunRankingEntry/TeamRankingEntry에 outcome 추가, 랭킹 조회에서 games.outcome 노출
- RankingTabs 솔로·팀 항목: VICTORY면 CLEAR(금색), 아니면 W{n}(회색)
- 서버·화면 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-ranking-outcome-and-clear-label"
