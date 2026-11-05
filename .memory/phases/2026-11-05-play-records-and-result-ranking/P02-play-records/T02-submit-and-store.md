# Task: T02 전송과 서버 저장

## Status: done

## Goal
게임이 끝나면 통계가 서버로 가서 `data/play-records.jsonl`에 한 줄 추가된다.

## Decision Summary
- 결정 D02, D04. 점수 기록을 먼저 하고, 기록 실패는 랭킹을 막지 않는다. 규칙 버전이 다르면 저장하지 않는다.

## Implementation

### I01. 프로토콜과 전송
- Related Files:
  - `src/shared/types.ts` :: `GAME_SCORE_SUBMIT`; modify — `stats?: PlayRunStats` 추가
  - `src/pc/PCGamePage.tsx` :: `submitScore`, HUD 주기의 게임오버·승리 분기; modify

#### Details
- `submitScore` 안에서 `stats: engine.getPlayRunStats() ?? undefined`를 함께 보낸다. 호출 지점은 그대로다.

### I02. 저장소
- Related Files:
  - `server/PlayRecordStore.ts` :: `PlayRecordStore`, `isValidPlayRunStats`; new
  - `server/wsServer.ts` :: `GAME_SCORE_SUBMIT`, 저장소 생성; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function isValidPlayRunStats(v: unknown): v is PlayRunStats;
  export class PlayRecordStore {
    constructor(filePath?: string); // 기본 path.resolve(process.cwd(), 'data', 'play-records.jsonl')
    append(record: { playedAt: string; deviceId: string; nickname: string; rulesetVersion: number; stats: PlayRunStats }): boolean;
  }
  ```
- 줄 형식: `JSON.stringify({playedAt, deviceId, nickname, rulesetVersion, ...stats}) + '\n'`. 폴더가 없으면 `mkdirSync(recursive)` 후 `appendFileSync`. 예외는 잡아 `console.error`하고 `false`.
- 검증: 숫자 항목은 `Number.isFinite`이고 0 이상, `outcome`은 두 값 중 하나, `weaponKind`는 세 무기, `waves`는 배열 길이 20 이하, 필요한 키가 모두 있음. 클라이언트 입력이므로 알 수 없는 키는 복사하지 말고 명시한 필드만 다시 만들어 쓴다.
- `wsServer`: `options?.recordPath`를 받아 생성. `recordGameScore` 뒤에 `if (isValidPlayRunStats(msg.stats)) store.append({ nickname: profile.nickname, ... })`. 유효하지 않으면 경고 로그만 남기고 응답은 그대로다.
- 함정: 테스트가 실제 `data/`에 쓰지 않도록 서버 테스트는 `recordPath`를 임시 경로로 준다. `storePath`만 주는 기존 호출은 `storePath`와 같은 폴더의 `play-records.jsonl`을 기본값으로 쓴다.

### I03. 테스트
- Related Files:
  - `tests/play-records.test.ts`; new
  - `tests/server-session.test.ts`; 필요 시 modify

#### Details
- 두 번 저장하면 두 줄이고 JSON으로 읽힌다. 잘못된 값(NaN, 음수, 무기 오류)은 거절. 추가 키는 저장되지 않음. 쓰기 실패 시 `false`이며 예외 없음. 소켓 통합: `stats` 포함 제출은 랭킹과 기록 모두, `stats` 없음은 랭킹만, 규칙 버전 불일치는 둘 다 없음. `players.json` 초기화 뒤에도 기록 파일 유지.

## Acceptance Criteria
- [x] 끝난 판마다 한 줄이 쌓이고, 기록 실패가 랭킹에 영향이 없다.

## Validation
- `npx vitest run tests/play-records.test.ts tests/server-session.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(server): append every finished run to a play records file

Plan: 2026-11-05-play-records-and-result-ranking
Phase: P02-play-records
Task: T02-submit-and-store

- Send run stats with the score and store validated fields apart from the ranking file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
