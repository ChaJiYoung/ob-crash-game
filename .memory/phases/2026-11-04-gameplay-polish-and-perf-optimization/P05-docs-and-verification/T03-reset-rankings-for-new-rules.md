# Task: T03 Reset Rankings for New Rules

## Status: done

## Goal
규칙이 달라진 뒤 이전 점수와 새 점수가 한 랭킹에서 비교되지 않게 한다. 이전 기록은 지우지 않고 백업한다.

## Decision Summary
- 사용자가 계획 포함을 요청했다.
- `data/players.json`의 `bestScore`는 5웨이브 규칙으로 낸 값이다.
- 닉네임과 기기 연결은 유지하고, `bestScore`와 `totalGames`만 초기화한다.
- `data/`는 `.gitignore` 대상이라 git으로 되돌릴 수 없으므로, 초기화 전에 반드시 백업한다.

## Implementation

### I01. 규칙 버전

- Related Files:
  - `src/shared/gameTuning.ts` :: `RANKING_RULESET_VERSION` — 규칙 버전; modify
  - `server/PlayerStore.ts` :: `PlayerStoreData`, `load`, `migrateRuleset` — 버전 이전; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/gameTuning.ts
  export const RANKING_RULESET_VERSION = 2;

  // server/PlayerStore.ts
  export interface PlayerStoreData {
    rulesetVersion?: number; // 없으면 1로 본다
    players: Record<string, PlayerProfile>;
  }

  private migrateRuleset(parsed: PlayerStoreData, raw: string): PlayerStoreData;
  ```
- **Execution Flow / Logic**:
  1. `load`에서 파일을 읽어 형식을 검사한 뒤 버전을 확인한다. `(parsed.rulesetVersion ?? 1) === RANKING_RULESET_VERSION`이면 그대로 쓴다.
  2. 버전이 다르면:
     - 백업 경로: `${filePath}.ruleset-${oldVersion}.bak`
     - 백업 파일이 없을 때만 `fs.writeFileSync(backupPath, raw, 'utf-8')`로 원본을 그대로 저장한다. 이미 있으면 덮어쓰지 않는다.
     - **백업에 실패하면 초기화하지 않고** 오류를 기록한 뒤 기존 데이터를 그대로 쓴다.
     - 각 프로필의 `bestScore = 0`, `totalGames = 0`. `deviceId`, `nickname`, `lastPlayedAt`은 유지한다.
     - `rulesetVersion`을 현재 값으로 하고 저장한다.
  3. 새 저장소와 파일이 없는 경우에도 `rulesetVersion`을 현재 값으로 저장한다.
  4. 형식이 깨진 파일의 기존 처리(빈 저장소로 시작)는 유지한다.
- 앞으로 규칙이 크게 바뀌면 `RANKING_RULESET_VERSION`만 올리면 된다.

### I02. 테스트

- Related Files:
  - `tests/server-session.test.ts` — 이전 시나리오 추가; modify

#### Details
임시 디렉터리의 저장소 파일로 검증한다. **실제 `data/players.json`을 건드리지 않는다.**
- 버전 없는 파일을 로드하면 백업 파일이 원본과 똑같이 생긴다.
- 로드 후 `bestScore`, `totalGames`는 0이고 닉네임은 유지된다.
- 다시 로드해도 점수를 새로 기록한 값이 초기화되지 않고, 백업도 덮어쓰지 않는다.
- 백업 경로에 쓸 수 없으면 기존 데이터가 그대로 유지된다(`vi.spyOn(fs, 'writeFileSync')`로 실패를 흉내).
- 현재 버전 파일은 변경되지 않는다.

## Acceptance Criteria
- [x] 첫 서버 실행 때 이전 점수가 백업되고 랭킹이 비워진다.
- [x] 플레이어가 닉네임을 다시 입력하지 않아도 된다.
- [x] 두 번째 실행부터는 점수가 유지된다.

## Validation
- `npx vitest run tests/server-session.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run server` 후 `data/players.json.ruleset-1.bak`가 생기고 원본 점수가 들어 있는지 확인

## Commit Message
```text
feat(server): back up and reset rankings when game rules change

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P05-docs-and-verification
Task: T03-reset-rankings-for-new-rules

- Add a ranking ruleset version
- Back up old scores before resetting them
- Keep player nicknames and device links
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(server): back up and reset rankings when game rules change
