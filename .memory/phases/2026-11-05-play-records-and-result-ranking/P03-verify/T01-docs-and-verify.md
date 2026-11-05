# Task: T01 문서, 자동 검증, 직접 확인

## Status: done

## Goal
기록 파일과 결과 화면이 문서화되고 실제 게임에서 동작이 확인된다.

## Decision Summary
- 사람 확인을 대신 통과로 표시하지 않는다.

## Implementation

### I01. 문서
- Related Files: `README.md`, `docs/비어 크러셔 상세설계서.md`, `docs/screens/` 결과 화면 캡처; modify
- 기록 파일 위치와 항목, 규칙 버전이 바뀌어도 유지된다는 점, 기기 ID와 닉네임이 포함된다는 점을 쓴다.

### I02. 검증
- `npm test`, `npx tsc --noEmit`, `npm run build`.
- 개발 서버와 게임 서버를 임시 경로로 켜서 한 판을 끝내고 결과 화면과 기록 한 줄을 확인한다. 실제 `data/`를 오염시키지 않는다. 라이브 스크립트가 덮어쓴 `docs/screens/screen-live-verification.png`는 되돌린다.

## Acceptance Criteria
- [x] 자동 검증 통과, 결과 화면 캡처 확인.
- [x] 사람이 실제 플레이 후 랭킹과 기록을 확인한다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 통과

## Commit Message
```text
docs(records): document play records and the result ranking

Plan: 2026-11-05-play-records-and-result-ranking
Phase: P03-verify
Task: T01-docs-and-verify

- Describe the records file and capture the new result screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
