# Task: T01 main 병합과 충돌 해결

## Status: done

## Goal
`git merge main`을 하고, 충돌 7개 파일(`.memory/current.md`, `PCGamePage.tsx`, `ArcadeOverlayHUD.tsx`, `GuideModal.tsx`, `JudgmentBanner.tsx`, `TutorialGuideOverlay.tsx`, `BeerCrusherEngine.ts`)을 이 브랜치 구조에 맞게 풀어 타입체크와 전체 테스트가 통과하는 병합 커밋을 만든다.

## Decision Summary
- D01 실제 병합, D02 엔진 플레이어별 잠금, D04 피버 표시 3종, D05 수치 main 값, D06 충전 시간 표시 수용, D08 `current.md`는 이 브랜치 것 유지.
- 자동 병합되는 파일(`gameTuning.ts`, `constants.ts`, `HitJudgment.ts`, `ScoreAndFeverManager.ts`, `GunGripPad.tsx`, README, package*.json 등)은 그대로 받는다. 시험 병합에서 이들은 충돌이 없었다.

## Implementation

### I01. 병합 시작
- Related Files: (git 작업)
#### Details
1. `git status`가 깨끗한지 확인 (`.memory/decisions/2026-11-08-merge-main-rules.md`와 이번 계획 문서는 untracked여도 됨).
2. `git merge --no-commit --no-ff main`. 충돌 목록이 위 7개와 같은지 확인.

### I02. `.memory/current.md`
- `git checkout --ours .memory/current.md && git add` (이 브랜치 포인터 유지, D08).
- main의 `.memory/decisions|plans|phases` 신규 문서는 자동으로 들어온다.

### I03. `src/pc/engine/BeerCrusherEngine.ts` — 플레이어별 스킬 잠금 (D02)
- Related Files:
  - `src/pc/engine/PlayerCombatState.ts` :: `PlayerCombatState` — `lastSkillActivatedMs` 필드 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `triggerWeaponSkill` — 잠금 검사; modify
#### Details
- main이 넣은 전역 `private lastSkillActivatedMs` 필드와 `startGame` 초기화 줄은 **버린다**(충돌 마커 정리 시 ours 쪽 구조 유지).
- `PlayerCombatState`에 추가:
  ```typescript
  /** 마지막 스킬 발동 시각(엔진 시계). reuseLockMs 안의 재요청은 거부한다. */
  public lastSkillActivatedMs = -Infinity;
  ```
  그리고 `reset()` 안에서 `this.lastSkillActivatedMs = -Infinity;`로 초기화 (`startGame`이 `player.reset()`을 부른다 — 불러지는지 `startGame`에서 확인).
- `triggerWeaponSkill(nowMs, playerIndex)`에서 `isAway` 검사 다음, `runWeaponSkill` 호출 전에:
  ```typescript
  if (nowMs - player.lastSkillActivatedMs < GAME_TUNING.skillInput.reuseLockMs) {
    const weaponState = player.weaponSystem.getState();
    return { activated: false, weaponKind: weaponState.weaponKind, weaponLevel: weaponState.weaponLevel, affectedTargets: [], playerIndex };
  }
  ```
  `runWeaponSkill`이 `activated: true`를 반환하면 `player.lastSkillActivatedMs = nowMs;` 를 `emit('skillUsed')` 앞에 둔다.
- 튜토리얼 단계 진행(`advanceTutorialStep(4)`)이 main 쪽 `triggerWeaponSkill`에 있었다면 이 브랜치에서 어디로 옮겨졌는지(`TutorialDirector` 등) 확인하고 **이 브랜치 방식 유지**.
- `GAME_TUNING.skillInput`은 자동 병합으로 들어온 `{ snapDebounceMs: 400, reuseLockMs: 500 }`를 쓴다(`snapDebounceMs`는 T02에서 제거).

### I04. `src/pc/components/JudgmentBanner.tsx` (D04-1)
- `getJudgmentBannerSpec(grade: JudgmentGrade, isFever = false)` — main과 동일하게 `isFever && grade !== 'MISS'`면 `{ title: 'FEVER!', subtitle: \`${GAME_TUNING.judgment.feverDamage.toFixed(1)}x 데미지 (피버)\`, colorHex: '#f97316', scale: 1.3 }`.
- 이 브랜치의 `show(grade, opts?: { color?, label?, side? })`는 **두 번째 인자가 owner 옵션**이다. main의 `show(grade, isFever)` 시그니처로 덮지 말고 `opts`에 `isFever?: boolean` 필드를 추가한다:
  ```typescript
  show(grade: JudgmentGrade, opts?: { color?: string; label?: string; side?: 'left'|'right'|'center'; isFever?: boolean }): void
  ```
  인터페이스 `JudgmentBannerHandle.show`와 구현을 같이 고친다. 내부에서 `getJudgmentBannerSpec(grade, opts?.isFever ?? false)`.

### I05. `src/pc/PCGamePage.tsx` (D04-1)
- `handleShootEvent` 안 `judgmentRef.current?.show(...)`에 이미 있는 `isFever` 지역 변수(= 해당 플레이어의 `scoreManager.getState().isFeverActive`)를 `opts`로 넘긴다. owner 정보가 없을 때도 `isFever`가 전달되도록 `opts` 객체를 항상 만든다:
  ```typescript
  judgmentRef.current?.show(result.grade, {
    ...(pres?.slotLabel ? { color: pres.color, label: pres.slotLabel, side: pres.popupSide } : {}),
    isFever,
  });
  ```
- main의 `show(result.grade, isFever)` 한 줄은 이 호출로 대체(충돌 마커 제거).

### I06. `src/pc/components/ArcadeOverlayHUD.tsx` (D04-2, D06)
- `import { GAME_TUNING } from '../../shared/gameTuning';` 추가.
- `formatWeaponSkillBadge`: main의 `nextCharge` 문자열을 이 브랜치 함수(`inputKind` 인자·`[우클릭|위로 휙!]` 문구 유지)에 합친다:
  ```typescript
  const nextCharge = skillStock < maxSkillStock && cooldownRemainingMs > 0 ? ` · 다음 ${(cooldownRemainingMs / 1000).toFixed(1)}s` : '';
  const stockBadge = maxSkillStock > 1 ? ` [★${skillStock}/${maxSkillStock}${nextCharge}]` : '';
  ```
- `formatFeverStatusBadge` 활성 라벨: `` `🔥 FEVER ACTIVE (무한 탄창·점수 ${GAME_TUNING.fever.scoreMult}배·대미지 ${GAME_TUNING.judgment.feverDamage}배)` ``, accentColor는 main 값(`#f59e0b`) 사용.

### I07. 문구 두 파일 (D04-3)
- `src/pc/components/GuideModal.tsx`: main의 두 줄(`GAME_TUNING.fever.durationMs / 1000`, `scoreMult`, `feverDamage` 사용)을 채택. 이 브랜치가 같은 줄 근처를 바꾼 부분(2인 안내 등)은 보존.
- `src/pc/components/TutorialGuideOverlay.tsx`: main의 세 곳(피버 발동 중 문구, 설명 문구, 하단 FEVER ACTIVE 배지)을 채택, 이 브랜치 변경(약 72줄)은 보존. 필요하면 `GAME_TUNING` import 확인.

### I08. 테스트
- `tests/skill-double-trigger.test.ts`(main 신규): 엔진 케이스는 이 브랜치 API 그대로 동작해야 한다(`triggerWeaponSkill(1000)`은 기본 `playerIndex=0`; `e.weaponSystem`이 아직 있으면 유지, 없으면 `e.getPlayer(0).weaponSystem`으로 수정). 컨트롤러 케이스(`shouldSendSkillSnap`)는 T02에서 삭제하므로 **T01에서는 그대로 두어 통과시킨다**.
- 2인 독립 케이스 추가:
  ```typescript
  it('lock is per player', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false, playerCount: 2 });
    for (const i of [0, 1] as const) { e.getPlayer(i).weaponSystem.selectWeapon('revolver', 1); e.getPlayer(i).weaponSystem.refillSkillInstant(); }
    expect(e.triggerWeaponSkill(1000, 0).activated).toBe(true);
    expect(e.triggerWeaponSkill(1100, 1).activated).toBe(true);
    expect(e.triggerWeaponSkill(1200, 0).activated).toBe(false);
  });
  ```
- 충돌로 깨지는 그 외 main 테스트(`engine-judgment-and-spawn`, `game-tuning`, `pc-hud-and-banner`, `skill-charge-timer`, `fever-tuning-sync`)는 이 브랜치 API에 맞게만 최소 수정.

## Acceptance Criteria
- [ ] `git log --merges -1`이 main 병합 커밋이고, 충돌 마커(`<<<<<<<`)가 저장소에 남지 않음
- [ ] `GAME_TUNING.judgment.feverDamage === 2.0`, 보스 배율 모두 1, `FEVER_CONSTANTS.DURATION_MS`가 튜닝 값을 따름
- [ ] 같은 플레이어가 500ms 안에 두 번째 스킬을 쓰면 거부되고 스톡이 1개만 줄며, 다른 플레이어는 영향 없음
- [ ] 피버 중 명중 시 배너가 `FEVER!` + `2.0x 데미지 (피버)`
- [ ] `.memory/current.md`는 이 브랜치 내용 유지

## Validation
- `grep -rn "<<<<<<<\|>>>>>>>" src tests .memory/current.md` — 결과 없음
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
merge: bring main rule values, skill lock and fever display into 1p-2p

Plan: 2026-11-08-merge-main-rules
Phase: P01-merge-and-port
Task: T01-merge-main

- fever damage 2.0, boss damage scale 1.0, fever duration/score mult in GAME_TUNING
- per-player 500ms skill reuse lock in BeerCrusherEngine.triggerWeaponSkill
- FEVER! judgment banner, fever HUD label, guide/tutorial text with tuned multipliers
- next skill charge timer on HUD and controller
```
(병합 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` 포함)

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: merge commit (git log --merges -1)
