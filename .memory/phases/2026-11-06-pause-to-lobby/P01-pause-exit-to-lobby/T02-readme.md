# Task: T02 README 갱신

## Status: pending

## Goal
README 일시정지 항목에 로비 나가기를 반영한다.

## Decision Summary
- `README.md` 29행 일시정지 불릿에 `로비로 나가기`(확인 후, 점수 저장 안 됨) 추가.

## Implementation

### I01. 문서
- Related Files:
  - `README.md` :: `## 📱 연결 유지 & 일시정지` — modify
#### Details
- `이어하기` / `다시시작` 뒤에 `/ 로비로 나가기(확인 후 대기실로 이동, 이번 판 점수는 저장되지 않음)` 추가.

## Acceptance Criteria
- [ ] README 에 로비 나가기 설명이 있고 docs-sync 테스트 통과

## Validation
- `npx vitest run tests/docs-sync.test.ts` — 통과

## Commit Message
```text
docs(pause): describe leaving to the lobby from the pause menu

Plan: 2026-11-06-pause-to-lobby
Phase: P01-pause-exit-to-lobby
Task: T02-readme
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
