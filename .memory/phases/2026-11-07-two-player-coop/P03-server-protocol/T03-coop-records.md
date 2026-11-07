# Task: T03 2인팟 점수 제출과 기록

## Status: done

## Goal
2인팟 판의 점수 제출(`GAME_SCORE_SUBMIT mode: 'coop'`)을 받으면 서버가 (1) `data/play-records.jsonl`에 `mode: "coop"`과 `coop` 정보를 붙여 저장하고, (2) 솔로 랭킹 Top5에는 올리지 않으며(재시작 후 복원 때도 제외), (3) 그 플레이어 프로필의 `totalGames`를 1 올리고 `bestScore`는 건드리지 않으며, (4) `coopBests[partnerDeviceId]`에 팀 합계 최고를 갱신한다(D05, D18).

## Decision Summary
- PC는 2인팟 판이 끝나면 플레이어마다 한 번씩, 총 두 번 제출한다(P04-T05). 각 제출은 자기 `deviceId`와 자기 `stats`(P01-T06의 `mode`, `coop` 포함)를 가진다.
- `RANKING_RULESET_VERSION`은 올리지 않는다(D05). 단, 규칙 버전이 바뀌어 점수를 초기화할 때(`migrateRuleset`)는 `coopBests`도 비운다(점수 비교 불가).
- 기록 형식이 잘못돼도(`stats` 무효) 2인팟 제출은 솔로 `bestScore`를 절대 바꾸지 않는다 — 그래서 메시지 최상위에 `mode`를 둔다.

## Implementation

### I01. 타입

- Related Files:
  - `src/shared/types.ts` :: `PlayerProfile.coopBests`, `CoopBestEntry`, `GAME_SCORE_SUBMIT`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CoopBestEntry {
    partnerDeviceId: string;
    partnerNickname: string;
    teamScore: number;
    myScore: number;
    partnerScore: number;
    waveReached: number;
    playedAt: string;
  }
  export interface PlayerProfile {
    /* 기존 */
    /** 파트너 기기 ID별 2인팟 팀 합계 최고 기록(D18). 옛 프로필엔 없다. */
    coopBests?: Record<string, CoopBestEntry>;
  }
  // ClientToServerMessage GAME_SCORE_SUBMIT에 추가
  mode?: PlayMode; // 없으면 'solo'
  ```

### I02. 기록 저장소

- Related Files:
  - `server/PlayRecordStore.ts` :: `isValidPlayRunStats`, `pickStats`, `loadTopRuns`, `append`; modify

#### Details
- **Execution Flow / Logic**:
  1. `isValidPlayRunStats`: `s.mode`가 있으면 `'solo' | 'coop'`이어야 함. `s.mode === 'coop'`이면 `s.coop` 필수이고 `slot ∈ {1,2}`, `teamScore/partnerScore`는 `isCount`, `partnerDeviceId/partnerNickname`은 string(최대 64자), `leftEarly`는 boolean. `mode !== 'coop'`인데 `coop`가 있으면 false.
  2. `pickStats`: `mode`가 'coop'이면 `mode: 'coop'`과 `coop`의 6개 필드만 다시 만들어 넣는다. solo면 `mode: 'solo'`만 넣는다. `mode`가 없는 옛 줄은 solo로 읽는다.
  3. `loadTopRuns`: `r.mode === 'coop'` 줄은 건너뛴다.
  4. `append`: `record.stats.mode === 'coop'`이면 `addToTop`을 부르지 않는다.

### I03. 프로필 저장소

- Related Files:
  - `server/PlayerStore.ts` :: `recordCoopResult`(new), `migrateRuleset`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public recordCoopResult(deviceId: string, entry: CoopBestEntry): { profile: PlayerProfile; isNewTeamBest: boolean };
  ```
- **Execution Flow / Logic**:
  1. 프로필이 없으면 `recordGameScore`와 같은 기본 닉네임 규칙으로 만들되 `bestScore: 0`.
  2. `profile.totalGames += 1; profile.lastPlayedAt = now`. `bestScore`는 변경 금지.
  3. `profile.coopBests ??= {}`; 기존 항목이 없거나 `entry.teamScore > 기존.teamScore`면 교체하고 `isNewTeamBest = true`. 같거나 낮으면 `partnerNickname`만 최신으로 갱신.
  4. `save()`.
  5. `migrateRuleset`의 점수 초기화 루프에 `delete profile.coopBests;` 추가.
  - `entry.partnerDeviceId`가 빈 문자열이면(파트너 정보 누락) `coopBests`는 건드리지 않고 `totalGames`만 올린다.

### I04. wsServer

- Related Files:
  - `server/wsServer.ts` :: `case 'GAME_SCORE_SUBMIT'`; modify

#### Details
- **Execution Flow / Logic**:
  1. 기존 검증(필수 값, `rulesetVersion`)은 그대로 먼저.
  2. `const isCoop = msg.mode === 'coop'`.
  3. solo: 기존 로직 그대로.
  4. coop:
     - `stats`가 유효하고 `stats.mode === 'coop'`이고 `stats.totalScore === score`면 `playRecordStore.append({... stats })`(Top5 미반영은 I02가 처리), `playerStore.recordCoopResult(deviceId, { partnerDeviceId: stats.coop.partnerDeviceId, partnerNickname: stats.coop.partnerNickname, teamScore: stats.coop.teamScore, myScore: score, partnerScore: stats.coop.partnerScore, waveReached: stats.waveReached, playedAt: now })`.
     - stats가 무효면 `recordCoopResult(deviceId, { …partnerDeviceId: '' … })`로 판 수만 올리고 경고 로그.
     - 응답 `RANKING_UPDATED`의 `rankings`는 그대로 Top5, `updatedPlayer`는 갱신된 프로필. 브로드캐스트는 P03-T01 규칙.

### I05. 테스트

- Related Files:
  - `tests/coop-records.test.ts`; new
  - `tests/play-records.test.ts`; 수정 없음(회귀 확인)

#### Details
- `PlayRecordStore`(임시 폴더): coop 기록 append → 파일에 `"mode":"coop"` 한 줄, `getTopRuns()` 변화 없음. 새 인스턴스로 다시 읽어도 Top5에 없음.
- `isValidPlayRunStats`: coop인데 `coop` 없음 → false, solo인데 `coop` 있음 → false, slot 3 → false.
- `PlayerStore.recordCoopResult`: `bestScore` 100인 프로필에 팀 300 기록 → `bestScore` 100 유지, `totalGames` +1, `coopBests[p].teamScore === 300`. 다음 판 250 → 300 유지, `isNewTeamBest` false.
- 규칙 버전 마이그레이션 후 `coopBests` 없음.
- 소켓 흐름: PC가 slot1·slot2 플레이어 각각 coop 제출 → 두 프로필 모두 같은 팀 기록, Top5 그대로.

## Acceptance Criteria
- [x] 2인팟 점수가 솔로 랭킹과 `bestScore`에 섞이지 않는다.
- [x] 두 사람 프로필에 파트너별 팀 최고가 남는다.

## Validation
- `npx vitest run tests/coop-records.test.ts tests/play-records.test.ts tests/server-session.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(server): store coop runs apart from the solo board with team bests

Plan: 2026-11-07-two-player-coop
Phase: P03-server-protocol
Task: T03-coop-records

- Coop records are written with mode "coop" and never enter or reload into the Top 5
- recordCoopResult adds a game, leaves the solo best alone and keeps coopBests per partner
- Ruleset resets also clear coopBests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
