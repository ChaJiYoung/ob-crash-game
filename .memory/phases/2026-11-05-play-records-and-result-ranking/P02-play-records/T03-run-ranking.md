# Task: T03 판별 TOP 5와 콤보·처치 표시

## Status: done

## Goal
결과 화면과 로비 보드가 같은 사람을 포함한 판별 상위 5개를 닉네임, 점수, 스테이지, 무기와 함께 보여 주고, 결과 화면에 처치 수와 최대 콤보가 따로 나온다.

## Decision Summary
- 결정 D06, D07. T02의 기록 저장을 전제로 한다. `players.json` 최고 점수와 `isNewRecord`는 그대로 둔다.

## Implementation

### I01. 서버
- Related Files:
  - `src/shared/types.ts` :: `RunRankingEntry`, `ROOM_CREATED`, `AUTH_RESULT`, `RANKING_UPDATED`; modify
  - `server/PlayRecordStore.ts` :: `getTopRuns`, 시작 시 읽기; modify
  - `server/wsServer.ts` :: `getTopRankings`를 쓰는 4곳(약 83, 112, 163, 308행); modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface RunRankingEntry {
    deviceId: string;
    nickname: string;
    score: number;
    waveReached: number;
    weaponKind: WeaponKind;
    playedAt: string;
  }
  public getTopRuns(limit = 5): RunRankingEntry[];
  // constructor(filePath?: string, rulesetVersion = RANKING_RULESET_VERSION)
  ```
- 메시지의 `rankings` 타입을 `RunRankingEntry[]`로 바꾼다. 필드 이름을 유지해 수신 코드 변경을 줄인다.
- 시작 때 파일을 줄별로 읽어 `rulesetVersion`이 현재와 같은 기록만 후보로 삼는다. 깨진 줄은 건너뛴다(한 줄 실패로 서버가 멈추면 안 된다). `append` 성공 시 후보를 갱신해 점수 내림차순, 같으면 `playedAt` 오름차순으로 상위 5개를 유지한다.
- `score`는 `stats.totalScore`가 아니라 서버가 받은 제출 `score`로 쓴다. 둘이 다르면 그 기록을 건너뛰고 경고한다. 랭킹이 저장되는 값과 다른 숫자를 보이지 않게 하기 위해서다.
- 닉네임을 바꾸면 이전 판의 이름은 당시 이름으로 남는다.
- 함정: `append`가 실패하면(파일 쓰기 오류) 메모리 후보에도 넣지 않는다. 재시작 뒤 사라질 기록이 보드에 보이면 안 된다.

### I02. 화면
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `topRankings`; modify
  - `src/pc/components/ResultRankingModal.tsx` :: `rankings` 목록, 통계 칸, `stats` prop; modify
  - `src/pc/components/QRPairingModal.tsx` :: 약 232행 목록; modify

#### Details
- 한 줄: `#순위 닉네임 (나)` / `W{waveReached} · {무기 이름}` / `{score}점`. 무기 이름은 샷건, 리볼버, 개틀링으로 표시한다. 칸이 좁으면 로비 보드의 닉네임을 말줄임한다.
- React `key`는 `deviceId`면 중복되므로 `${deviceId}-${playedAt}`로 바꾼다. 같은 사람이 여러 줄 나오는 이번 변경의 필수 사항이다.
- 내 기록 강조: 지금처럼 `deviceId`가 같으면 강조하되, 같은 사람의 모든 줄이 강조된다.
- 결과 화면: `kills={engine.getPlayRunStats()?.kills ?? 0}` prop을 추가해 '누적 격파 (KILL)'에 표시하고, '최대 콤보' 칸에 `maxCombo`를 표시한다. 통계 칸이 3개에서 4개가 되니 2×2 격자로 둔다.
- 제목은 "명예의 전당 TOP 5"를 유지한다.

### I03. 테스트
- Related Files:
  - `tests/play-records.test.ts`, `tests/server-session.test.ts`, `tests/result-breakdown.test.ts`, `tests/pc-modals-and-pairing.test.ts`; modify

#### Details
- 같은 기기의 3판이 모두 순위에 나온다. 6판이면 상위 5개, 동점 순서, 재시작 뒤 복원, 깨진 줄 무시, 이전 규칙 버전 제외, 쓰기 실패 시 미포함, 점수 불일치 건너뜀. 소켓 응답 `rankings` 형식. 두 화면에 스테이지와 무기가 표시되고, 처치 수와 최대 콤보가 다른 값으로 나온다.

## Acceptance Criteria
- [x] 같은 사람이 여러 번 TOP 5에 오를 수 있고 두 화면이 같은 내용을 보여 준다.
- [x] 결과 화면의 처치 수와 최대 콤보가 맞다.
- [x] 서버를 재시작해도 랭킹이 유지된다.

## Validation
- `npx vitest run tests/play-records.test.ts tests/server-session.test.ts tests/result-breakdown.test.ts tests/pc-modals-and-pairing.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(ranking): rank individual runs and show stage, weapon, kills and max combo

Plan: 2026-11-05-play-records-and-result-ranking
Phase: P02-play-records
Task: T03-run-ranking

- Build the top 5 from play records so a player can appear more than once
- Show kills and max combo as separate result values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
