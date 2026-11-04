# Task: T01 Update Automation Scripts

## Status: done

## Goal
`scripts/`의 자동 플레이·캡처 스크립트가 새 게임 구조에서 끝까지 실행되게 한다. 이후 검증과 스크린샷 재촬영(P05-T05)이 이 스크립트에 의존한다.

## Decision Summary
- 사용자가 계획 포함을 요청했다.
- 스크립트는 7웨이브, 입력 종류(`ShotSource`), 무작위 카드, 좁아진 판정 범위를 전제로 동작해야 한다.
- `playtest-bot.mjs`는 지금도 존재하지 않는 필드(`currentAmmo`, `currentScore`)를 읽는 버그가 있어 함께 고친다.

## Implementation

### I01. 자동 플레이 봇

- Related Files:
  - `scripts/playtest-bot.mjs` :: `aimAndShootAtTargets`, 카드·보스 시나리오 — 새 구조 반영; modify

#### Details
- **Execution Flow / Logic**:
  1. 필드 이름 수정: `getState().currentAmmo` → `getState().ammo`(`:96`, `:218`), `getState().currentScore` → `getState().totalScore`(`:97`, `:212`).
  2. 조준 계산: `chosen.x / 14.0`처럼 추정한 좌표를 쓰지 않는다. 판정 범위가 좁아져 빗나간다. 실제 판정 좌표를 쓴다.
     ```javascript
     const p = eng.computeTargetAimCoords(chosen);
     const res = eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
     ```
  3. 무기 선택 카드와 보상 카드: `eng.shootAt(card.x / 14.0, 0.05, ...)`를 같은 방식으로 바꾼다. 입력 잠금을 지나도록 스폰 뒤 900ms 이상 기다린다.
  4. 보상 카드: `weapon_level_up`이 없을 수 있으므로 `eng.activeTargets.find((t) => t.rewardCardKind)`로 고른다.
  5. 보스 시나리오: 웨이브를 직접 설정하지 말고 `eng.startWave(7)` 뒤 미니웨이브를 처치해 보스전을 연다. 3대 모두 처치와 `VICTORY`를 확인한다.
  6. 피버 중 난사 루프의 `eng.shootAt(0, 0.05, ...)`에 `'fever'`를 넘긴다.
  7. 메트릭의 `projectilesIntercepted` 집계는 유지한다.

### I02. 캡처와 라이브 검증

- Related Files:
  - `scripts/capture-all.mjs` — 새 구조 확인; modify
  - `scripts/capture-tutorial.mjs` — 새 구조 확인; modify
  - `scripts/capture-weapons-and-skills.mjs` — 새 구조 확인; modify
  - `scripts/verify-live.mjs` — 새 구조 확인; modify

#### Details
- 각 스크립트의 `eng.*` 호출을 `grep -n "eng\.\|__engine" scripts/*.mjs`로 찾아 엔진 API와 맞춘다.
- `eng.isWeaponSelectPending = false`로 직접 상태를 바꾸는 코드는 유지해도 되지만, `activeTargets`의 카드도 함께 지운다. 안 그러면 카드 입력 게이트가 켜져 사격이 막힌다.
- 카드를 쏘는 코드는 `'press'`와 입력 잠금 대기를 반영한다.
- 스킬은 `eng.triggerWeaponSkill`이 카드 대기 중 동작하지 않으므로, 호출 전에 대기 상태가 아닌지 확인한다.
- 화면에 보여야 할 바 카운터 관련 대기 코드나 주석이 있으면 고친다.

### I03. 실행 확인

#### Details
`npm run dev`를 켠 상태에서 차례로 실행한다. 스크린샷 파일이 덮어써지므로 실행 뒤 `git checkout -- docs/screens`로 되돌린다. 실제 재촬영은 P05-T05에서 한다.
```bash
node scripts/playtest-bot.mjs
node scripts/verify-live.mjs
node scripts/capture-weapons-and-skills.mjs
node scripts/capture-tutorial.mjs
node scripts/capture-all.mjs
git checkout -- docs/screens
```

## Acceptance Criteria
- [x] 5개 스크립트가 오류 없이 끝난다.
- [x] 자동 플레이 봇이 무기 선택, 카드 선택, 보스전 승리까지 진행한다.
- [x] 봇 출력의 탄약과 점수가 `undefined`가 아니다.

## Validation
- 위 I03 명령 — 모두 종료 코드 0
- `git status --short docs/screens` — 변경 없음

## Commit Message
```text
chore(scripts): update automation for the new game flow

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P05-docs-and-verification
Task: T01-update-automation-scripts

- Use real aim coordinates and shot sources in the playtest bot
- Fix ammo and score field names
- Handle random reward cards and the final boss encounter
- Align capture and live verification scripts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: chore(scripts): update automation for the new game flow
