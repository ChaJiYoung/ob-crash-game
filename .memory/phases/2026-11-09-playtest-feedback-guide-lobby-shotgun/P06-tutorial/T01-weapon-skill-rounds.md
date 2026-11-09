# Task: T01 튜토리얼 3단계를 무기 3종 스킬 체험 라운드로

## Status: pending

## Goal
튜토리얼 3단계(스킬)를 ① 샷건 → ② 리볼버 → ③ 게틀링 3라운드로 나눠, 무기를 자동으로 바꿔 가며 각 무기의 단타를 자유롭게 쏴 보고 **스킬을 한 번 쓰면 통과**하게 한다. 샷건 라운드만 박힌 몬스터가 **폭발하는 것까지 본 뒤** 통과한다. 화면 위 안내문은 무기 이름·한 줄 특징·지금 할 일을 보여 준다(D18, D19).

## Decision Summary
- 1·2단계(정밀 조준, 홀드 연사)는 샷건 Lv.1 그대로, 4단계(피버)는 다시 샷건 Lv.1로 돌아온다(`advanceStep(4)`에서 `selectWeapon('shotgun', 1)`). `TutorialStep` 타입(`1|2|3|4|'COMPLETED'`)은 **바꾸지 않는다** — 3단계 안의 라운드는 Director 내부 상태로 다룬다.
- 라운드 상태: `skillRound: 0 | 1 | 2`(= 샷건·리볼버·게틀링), `skillPhase: 'ready' | 'awaitingBlast' | 'done'`. 화면은 이 둘을 콜백으로 받아 안내문을 바꾼다.
- 통과 조건: 라운드에서 `skillUsed`(플레이어 0). **샷건만** `plungerBlasted`(P02-T01) 이후. 리볼버·게틀링은 스킬 효과(칼날·거품 약 0.3~0.5초)가 화면에 보이도록 표적 정리를 `1200ms` 지연한다(통과 조건은 스킬 사용 그대로, 지연은 연출용).
- 표적은 기존 `spawnStep3()`(정지한 5마리: 필스굿·카스라이트 교대)를 라운드마다 재사용한다. 샷건 라운드에서 5마리 > 상한 4라서 "상한이 있다"도 자연히 보인다.
- 타이머는 `setTimeout`(실시간)을 쓰고 `stop()`·`start()`에서 반드시 해제한다(테스트는 `vi.useFakeTimers()`).

## Implementation

### I01. TutorialDirector: 라운드 상태·무기 교체·통과 처리
- Related Files:
  - `src/pc/tutorial/TutorialDirector.ts` :: `TutorialDirector`, `advanceStep`, `handleEvent`, `start`, `stop`, `spawnStep3` — modify
  - `src/pc/engine/engineEvents.ts` :: `EngineEvent`(`plungerBlasted`, `skillUsed`, `targetKilled`) — read-only (P02-T01에서 추가됨)
  - `src/pc/engine/WeaponSystem.ts` :: `selectWeapon`, `refillSkillInstant` — read-only
  - `src/pc/engine/BeerCrusherEngine.ts` :: `placeTargets`(259행: 호출 시 `activeTargets`를 비움), `activeTargets` — read-only
#### Details
- **Signatures & Types**:
  ```ts
  export const TUTORIAL_SKILL_ROUND_WEAPONS = ['shotgun', 'revolver', 'gatling'] as const; // WeaponKind
  export type TutorialSkillRound = 0 | 1 | 2;
  export type TutorialSkillPhase = 'ready' | 'awaitingBlast' | 'done';
  export interface TutorialRoundState { round: TutorialSkillRound; phase: TutorialSkillPhase }
  /** 샷건 폭발 후 다음 라운드까지, 리볼버·게틀링 스킬 사용 후 다음 라운드까지 기다리는 시간(ms). */
  export const TUTORIAL_BLAST_ADVANCE_DELAY_MS = 500;
  export const TUTORIAL_SKILL_ADVANCE_DELAY_MS = 1200;

  constructor(engine: BeerCrusherEngine, onStepChange?: (step: TutorialStep) => void, onRoundChange?: (s: TutorialRoundState) => void)
  public skillRound: TutorialSkillRound = 0;
  public skillPhase: TutorialSkillPhase = 'ready';
  private advanceTimer?: ReturnType<typeof setTimeout>;
  private startSkillRound(round: TutorialSkillRound): void
  private scheduleRoundAdvance(delayMs: number): void
  private advanceSkillRound(): void
  ```
- **Execution Flow / Logic**:
  1. `advanceStep(3)`: 기존 `refillSkillInstant()+spawnStep3()` 대신 `this.startSkillRound(0)`.
  2. `startSkillRound(round)`: `this.clearAdvanceTimer(); this.skillRound = round; this.skillPhase = 'ready'; const player = this.engine.getPlayer(0); player.weaponSystem.selectWeapon(TUTORIAL_SKILL_ROUND_WEAPONS[round], 1); player.weaponSystem.refillSkillInstant(); this.spawnStep3(); this.onRoundChange?.({ round, phase: 'ready' });` (`selectWeapon`은 스킬 재고를 0으로 만들므로 **반드시** 그 뒤에 `refillSkillInstant()`.)
  3. `handleEvent` 'skillUsed': `if (this.step === 3 && e.playerIndex === 0 && this.skillPhase === 'ready')`. 라운드 0(샷건)이면 `this.skillPhase = 'awaitingBlast'; onRoundChange(...)` 후, 박힌 몬스터가 없으면(`!this.engine.activeTargets.some((t) => t.plungerBlast)` — 모두 이미 죽었거나 후보가 없던 경우) 교착을 막기 위해 바로 `scheduleRoundAdvance(TUTORIAL_BLAST_ADVANCE_DELAY_MS)`. 라운드 1·2면 `this.skillPhase = 'done'; onRoundChange(...); this.scheduleRoundAdvance(TUTORIAL_SKILL_ADVANCE_DELAY_MS)`.
  4. 'plungerBlasted'와 'targetKilled'(샷건 라운드 `awaitingBlast`일 때만): `if (this.step === 3 && this.skillPhase === 'awaitingBlast' && !this.engine.activeTargets.some((t) => t.plungerBlast)) this.scheduleRoundAdvance(TUTORIAL_BLAST_ADVANCE_DELAY_MS);` — **박힌 몬스터가 하나도 안 남았을 때** 한 번만(`scheduleRoundAdvance`는 이미 타이머가 있으면 무시). 이렇게 해야 박힌 몬스터를 모두 평타로 잡아 `plungerBlasted`가 한 번도 나오지 않아도 통과한다.
  5. `scheduleRoundAdvance(delay)`: `if (this.advanceTimer) return; this.skillPhase = 'done'; this.onRoundChange?.(...); this.advanceTimer = setTimeout(() => { this.advanceTimer = undefined; this.advanceSkillRound(); }, delay);`
  6. `advanceSkillRound()`: `if (this.step !== 3 || this.completed) return;` 라운드가 2면 `this.advanceStep(4)`, 아니면 `this.startSkillRound((this.skillRound + 1) as TutorialSkillRound)`.
  7. 기존 `targetKilled` 분기 `else if (this.step === 3 && this.engine.activeTargets.length === 0) this.spawnStep3();`는 **라운드가 진행 중(`skillPhase === 'ready'`)일 때만** 재배치하도록 조건에 `&& this.skillPhase === 'ready'`를 추가한다(통과 대기 중에 표적이 새로 생기면 안 된다). 기존 `skillUsed` 분기의 `this.advanceStep(4)`는 삭제하고 3번으로 대체한다.
  8. `advanceStep(4)`: 기존(`forceSetFeverGauge(100)`, `activeTargets = []`)에 `this.engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);`를 **추가**한다(게틀링으로 피버 단계에 들어가지 않게). `advanceStep('COMPLETED')`·`stop()`·`start()`는 `clearAdvanceTimer()`를 호출한다. `start()`는 `skillRound = 0; skillPhase = 'ready'`로 초기화한다.
- **함정**: ① `selectWeapon`은 **무기 레벨 1**·탄창 가득·스킬 0으로 초기화하므로 `refillSkillInstant()`를 빼먹으면 3라운드 모두 "스킬이 없어서" 막힌다. ② 샷건 라운드 `skillUsed` 시점에 `plungerBlast`가 이미 박혀 있으므로(엔진 `runWeaponSkill`이 `emit` 전에 설정) 3번의 "박힌 몬스터 없음" 검사가 정확하다. ③ 일시정지 중에 타이머가 흘러도 통과 처리는 안전하다(표적 정리와 무기 교체뿐).

### I02. 안내문(TutorialGuideOverlay)과 PCGamePage 연결
- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlayProps`, 3단계 제목(82~86행)·본문(122~134행) — modify
  - `src/pc/PCGamePage.tsx` :: 221~222행(`tutorialDirectorRef`, `tutorialStep`), `handleStartTutorial`(1313행), `<TutorialGuideOverlay …/>`(1670행) — modify
  - `src/shared/guideText.ts` :: `WEAPON_ONE_LINER`, `WEAPON_SKILL_ONE_LINER`(P05-T01) — read-only
  - `src/shared/constants.ts` :: `WEAPON_ARCHETYPE_SPECS[k].nameKo`, `badgeIcon` — read-only
#### Details
- **Signatures & Types**:
  ```ts
  // TutorialGuideOverlayProps에 선택 props 추가(기본값으로 이전 동작 호환)
  weaponKind?: WeaponKind;          // 기본 'shotgun'
  skillRound?: 0 | 1 | 2;           // 기본 0
  skillPhase?: 'ready' | 'awaitingBlast' | 'done'; // 기본 'ready'
  ```
- **Execution Flow / Logic**: 3단계 제목: `⚡ STEP 3-${skillRound + 1}/3. ${badgeIcon} ${nameKo} 스킬 체험 (${입력별: 우클릭 | 위로 휙!})`. 본문 첫 줄: `<strong>{WEAPON_ONE_LINER[weaponKind]}</strong>`, 둘째 줄: 입력별 문구로 "먼저 단타로 몇 발 쏴 보고, 준비되면 스킬을 발동하세요"(`inputKind` mouse → 마우스 클릭/우클릭, mobile → 탭/휙), 보조 줄: `💡 {WEAPON_SKILL_ONE_LINER[weaponKind]}`. `skillPhase === 'awaitingBlast'`이면 본문을 "박힌 몬스터가 곧 터집니다! 기절해 있는 동안 쏴서 마무리해 보세요"로 바꾼다. `skillPhase === 'done'`이면 "좋아요! 다음 무기로 바꿉니다…"(마지막 라운드는 "스킬 체험 끝! 피버로 넘어갑니다…"). 현재 3단계 문구 "샷건 스킬은 화면의 모든 몬스터를 기절시키고…"는 **삭제**한다(더는 사실이 아니다).
  `PCGamePage`: `const [tutorialRound, setTutorialRound] = useState<TutorialRoundState>({ round: 0, phase: 'ready' });` 추가. `handleStartTutorial`에서 `new TutorialDirector(engine, (step) => setTutorialStep(step), setTutorialRound)`로 만들고, `director.start(...)` 직후 `setTutorialRound({ round: 0, phase: 'ready' })`. `<TutorialGuideOverlay …/>`에 `weaponKind={hudState.players[0]?.weaponKind ?? 'shotgun'}`, `skillRound={tutorialRound.round}`, `skillPhase={tutorialRound.phase}`를 넘긴다(`hudState.players[0].weaponKind`는 이미 같은 파일 1696행 `CrosshairOverlay`에서 쓰는 값).
- **함정**: 3D 총·십자선은 `hudState`와 엔진 무기 상태에서 알아서 바뀐다(`GameCanvas3D`가 매 프레임 `gun.setWeaponAppearance(weaponKind, weaponLevel)` 호출, 788행). 따로 신호를 보낼 필요 없다. 다만 `PlayerPanel`의 스킬 안내 문구가 샷건 전용 텍스트를 쓰지 않는지 확인한다(`grep -n "뚫어뻥" src/pc/components`).

### I03. 테스트·문서 동기화
- Related Files:
  - `tests/tutorial-skill-step.test.ts` — 전체 재작성(modify)
  - `tests/tutorial-director.test.ts`(41~52행 스킬 사용 후 4단계 기대), `tests/tutorial-and-guide.test.ts`(75행) — modify
  - `tests/tutorial-skill-rounds.test.ts` — new(라운드 흐름)
  - `docs/튜토리얼_훈련장_가이드.md` — 3단계 설명·흐름도·연동 컴포넌트 modify
#### Details
- `vi.useFakeTimers()`를 쓰고 `afterEach(() => vi.useRealTimers())`. 시나리오:
  1. `advanceStep(3)` 직후: `director.skillRound === 0`, 무기 `shotgun` Lv1, 스킬 재고 > 0, 표적 5마리 정지.
  2. 샷건 라운드에서 `engine.triggerWeaponSkill(now)` → `skillPhase === 'awaitingBlast'`, `step`은 아직 3, 박힌 몬스터 4마리(Lv1 상한). 기절 종료 시각으로 `engine.update(stunUntilMs, 0.016)` → 폭발 → `vi.advanceTimersByTime(500)` → `skillRound === 1`, 무기 `revolver` Lv1, 스킬 재고 > 0, 표적 5마리.
  3. 박힌 몬스터를 모두 평타로 처치(폭발 전)해도 `plungerBlasted` 없이 `skillPhase`가 통과 대기로 가고 500ms 뒤 다음 라운드(교착 없음).
  4. 리볼버 라운드 `triggerWeaponSkill` → `skillPhase === 'done'`, 1199ms 뒤에도 라운드 1, 1200ms 뒤 `skillRound === 2`(게틀링, 표적 5마리).
  5. 게틀링 라운드 스킬 → 1200ms 뒤 `step === 4`, 무기 `shotgun` Lv1, 피버 게이지 100, 표적 0.
  6. 라운드 도중 표적을 평타로 모두 잡으면(`skillPhase === 'ready'`) 같은 라운드의 표적이 다시 5마리로 배치된다(기존 "re-spawn" 동작 유지). 통과 대기 중에는 재배치되지 않는다.
  7. `stop()` 후 타이머가 돌아도 다음 라운드로 넘어가지 않는다. 스킬을 3단계가 아닌 단계에서 써도 라운드·단계가 바뀌지 않는다(기존 'a skill used outside the skill step' 유지).
  8. 오버레이: `renderToStaticMarkup(<TutorialGuideOverlay step={3} weaponKind="revolver" skillRound={1} … />)`에 `STEP 3-2/3`, 리볼버 `nameKo`, `WEAPON_ONE_LINER.revolver`가 있고 `awaitingBlast`일 때 "곧 터집니다" 문구가 있다. 옛 문구("화면의 모든 몬스터를 기절시키고")는 없다.
- `tests/tutorial-director.test.ts`의 전체 흐름 테스트: 스킬 사용 부분(41~52행)을 라운드 3번 반복 + `vi.advanceTimersByTime`으로 바꾼다(타이머를 쓰므로 그 테스트도 fake timers).
- `docs/튜토리얼_훈련장_가이드.md`: 3단계 소절을 "무기 3종 스킬 체험(샷건 → 리볼버 → 게틀링), 단타는 자유, 스킬을 쓰면 통과, 샷건은 폭발까지"로 고치고 흐름도(46행 부근 mermaid)에 라운드를 반영한다. `docs-sync` 계열 테스트가 이 문서의 단계 수·문구를 검사하면 함께 고친다.

## Acceptance Criteria
- [ ] 튜토리얼 3단계가 샷건→리볼버→게틀링 3라운드로 진행되고, 각 라운드에서 무기가 자동 교체되며 스킬이 채워져 있다.
- [ ] 단타 횟수 제한은 없고 스킬을 쓰면 통과한다. 샷건 라운드는 박힌 몬스터가 터진 뒤(또는 모두 처치된 뒤) 0.5초 후 통과한다.
- [ ] 박힌 몬스터를 폭발 전에 모두 잡아도 라운드가 막히지 않는다.
- [ ] 안내문이 라운드마다 무기 이름·한 줄 특징·지금 할 일을 보여 주고, 폭발 대기 중엔 "곧 터집니다"를 보여 준다.
- [ ] 4단계(피버)는 샷건으로 돌아와 시작하고 기존대로 수료까지 진행된다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/tutorial-skill-rounds.test.ts tests/tutorial-skill-step.test.ts tests/tutorial-director.test.ts tests/tutorial-and-guide.test.ts tests/docs-sync.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- (수동) `npm run dev` → 로비 🎓 튜토리얼 → 3단계에서 샷건(박힘·폭발) → 리볼버(칼날) → 게틀링(거품) → 4단계 피버로 넘어가는지, 안내문이 바뀌는지 확인

## Commit Message
```text
feat(tutorial): 3단계를 샷건·리볼버·게틀링 스킬 체험 라운드로

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P06-tutorial
Task: T01-weapon-skill-rounds

- I01 TutorialDirector: 라운드 상태, 무기 자동 교체와 스킬 충전, 샷건은 폭발 후 통과, 지연 통과 타이머
- I02 TutorialGuideOverlay: 무기별 이름·한 줄 특징·단계 안내, PCGamePage 연결
- I03 라운드 테스트와 튜토리얼 문서 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
