# Task: T02 자동 검증과 사람 직접 플레이

## Status: done

## Goal
자동 검증을 모두 돌리고, 사람이 직접 플레이해 다섯 가지 소감이 해결됐는지 확인한다.

## Decision Summary
- 에이전트가 대신 통과로 표시하지 않는다. 사용자는 채팅으로 느낌을 말하면 된다. 개틀링을 포함한 이전 계획의 플레이 확인도 사용자가 알려 주면 함께 닫는다.

## Implementation

### I01. 자동 검증
- Related Files:
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` :: 끝에 "플레이 소감 반영 추가분" 절; modify
  - `scripts/playtest-bot.mjs`, `scripts/verify-live.mjs` — 실행만; read-only

#### Details
- 실행: `npm test`, `npx tsc --noEmit`, `npm run build`, 개발 서버만 켜고 `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs`. 게임 서버(`npm run server`)는 켜지 않는다. 라이브 스크립트가 덮어쓴 `docs/screens/screen-live-verification.png`는 `git checkout`으로 되돌린다.
- 7웨이브 화면을 한 번 확인해 경고 띠가 체력바 3개와 얼마나 겹치는지 기록한다(겹쳐도 2초 안에 사라지면 통과. 사용자 결정).
- 체크리스트 추가:
  | 장전 중 링이 바로 보이는가 | 세 무기 모두 또렷하다 |
  | 조준점이 흐려져 답답하지 않은가 | 장전 중에도 조준할 수 있다 |
  | 똥 움직임이 자연스러운가 | 바닥에서 또잉또잉 늘고 준다 |
  | 똥을 맞히기 괜찮은가 | 보이는 곳을 쏘면 맞는다 |
  | 맞았다는 것이 느껴지는가 | 번쩍임과 소리로 안다 |
  | 경고 띠가 멋지고 방해되지 않는가 | 빛줄이 훑고 곧 사라진다 |
  | 소형과 대왕이 구분되는가 | 7웨이브에서 바로 구분된다 |
  | 로고가 보이는가 | OB 로고를 알아볼 수 있다 |
- 조정 위치: `GAME_TUNING.shell`(`springHz`, `springAmount`, `baseY`), `boss.warningMs`, `CrosshairOverlay.tsx`의 `reticleOpacity`.

### I02. 사람 플레이 뒤 마무리
- 들은 내용을 체크리스트에 적고, 필요하면 위 값을 조정한 뒤 `npm test`를 다시 돌린다.
- Plan과 Phase를 `done`으로 표시하고 `current.md`를 갱신한다. 이전 계획의 플레이 Task와 랭킹 v5 여부는 사용자가 개틀링을 해 본 뒤 묻는다.

## Acceptance Criteria
- [x] 자동 검증이 통과하고 결과가 기록된다.
- [x] 사람 플레이 결과가 기록되고 조정 또는 "그대로 OK"로 확정된다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 모두 통과

## Commit Message
```text
chore(playtest): record the visual feedback verification

Plan: 2026-11-05-playtest-visual-feedback
Phase: P03-docs-and-verify
Task: T02-final-verification-and-playtest

- Record automated results and the human playtest notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## 사람 플레이 결과 (2026-11-06)
사용자가 세 무기를 모두 직접 플레이해 "아슬아슬하게 다 깼다"고 알렸고, 이 플레이 확인을 닫으라고 했다. 값 조정 없음.
