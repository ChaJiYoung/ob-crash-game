# Task: T04 팀 랭킹 Top5

## Status: done

## Goal
서버가 `data/play-records.jsonl`의 2인팟 기록으로 팀 랭킹 Top5를 만들고, 로비(`ROOM_CREATED`)와 점수 제출 응답(`RANKING_UPDATED`), 폰 인증 응답(`AUTH_RESULT`)에 `teamRankings`로 함께 보낸다(D22). 같은 두 사람 조합은 최고 팀 합계 한 줄만 올린다. 솔로 Top5(`rankings`)는 그대로다.

## Decision Summary
- 팀 키: 두 deviceId를 정렬해 `a|b`로 묶는다(1P/2P 자리가 바뀌어도 같은 팀).
- 한 판은 기록이 두 줄(1P·2P 각자 제출)이라, 같은 팀 키의 최고 `coop.teamScore`만 쓰면 중복이 자연히 사라진다.
- 현재 규칙 버전(`rulesetVersion === RANKING_RULESET_VERSION`) 기록만 쓴다(솔로 보드와 같은 규칙). 파트너 정보가 빈 기록(`partnerDeviceId === ''`)은 제외.

## Implementation

### I01. 타입

- Related Files:
  - `src/shared/types.ts` :: `TeamRankingEntry`, `ROOM_CREATED`, `AUTH_RESULT`, `RANKING_UPDATED`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface TeamRankingEntry {
    teamKey: string;               // 정렬한 deviceId 두 개를 '|'로
    members: [{ deviceId: string; nickname: string }, { deviceId: string; nickname: string }]; // 그 최고 판의 1P, 2P 순서
    teamScore: number;
    waveReached: number;
    playedAt: string;
  }
  // 세 메시지에 선택 필드로 추가(옛 클라이언트 호환)
  teamRankings?: TeamRankingEntry[];
  ```

### I02. 저장소

- Related Files:
  - `server/PlayRecordStore.ts` :: `PlayRecordStore.topTeams`(new private), `addToTeamTop`(new), `getTopTeams`(new), `loadTopRuns`, `append`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public getTopTeams(limit = 5): TeamRankingEntry[]; // 깊은 복사로 반환
  private addToTeamTop(record: { deviceId: string; nickname: string; playedAt: string; stats: PlayRunStats }): void;
  ```
- **Execution Flow / Logic** (`addToTeamTop`):
  1. `stats.mode !== 'coop'` 또는 `!stats.coop?.partnerDeviceId`면 return.
  2. `me = { deviceId, nickname }`, `partner = { deviceId: coop.partnerDeviceId, nickname: coop.partnerNickname }`, `members = coop.slot === 1 ? [me, partner] : [partner, me]`, `teamKey = [me.deviceId, partner.deviceId].sort().join('|')`.
  3. 내부 `Map<string, TeamRankingEntry>`에서 같은 키가 없거나 `teamScore`가 더 크면 교체(같으면 먼저 세운 기록 유지).
  4. `getTopTeams`: 맵 값을 `teamScore` 내림차순, 같으면 `playedAt` 오름차순 정렬 후 `limit`개.
  - `loadTopRuns`: coop 줄을 건너뛰기 전에(P03-T03 규칙) 같은 버전이면 `addToTeamTop` 호출. `append`: coop이고 같은 버전이면 파일 쓰기 성공 후 `addToTeamTop`.

### I03. wsServer

- Related Files:
  - `server/wsServer.ts` :: `CREATE_ROOM`, `DEVICE_CHECK`, `REGISTER_NICKNAME`, `GAME_SCORE_SUBMIT`; modify

#### Details
- `rankings`를 넣는 모든 응답에 `teamRankings: playRecordStore.getTopTeams(5)`를 함께 넣는다(`grep -n "getTopRuns" server/wsServer.ts`로 위치 확인).

### I04. 테스트

- Related Files:
  - `tests/team-rankings.test.ts`; new

#### Details
- A(1P)·B(2P) 한 판(두 줄, teamScore 500) → 팀 1줄, members 순서 A,B.
- 같은 두 사람이 자리를 바꿔 700 → 여전히 1줄, 700, members B,A.
- 다른 팀 C·D 600 → 2줄, 700·600 순.
- 새 인스턴스로 파일을 다시 읽어도 같은 결과. 다른 규칙 버전 줄, `partnerDeviceId: ''` 줄은 무시.
- 솔로 `getTopRuns()`는 변하지 않음.
- 소켓: `ROOM_CREATED.teamRankings` 존재.

## Acceptance Criteria
- [x] 같은 조합은 한 줄, 최고 팀 합계로 Top5가 만들어진다.
- [x] 서버 재시작 후에도 팀 랭킹이 복원된다.

## Validation
- `npx vitest run tests/team-rankings.test.ts tests/coop-records.test.ts tests/play-records.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(server): team ranking board built from coop records

Plan: 2026-11-07-two-player-coop
Phase: P03-server-protocol
Task: T04-team-rankings

- PlayRecordStore keeps the best team total per player pair and restores it on start
- ROOM_CREATED, AUTH_RESULT and RANKING_UPDATED carry teamRankings next to the solo Top 5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
