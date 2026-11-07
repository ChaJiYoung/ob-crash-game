# Task: T05 불안정 테스트 찾기

## Status: done

## Goal
전체 테스트를 돌릴 때 가끔 1개가 실패하는 원인을 찾아 없앤다(2인팟 P05 완료 직후 640개 중 1개 실패, 재실행 3번은 모두 통과).

## Decision Summary
- 테스트를 끄거나 재시도를 넣어 숨기지 않는다. 원인(무작위 값, 실제 시간, 테스트 간 공유 상태, 포트 충돌 등)을 고친다.

## Implementation

### I01. 재현

- `for i in $(seq 1 30); do npx vitest run 2>&1 | grep -E "FAIL|✗|×" ; done | sort | uniq -c`로 실패하는 테스트 이름을 모은다. 30번에 한 번도 안 나오면 `--sequence.shuffle`로 30번 더.
- 찾은 테스트를 단독으로 `npx vitest run <파일> -t "<이름>"` 100번 반복해 확률을 적는다.

### I02. 원인 제거

- 흔한 원인과 처리:
  - `Math.random()` 사용(예: 엔진 `spawnNextTarget`의 몬스터 종류 선택) → 테스트에서 엔진의 `dropRng` 같은 주입 가능한 난수를 쓰게 하거나 테스트가 결과에 의존하지 않게.
  - `performance.now()`/`Date.now()` 실제 시간 → `vi.useFakeTimers()` 또는 시간을 인자로.
  - 서버 소켓 테스트의 고정 포트 → 0번 포트(임의 포트).
  - 테스트 간 전역 상태(localStorage mock, 전역 타이머 교체) 미복구 → `afterEach`에서 복구.
- 찾지 못하면 30회 실행 로그를 커밋 메시지 본문에 요약하고 Status를 `blocked`로 남긴다(억지로 고치지 않는다).

## Acceptance Criteria
- [ ] 전체 테스트 30회 연속 실패 0.

## Validation
- `for i in $(seq 1 30); do npx vitest run >/dev/null 2>&1 || echo FAIL; done | grep -c FAIL` — `0`

## Commit Message
```text
test: remove the source of an intermittent failure

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T05-flaky-test

- <찾은 테스트 이름과 원인>
- <고친 방법>
- 30 consecutive full runs pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
