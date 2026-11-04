# Task: T03 Obi Guard and Bottle Split

## Status: done

## Goal
오비를 타이밍을 노려 쏘는 방패병으로, 병맥주를 깨면 작은 병 2마리로 나뉘는 탱커로 만든다.

## Decision Summary
- D18:
  - 오비: 방패 2초 들고 1초 내림. 내렸을 때만 피해. 개체별 시작 시점이 다름. 피버와 스킬은 뚫음.
  - 병맥주: 모델 1.2배. 깨지면 작은 병 2마리(체력 1, 더 빠름, 추가 분열 없음).
- 판정 범위는 바꾸지 않는다. 사용자가 병이 얇아 조준하기 어렵다고 해서 모델만 키운다.
- 튜토리얼과 샌드박스의 동작은 바꾸지 않는다.

## Implementation

### I01. 상수와 엔티티 필드

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.monsters` — 수치 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `EngineShootResult`, `applyMonsterTraits` — 필드 추가; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  // GAME_TUNING.monsters에 추가
  obi: { guardUpMs: 2000, guardDownMs: 1000 },
  bottle: {
    bigScale: 1.2,
    splitCount: 2,
    splitOffsetRad: 0.1,
    childHp: 1,
    childSpeedMps: 2.2,
    childHitRadiusM: 0.85,
    childScale: 0.5,
    childKillBonus: 40,
    childBaseY: 0.35,
  },
  ```
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity 추가
  guardPhaseMs?: number;
  isGuarding?: boolean;
  isSplitChild?: boolean;
  modelScaleMult?: number;
  // EngineShootResult 추가
  shieldBlocked?: boolean;

  private applyMonsterTraits(entity: ActiveTargetEntity): void;
  ```
- **Execution Flow / Logic**: `spawnNextTarget`과 `spawnBossMinionWave`가 `applyMonsterTraits`를 호출한다.
  - `obi`: `guardPhaseMs = this.dropRng() * (guardUpMs + guardDownMs)`
  - `bottle`: `modelScaleMult = bigScale`
- **함정**: 보상 카드와 무기 카드의 `kind`가 `'obi'`다. 방패는 `guardPhaseMs`가 있는 대상에만 적용하고, `kind`만으로 판단하지 않는다. 기존 테스트가 직접 만든 오비도 이 필드가 없어 영향을 받지 않는다.

### I02. 오비 방패

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `updateGuards`, `update`, `shootAt` — 방패 판정; modify

#### Details
- **Execution Flow / Logic**:
  1. `update`의 카드 대기 검사 뒤에 호출한다.
     ```typescript
     private updateGuards(nowMs: number): void {
       const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
       const cycle = guardUpMs + guardDownMs;
       for (const t of this.activeTargets) {
         if (t.guardPhaseMs === undefined) continue;
         const stunned = t.stunUntilMs !== undefined && t.stunUntilMs > nowMs;
         t.isGuarding = !stunned && (nowMs + t.guardPhaseMs) % cycle < guardUpMs;
       }
     }
     ```
  2. `shootAt`의 표준 피해 경로 앞:
     ```typescript
     if (target.isGuarding && !isFever) {
       return { fired: true, grade: result.grade, target, hitTargets: [target], killed: false, shieldBlocked: true, weaponKind, weaponLevel };
     }
     ```
     탄약은 이미 소모되었다. 점수와 피버는 주지 않는다.
  3. 리볼버 관통 대상 필터에 `(!t.isGuarding || isFever)`를 추가한다.
  4. `triggerWeaponSkill`은 방패를 검사하지 않는다. 스킬은 방패를 뚫는다.

### I03. 병맥주 분열

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `handleMonsterKilled`, `splitBottle` — 분열; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private splitBottle(parent: ActiveTargetEntity): void;
  ```
- **Execution Flow / Logic**:
  1. `handleMonsterKilled`의 일반 몬스터 처리에서, 튜토리얼과 샌드박스가 아니고 `kind === 'bottle'`이며 `!isSplitChild`이면 호출한다. 게임이 끝난 상태와 보스 처치 분기는 앞에서 이미 반환한다.
  2. 양옆으로 2마리를 만든다(`theta ± splitOffsetRad`, 반경은 부모 값).
     ```typescript
     {
       id: `bottle_child_${this.targetCounter}`,
       kind: 'bottle',
       hp: childHp, maxHp: childHp,
       radiusM: parent.radiusM, thetaRad, initialThetaRad: thetaRad,
       x: Math.sin(thetaRad) * parent.radiusM, z: -Math.cos(thetaRad) * parent.radiusM,
       speedMps: childSpeedMps * waveSpeedScale, // P04-T01의 웨이브 속도 배율
       hitRadiusM: childHitRadiusM,
       killBonusScore: childKillBonus,
       breached: false,
       isSplitChild: true,
       modelScaleMult: childScale,
       customBaseY: childBaseY,
     }
     ```
  3. `spawnedInWave`를 늘리지 않는다. 처치 수(`killedInWave`, `cardKillCount`)에는 들어간다. `getWaveProgress`의 진행률은 이미 100으로 제한되고 남은 수도 0 아래로 내려가지 않는지 확인한다.
  4. 웨이브 완료는 몬스터가 0이어야 하므로 작은 병까지 잡아야 끝난다.

### I04. 모델과 피드백

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `updateTargetAnimation3D`, `TargetAnimationOptions` — 방패 메시; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 메시 생성, 애니메이션 옵션, `playShotFx` — 크기와 막힘 표시; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `playShieldBlockSound` — 막힘 소리; modify
  - `src/pc/PCGamePage.tsx` :: `handleShootEvent` — 막힘 처리; modify

#### Details
- **Execution Flow / Logic**:
  1. 오비 모델에 `guardShieldMesh`를 추가한다. `BoxGeometry(0.62, 0.9, 0.06)`, `MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })`, 둘 다 캐시로 공유한다. 라벨 앞쪽에 두고, `userData.guardShieldMesh`에 저장한다. 앵커 그룹이 재질을 컴파일하므로 예열 코드는 고치지 않는다.
  2. `updateTargetAnimation3D`: `options.isGuarding`으로 방패를 표시한다. 내려간 상태가 분명히 보이게 `visible = false` 또는 아래로 내린다.
  3. `GameCanvas3D` 메시 생성: `target.modelScaleMult`가 있으면 적용한다. P04-T05의 대왕도 같은 코드를 쓴다.
     ```typescript
     if (target.modelScaleMult) {
       mesh.userData.inner.scale.multiplyScalar(target.modelScaleMult);
       mesh.userData.baseScale *= target.modelScaleMult;
     }
     ```
  4. `playShotFx`:
     - `result.shieldBlocked`이면 `spawnHitEffect(targetPos, '#e2e8f0', 2)`만 내고 플래시와 타격음은 생략한다.
     - 작은 병 처치는 `HIT_PARTICLE_COUNTS.kill`로 터뜨린다. 큰 병만 `triggerBottleCrash`를 쓴다.
  5. `SoundSynthesizer.playShieldBlockSound`: 짧고 높은 금속음("팅")을 새로 만든다. `playMetallicHitSound`와 구분되게 한다.
  6. `handleShootEvent`: `result.shieldBlocked`이면 `playShieldBlockSound`를 재생하고 `playHit`과 판정 배너는 생략한다.

### I05. 테스트

- Related Files:
  - `tests/monster-traits.test.ts` — 시나리오 추가; modify

#### Details
- 오비 방패가 올라간 시각에 쏘면 체력이 그대로이고 `shieldBlocked === true`, 점수·피버가 없으며 탄약은 줄어든다.
- 내려간 시각에 쏘면 피해가 들어간다.
- 피버 중과 스킬은 방패를 뚫는다.
- 기절하면 방패가 내려간다.
- 여러 오비의 위상이 다르다(`dropRng`를 순차 값으로 지정).
- 보상 카드(`kind: 'obi'`)와 직접 만든 오비는 방패가 없다.
- 리볼버 관통이 방패 든 오비를 건너뛴다.
- 큰 병을 잡으면 작은 병 2마리가 양옆에 나오고, 체력과 속도가 맞다.
- 작은 병을 잡으면 더 나뉘지 않는다.
- 스킬로 큰 병을 잡아도 나뉜다.
- 큰 병과 작은 병까지 모두 잡아야 웨이브가 끝난다.
- 튜토리얼과 샌드박스의 병은 나뉘지 않고, 오비는 방패가 없다.
- 작은 병의 모델 크기가 큰 병보다 작다(`createTargetMesh3D` + 배율 적용 함수 분리 시 테스트).

## Acceptance Criteria
- [x] 오비가 방패를 들었다 내렸다 하고, 내렸을 때만 피해가 들어간다.
- [x] 막히면 "팅" 소리와 불꽃으로 바로 알 수 있다.
- [x] 피버와 스킬은 방패를 뚫는다.
- [x] 큰 병을 깨면 작은 병 2마리가 나와 달려온다.
- [x] 큰 병이 전보다 눈에 잘 보인다.

## Validation
- `npx vitest run tests/monster-traits.test.ts tests/three-stage-and-models.test.ts tests/tutorial-and-guide.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run dev`로 방패 표시와 병 분열 확인

## Commit Message
```text
feat(monsters): add obi shield timing and bottle splitting

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T03-obi-guard-and-bottle-split

- Block obi damage while its shield is raised
- Let fever and skills pierce shields
- Split large bottles into two small bottles
- Add shield visuals and block feedback
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(monsters): add obi shield timing and bottle splitting
