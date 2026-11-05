# Task: T03 문서 갱신과 전체 검증

## Status: done

## Goal
사용자용 문서에 새 동작(방 유지, 자동 재연결, 일시정지)을 적고, 전체 테스트·타입·빌드가 통과함을 확인한다.

## Decision Summary
- `tests/docs-sync.test.ts`가 문서의 금지 표현과 수치를 검사한다. 문서를 고친 뒤 반드시 이 테스트를 돌린다.
- 새 문장에는 기존 FORBIDDEN 패턴(예: 폐지된 규칙 표현)을 쓰지 않는다.

## Implementation

### I01. 문서
- Related Files:
  - `README.md` :: 조작·연결 설명 절; modify
  - `docs/튜토리얼_훈련장_가이드.md` 또는 `docs/무기_및_스킬_가이드.md` 중 조작법을 설명하는 쪽 :: 조작 키 표; modify
  - `src/pc/components/GuideModal.tsx` :: 조작 탭의 키 안내; modify

#### Details
- 추가할 내용: `Esc 또는 ⏸ 버튼 = 일시정지(이어하기 / 다시시작)`, `폰은 마지막 방을 기억해 화면이 꺼졌다 켜져도 자동 재연결`, `PC를 새로고침해도 같은 QR 유지, 바꾸려면 새 QR 발급`. 해당 파일에서 기존 조작 안내가 있는 위치를 먼저 읽고 같은 형식으로 쓴다.
- 폰이 백그라운드에서 오래 있으면 OS가 연결을 끊을 수 있고, 화면을 다시 켜면 자동 복구된다는 한계를 한 줄로 쓴다.

### I02. 전체 검증
- 실행: `npx vitest run`, `npx tsc --noEmit`, `npm run build`. 실패하면 이 Task 안에서 원인을 고친다(범위를 넘는 기존 실패는 보고만 한다).

## Acceptance Criteria
- [ ] 위 문서에 새 동작이 적혀 있다.
- [ ] `npx vitest run` 전체 통과, `npx tsc --noEmit` 오류 없음, `npm run build` 성공.

## Validation
- `npx vitest run tests/docs-sync.test.ts tests/tutorial-and-guide.test.ts` — 통과
- `npx vitest run` — 전체 통과
- `npx tsc --noEmit && npm run build` — 성공

## Commit Message
```text
docs(controls): document room memory, auto reconnect and the pause menu

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P02-pause-menu
Task: T03-docs-and-verification

- describe Esc / pause button, resume and restart
- describe the persistent QR and controller auto reconnect
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: (this commit)
