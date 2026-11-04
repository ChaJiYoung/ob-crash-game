# Task: T03 Sync Docs and Ranking Version

## Status: todo

## Goal
새 점수 규칙(시간 보너스, 보스 소환 방식)을 안내 문구와 문서에 반영하고, 랭킹 규칙 버전을 필요하면 올린다.

## Decision Summary
- D06: 점수 규칙이 또 바뀌므로 `RANKING_RULESET_VERSION`을 올린다. `data/players.json`의 `rulesetVersion`이 이미 3이면 4로, 아니면 3을 유지한다. 확인 전 실제 파일을 수정하지 않는다.
- 안내 문구의 수치는 `GAME_TUNING`에서 가져오고, `docs-sync` 테스트로 맞춘다.

## Implementation

### I01. 안내 문구

- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 점수·보스 설명 — 시간 보너스, 부하 낙하 소환; modify
  - `src/pc/components/TutorialGuideOverlay.tsx` :: 점수 안내 문구가 있으면 갱신; modify
  - `README.md`, `docs/무기_및_스킬_가이드.md`, `docs/몬스터_도감_설명서.md`, `docs/비어 크러셔 요구사항 분석서.md`, `docs/비어 크러셔 상세설계서.md` — 점수 규칙, 보스 소환; modify

#### Details
- 넣을 내용: 웨이브 클리어 시간 보너스(기준 시간 이내 상한, 2배에서 0, 보스 웨이브 가중), 결과 화면 점수 내역, 보스 부하가 위에서 6~14m에 떨어지고 착지 전 맞힐 수 없음, 보스전이 길어질수록 소환이 빨라짐.
- 수치는 `GAME_TUNING.score.timeBonus`, `boss.minionDrop`, `boss.summonAccel`에서 가져온다(문서 파일은 현재 값을 적고 테스트로 일치 확인).

### I02. 랭킹 규칙 버전

- Related Files:
  - `src/shared/gameTuning.ts` :: `RANKING_RULESET_VERSION` — 필요 시 상향; modify
  - `tests/server-session.test.ts` :: 버전 상수를 쓰므로 변경 없음(통과 확인)

#### Details
- 실제 `data/players.json`은 건드리지 않는다. 서버가 다음 실행 때 이전 점수를 `.ruleset-N.bak`으로 백업하고 점수를 0으로 초기화한다(닉네임 유지). 이 사실을 사용자에게 알린다.

### I03. 문서 동기화 테스트

- Related Files:
  - `tests/docs-sync.test.ts` :: 시간 보너스·소환 수치 문구 일치 검사; modify

#### Details
- README와 무기 가이드에 `maxPerWave`, 기준 시간 규칙, 낙하 반경(6~14m)이 현재 튜닝 값과 같게 적혀 있는지 검사한다. 옛 문구(보스 뒤에서 소환 등)가 남지 않게 FORBIDDEN 목록에 추가한다.


## Acceptance Criteria
- [ ] 안내 모달·README·docs에 시간 보너스와 새 보스 소환 규칙이 현재 수치로 적혀 있다.
- [ ] `docs-sync` 테스트가 통과한다.
- [ ] 랭킹 규칙 버전 결정이 기록되었다.

## Validation
- `npx vitest run tests/docs-sync.test.ts tests/server-session.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음, `npm run build` — 성공

## Commit Message
```text
docs(game): document the time bonus and the new boss summon rules

Plan: 2026-11-05-score-differentiation
Phase: P03-tune-and-verify
Task: T03-sync-docs-and-ranking-version

- Update the guide modal, README, and docs to the tuned numbers
- Raise the ranking ruleset version when the stored one is already current
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
