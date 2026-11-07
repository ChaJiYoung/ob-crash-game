# Task: T06 플레이어 0 지름길 제거

## Status: done

## Goal
T01에서 리팩터 안전망으로 남긴 엔진의 위임 접근자(`engine.scoreManager`, `engine.weaponSystem`, `engine.luckyDropStacks`, `shotStats`·`cardStacks`·`totalKills`·`itemsCollected`·`precisionBonusApplied`·`levelBonusApplied`·`waveTimeBonusTotal`·`waveClears`·`activeBuffUntilMs`)를 모두 지우고, 소스·테스트·스크립트가 `engine.getPlayer(i)`로만 개인 값을 읽게 한다. 이 지름길이 남아 있으면 이후 P03·P04 코드가 무심코 "플레이어 0 전용" 경로를 다시 만들기 때문이다(D24). P01의 마지막 Task로 두어, P03·P04는 지름길이 없는 엔진 위에서 짠다.

## Decision Summary
- 기계적 치환이다. 동작 변경 없음.
- 범위(계획 시점 실측): `.scoreManager` src 39 / tests 77 / scripts 27, `.weaponSystem` src 47 / tests 152 / scripts 45, `.luckyDropStacks` src 7 / scripts 1, 파일 40개 안팎. `(engine as any).shotStats` 같은 private 필드 접근은 `tests/precision-bonus.test.ts` 등.
- `ScoreAndFeverManager`·`WeaponSystem` 자체의 `scoreManager`/`weaponSystem` 이름(예: `PlayerCombatState.scoreManager`)은 그대로다. 지우는 것은 **엔진에 붙은** 위임 접근자뿐이다.

## Implementation

### I01. 엔진 접근자 삭제

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: T01에서 추가한 위임 get/set 전부; modify

#### Details
- 삭제 후 엔진 내부의 남은 `this.scoreManager` 등은 T02에서 이미 `p.`로 바뀌었어야 한다. 남아 있으면(튜토리얼·샌드박스 코드 등) `this.getPlayer(0)`로 바꾼다 — 튜토리얼·샌드박스는 1인 모드라 0번이 유일한 플레이어다.

### I02. 호출부 치환

- Related Files:
  - `src/**/*.ts(x)`, `tests/**/*.ts(x)`, `scripts/*.mjs`, `.memory/references/scripts/*.ts|*.mjs` — 엔진 위임 접근자 사용처; modify

#### Details
- **Execution Flow / Logic**:
  1. 목록 만들기: `grep -rnE "\b(engine|eng|e|game)\.(scoreManager|weaponSystem|luckyDropStacks)\b" src tests scripts .memory/references/scripts` 와 `grep -rnE "as any\)\.(shotStats|cardStacks|totalKills|itemsCollected|precisionBonusApplied|levelBonusApplied|waveTimeBonusTotal|waveClears|activeBuffUntilMs)" tests src scripts`.
  2. 치환 규칙: `X.scoreManager` → `X.getPlayer(0).scoreManager`, `X.weaponSystem` → `X.getPlayer(0).weaponSystem`, `X.luckyDropStacks` → `X.getPlayer(0).luckyDropStacks`, `(X as any).shotStats` → `X.getPlayer(0).shotStats`(공개 필드라 `as any` 불필요), `activeBuffUntilMs` → `getPlayer(0).buffUntilMs`. 단, P03 이후 코드처럼 **특정 플레이어**를 뜻하는 자리는 이 Task 시점에는 없다(아직 P01) — 소스의 0은 "1인 전용 화면(튜토리얼·센서 랩·현재 PC 페이지)"이라 맞다.
  3. `tsconfig.json`이 `tests`를 포함하는지 확인하고, 포함하지 않으면 `npx tsc --noEmit -p tsconfig.json` 대신 `npm test` 실패로 남은 곳을 찾는다. `.mjs` 스크립트는 타입 검사가 없으므로 1번 grep 결과가 0이 될 때까지 확인.

### I03. 재발 방지 테스트

- Related Files:
  - `tests/no-solo-aliases.test.ts`; new

#### Details
- `src/` 전체 파일을 읽어 정규식 `/\bengine\.(scoreManager|weaponSystem|luckyDropStacks)\b/` 0건을 단언(`tests/docs-sync.test.ts`의 파일 순회 방식 재사용).
- `BeerCrusherEngine.prototype`에 `scoreManager`/`weaponSystem` 속성 서술자가 없음.

## Acceptance Criteria
- [x] 엔진에 플레이어 0 위임 접근자가 없다.
- [x] 전체 테스트·봇 스크립트가 `getPlayer(i)`로 동작한다.

## Validation
- `grep -rnE "\b(engine|eng|e|game)\.(scoreManager|weaponSystem|luckyDropStacks)\b" src tests scripts .memory/references/scripts | wc -l` — `0`
- `npx vitest run tests/no-solo-aliases.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과
- `node scripts/playtest-bot.mjs --help` 또는 실행 가능한 최소 인자로 스크립트가 로드되는지(가능하면) 확인

## Commit Message
```text
refactor(engine): drop player-0 shortcuts, read players by index only

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T06-remove-solo-aliases

- Remove engine.scoreManager / weaponSystem / luckyDropStacks and the private field delegates
- Source, tests and bot scripts use engine.getPlayer(i)
- Guard test keeps the shortcuts from coming back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
