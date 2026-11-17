# Task: T01 Store and WS Weapon Ranking

## Status: done

## Goal
개인 랭킹(종합 및 `shotgun`·`revolver`·`gatling` 무기별)과 팀 랭킹을 플레이어/팀당 최고 기록 기준 10위까지 조회하여 WebSocket 랭킹 페이로드로 전달한다.

## Decision Summary
- D03: 개인 랭킹은 플레이어별 최고 기록 1개씩만 표시 (`ROW_NUMBER() OVER (PARTITION BY gp.player_id ORDER BY g.total_score DESC, g.ended_at ASC)`).
- D04: 팀 랭킹 기본 limit을 5에서 10으로 확장.
- D05: `ServerToClientMessage`의 `ROOM_CREATED`, `AUTH_RESULT`, `RANKING_UPDATED`에 `weaponRankings?: WeaponRankingsMap`을 추가해 한 번에 전달.

## Implementation

### I01. 공유 타입 확장 (`WeaponRankingFilter`, `WeaponRankingsMap`, `ServerToClientMessage`)

- Related Files:
  - `src/shared/types.ts` :: `WeaponRankingFilter`, `WeaponRankingsMap`, `ServerToClientMessage` — 무기별 랭킹 타입 및 WS 메시지 필드 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type WeaponRankingFilter = 'all' | WeaponKind;
  export type WeaponRankingsMap = Record<WeaponKind, RunRankingEntry[]>;
  ```
- **Execution Flow / Logic**:
  1. `RunRankingEntry` 아래에 `WeaponRankingFilter`, `WeaponRankingsMap` 타입을 export로 추가한다.
  2. `ServerToClientMessage` 유니온의 `ROOM_CREATED`, `AUTH_RESULT`, `RANKING_UPDATED` 변형에 `weaponRankings?: WeaponRankingsMap` 필드를 추가한다. (`rankings`는 종합 Top 10으로 유지하여 기존 클라이언트/테스트와 호환)

### I02. `PlayRecordStore` 플레이어별 Top 10 / 무기별 Top 10 / 팀 Top 10 쿼리 구현

- Related Files:
  - `server/PlayRecordStore.ts` :: `PlayRecordStore.getTopRuns`, `PlayRecordStore.getTopRunsByWeapon`, `PlayRecordStore.getTopTeams` — 플레이어별 최고 기록 파티셔닝 및 Top 10 조회; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public getTopRuns(limit = 10, weaponKind?: WeaponKind): RunRankingEntry[]
  public getTopRunsByWeapon(limit = 10): WeaponRankingsMap
  public getTopTeams(limit = 10): TeamRankingEntry[]
  ```
- **Execution Flow / Logic**:
  1. `getTopRuns(limit = 10, weaponKind?: WeaponKind)`:
     - `WHERE g.mode = 'solo' AND g.status = 'finished' AND g.ruleset_version = @rv AND gp.submitted_at IS NOT NULL` 조건에, `weaponKind`가 전달된 경우 `AND gp.weapon_kind = @weaponKind`를 추가한다.
     - `WITH ranked AS (SELECT gp.player_id, p.nickname, g.total_score, g.wave_reached, g.outcome, gp.weapon_kind, g.ended_at, gp.input_kind, ROW_NUMBER() OVER (PARTITION BY gp.player_id ORDER BY g.total_score DESC, g.ended_at ASC) AS rn FROM ...)` CTE를 사용해 `WHERE rn = 1`로 플레이어별 최고 기록 1건만 추출한 뒤 `ORDER BY total_score DESC, ended_at ASC LIMIT @limit`로 정렬한다.
  2. `getTopRunsByWeapon(limit = 10)`:
     - `WEAPONS` (`['shotgun', 'revolver', 'gatling']`)를 순회하며 `{ shotgun: this.getTopRuns(limit, 'shotgun'), revolver: this.getTopRuns(limit, 'revolver'), gatling: this.getTopRuns(limit, 'gatling') }`를 반환한다.
  3. `getTopTeams(limit = 10)`:
     - 기본 파라미터 값을 `5`에서 `10`으로 변경한다.

### I03. `wsServer.ts` 랭킹 페이로드 생성 헬퍼화 및 Top 10 + 무기별 랭킹 전송

- Related Files:
  - `server/wsServer.ts` :: `CREATE_ROOM`, `DEVICE_CHECK`, `REGISTER_NICKNAME`, `GAME_SCORE_SUBMIT` 핸들러 — 중복 호출을 헬퍼로 묶어 `rankings`, `weaponRankings`, `teamRankings` 전송; modify

#### Details
- **Signatures & Types**:
  ```typescript
  const buildRankingSnapshot = () => ({
    rankings: playRecordStore.getTopRuns(10),
    weaponRankings: playRecordStore.getTopRunsByWeapon(10),
    teamRankings: playRecordStore.getTopTeams(10),
  });
  ```
- **Execution Flow / Logic**:
  1. `playRecordStore`가 주입된 `createWsServer` 스코프 내에 `buildRankingSnapshot` 헬퍼를 둔다.
  2. `CREATE_ROOM` (`ROOM_CREATED`), `DEVICE_CHECK` (`AUTH_RESULT` 2곳), `REGISTER_NICKNAME` (`AUTH_RESULT`), `GAME_SCORE_SUBMIT` (`RANKING_UPDATED`) 4개 핸들러에서 `...buildRankingSnapshot()`을 스프레드하여 일관되게 전송한다.

### I04. 백엔드 및 WebSocket 단위 테스트 갱신/추가

- Related Files:
  - `tests/play-records.test.ts` :: `getTopRuns` 테스트 블록 — 플레이어별 최고 기록 1건 유지, limit 10, `getTopRunsByWeapon` 검증; modify
  - `tests/team-rankings.test.ts` :: WebSocket 응답 및 `getTopTeams(10)` 테스트 — `weaponRankings` 포함 여부 및 10위 제한 검증; modify

#### Details
- `tests/play-records.test.ts`:
  - 기존 `'limits to 5 and lets the same player repeat'` 테스트를 새 스펙에 맞게 `'limits to 10 and keeps only the best score per player'`로 변경: 동일 플레이어가 여러 번 플레이하면 최고 점수 1개만 남는지, 12명의 서로 다른 플레이어가 있을 때 상위 10명만 반환되는지 검증.
  - `getTopRunsByWeapon` 테스트 추가: 같은 플레이어가 `shotgun`과 `revolver`로 각각 플레이한 경우 종합에는 최고 1개만, 각 무기별 목록에는 해당 무기로 세운 최고 기록이 각각 포함되는지 검증.
- `tests/team-rankings.test.ts`:
  - `ROOM_CREATED` 응답에 `weaponRankings`가 포함되고 `shotgun`, `revolver`, `gatling` 배열을 가지는지 검증.

## Acceptance Criteria
- [ ] `PlayRecordStore.getTopRuns(10)`이 플레이어별 최고 기록 1개씩 최대 10개를 점수 내림차순으로 반환한다.
- [ ] `PlayRecordStore.getTopRunsByWeapon(10)`이 3개 무기(`shotgun`, `revolver`, `gatling`)별로 플레이어 최고 기록 최대 10개를 반환한다.
- [ ] `PlayRecordStore.getTopTeams(10)`이 팀별 최고 기록 최대 10개를 반환한다.
- [ ] `wsServer`의 4개 랭킹 응답에 `rankings`, `weaponRankings`, `teamRankings`가 모두 포함된다.
- [ ] 백엔드/랭킹 관련 테스트 및 `npm run build`가 통과한다.

## Validation
- `npx vitest run tests/play-records.test.ts tests/team-rankings.test.ts tests/coop-records.test.ts` — 모든 테스트 통과
- `npm run build` — TypeScript 타입 체크 및 Vite 빌드 통과

## Commit Message
```text
feat(ranking): extend play record store and ws responses to top 10 with weapon breakdowns

Plan: 2026-11-17-lobby-compact-weapon-ranking
Phase: P01-backend-weapon-ranking
Task: T01-store-and-ws-weapon-ranking

- Add WeaponRankingFilter, WeaponRankingsMap types and weaponRankings WS fields
- Partition solo rankings per player best score with limit 10 and add getTopRunsByWeapon
- Extend team rankings default limit to 10 and unify wsServer ranking payload helper
- Update play-records and team-rankings tests for top-10 and weapon breakdown specs
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
