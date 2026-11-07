# Task: T03 엔진 사건 알림과 TutorialDirector

## Status: pending

## Goal
튜토리얼 단계 진행 규칙을 엔진 밖 `TutorialDirector` 하나로 옮긴다(D31-2). 엔진은 일어난 일(처치, 돌파, 스킬 사용, 피버 시작·종료)을 사건으로 알리기만 하고, 디렉터가 그 사건을 듣고 단계를 넘기고 단계별 표적을 배치한다. 엔진의 사격·처치·이동 코드에서 튜토리얼 코드가 사라진다. 튜토리얼 진행 순서와 화면 문구는 바뀌지 않는다.

## Decision Summary
- 사건 알림은 동기 호출(리스너)이다. 지금 튜토리얼 판단이 사격·update 도중 즉시 일어나므로, 프레임 뒤로 미루면 같은 프레임 안의 결과(예: 2단계 병 재배치 전에 다음 이동)가 달라진다.
- 사건은 앞으로 2인(P02)에서도 쓰므로 처음부터 `playerIndex`를 담는다(1인은 0).
- 튜토리얼 표적 배치 데이터(각 단계의 종류·각도·거리)도 디렉터로 옮긴다. 엔진에는 범용 `placeTargets(list)`만 남긴다.

## Implementation

### I01. 엔진 사건

- Related Files:
  - `src/pc/engine/engineEvents.ts` :: `EngineEvent`, `EngineEventListener`; new
  - `src/pc/engine/BeerCrusherEngine.ts` :: `addEventListener`, `emit`(private), 처치·돌파·스킬·피버 지점, `placeTargets`(new); modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type EngineEvent =
    | { type: 'targetKilled'; target: ActiveTargetEntity; playerIndex: PlayerIndex; nowMs: number }
    | { type: 'targetBreached'; target: ActiveTargetEntity; nowMs: number }   // 이미 activeTargets에서 빠진 뒤
    | { type: 'skillUsed'; playerIndex: PlayerIndex; result: SkillExecuteResult; nowMs: number }
    | { type: 'feverStarted'; playerIndex: PlayerIndex; nowMs: number }
    | { type: 'feverEnded'; playerIndex: PlayerIndex; nowMs: number };
  export type EngineEventListener = (e: EngineEvent) => void;

  // BeerCrusherEngine
  public addEventListener(fn: EngineEventListener): () => void; // 해제 함수 반환
  private emit(e: EngineEvent): void;
  /** 범용 배치: 기존 표적을 모두 지우고 주어진 표적을 놓는다(id는 엔진 카운터로 붙인다). */
  public placeTargets(list: Omit<ActiveTargetEntity, 'id' | 'breached'>[], idPrefix: string): ActiveTargetEntity[];
  ```
- **emit 지점**:
  1. 처치: `shootAtInner`의 주 표적 처치(지금 2210행 블록 자리), 관통 처치, `applySkillDamage` 처치 — 셋 다 `handleMonsterKilled` 직후 `targetKilled`.
  2. 돌파: `update`의 `breachEffect === 'remove'` 경로에서 제거한 뒤 `targetBreached`(T02에서 남겨 둔 튜토리얼 단계별 재배치 코드는 삭제).
  3. 스킬: `triggerWeaponSkill`에서 `activated`면 `skillUsed`(지금 2515행의 단계 진행 삭제).
  4. 피버: `activateFever` 성공 시 `feverStarted`. `update`에서 피버가 활성→비활성으로 바뀐 프레임에 `feverEnded`(플레이어별 직전 상태를 기억해 비교). 지금 1246행 "튜토리얼 4단계 완료" 판정은 삭제.
- 엔진에서 삭제: `tutorialStep`, `tutorialCompleted`, `advanceTutorialStep`, `spawnTutorialSkillTargets`, `spawnTutorialFeverEnemies`, `startTutorialMode`의 표적 배치 부분. `startTutorialMode()`는 모드 전환·초기화만 남긴다.

### I02. TutorialDirector

- Related Files:
  - `src/pc/tutorial/TutorialDirector.ts` :: `TutorialDirector`; new
  - `src/pc/PCGamePage.tsx` :: 튜토리얼 시작·종료, `engine.tutorialStep` 읽는 곳, `spawnTutorialFeverEnemies` 호출부; modify
  - `src/pc/hudSnapshot.ts` :: `tutorialStep` 출처; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export class TutorialDirector {
    public step: TutorialStep = 1;
    public completed = false;
    constructor(engine: BeerCrusherEngine, onStepChange?: (step: TutorialStep) => void);
    /** engine.startTutorialMode() 후 부른다. 1단계 표적 배치 + 리스너 등록. */
    public start(nowMs: number): void;
    /** 리스너 해제. exitTutorialMode 때 부른다. */
    public stop(): void;
  }
  ```
- **단계 데이터**(엔진에서 그대로 옮김): 1단계 필굿 3개(각도 −0.22/0/0.22, 거리 10, 속도 0, `hitRadiusM` 1.1, 점수 50), 2단계 병 1개(거리 14, 정면, 속도 1.4, 병 스펙), 3단계 스킬 표적 5개(필굿·카스·필굿·카스·필굿, 각도 −0.3~0.3, 거리 12/13, 속도 0) + `refillSkillInstant()`, 4단계 피버 게이지 100 강제 + 표적 비움, 피버 시작 시 6개(필굿·카스·오비·한맥·병·카스, 각도 −0.35~0.35, 거리 12/14, 속도 1.6).
- **사건 → 동작**(지금 엔진 코드의 의미 그대로):
  - `targetKilled`: 1단계 && 필드 비면 → 2단계. 2단계 && 필드 비면 → 3단계. 3단계 && 필드 비면 → 스킬 표적 다시 배치(스킬로만 끝남). 4단계 && 필드 비면 → 완료.
  - `targetBreached`: 2단계 → 같은 표적을 거리 14, 정면으로 되돌려 다시 넣는다. 4단계 && 필드 비면 → 완료.
  - `skillUsed`: 3단계 → 4단계.
  - `feverStarted`: 4단계 → 피버 표적 6개 배치(지금 PC 페이지·캔버스 두 곳에 있던 호출을 대체).
  - `feverEnded`: 4단계 && 필드 비고 게이지 0 → 완료.
- PC 페이지: 튜토리얼 시작에서 `directorRef.current = new TutorialDirector(engine, setTutorialStep); directorRef.current.start(now)`, 종료에서 `stop()`. `engine.tutorialStep`을 읽던 곳은 디렉터 값. HUD 스냅샷 `tutorialStep`은 페이지가 넘겨 준 디렉터 값으로.

### I03. 테스트

- Related Files:
  - `tests/tutorial-director.test.ts`; new
  - `tests/tutorial-and-guide.test.ts`, `tests/tutorial-skill-step.test.ts`; modify — `engine.tutorialStep`·`advanceTutorialStep`을 쓰는 곳을 디렉터로

#### Details
- 실제 엔진 + 디렉터로 1→2→3→4→완료를 사격·스킬·피버로 끝까지 진행(지금 테스트 시나리오와 같은 순서).
- 2단계 병이 방어선을 넘으면 거리 14로 돌아옴.
- 3단계에서 사격으로 표적을 다 잡으면 다시 배치되고 단계는 3 유지.
- 엔진 파일에 `tutorialStep` 문자열 0건.

## Acceptance Criteria
- [ ] 튜토리얼 진행이 지금과 같다.
- [ ] 엔진의 사격·처치·이동 코드에 튜토리얼 코드가 없다.

## Validation
- `npx vitest run tests/tutorial-director.test.ts tests/tutorial-and-guide.test.ts tests/tutorial-skill-step.test.ts` — 통과
- `grep -c "tutorialStep\|isTutorialMode" src/pc/engine/BeerCrusherEngine.ts` — getter 정의 1곳만
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 튜토리얼 1~4단계를 폰·마우스로 끝까지

## Commit Message
```text
refactor(tutorial): TutorialDirector drives steps from engine events

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T03-tutorial-director

- Engine emits targetKilled, targetBreached, skillUsed, feverStarted and feverEnded
- TutorialDirector owns step layouts and step changes; engine keeps no tutorial step code
- Same tutorial flow as before

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
