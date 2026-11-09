# Task: T02 샷건 스킬 연출 (박힌 몬스터만, 폭발, 폭발 직전 진동)

## Status: pending

## Goal
스킬 연출을 엔진 결과에 맞춘다: 뚫어뻥이 **박힌 몬스터에게만** 날아가고, 기절이 끝나면 폭발 연출(파편·소리)이 나오며, 폭발 직전 0.5초는 박힌 뚫어뻥이 더 세게 떨려 "곧 터진다"가 보이게 한다(D01, D16 연출). 엔진은 P02-T01에서 끝났다.

## Decision Summary
- 지금 `triggerSkillEffect`는 화면의 **모든 착지 몬스터** 위치를 `spawnSkillEffect`에 넘긴다. 엔진이 돌려주는 `SkillExecuteResult.affectedTargets`(박힌 몬스터 + 보스)로 바꾼다.
- 폭발·사격 중 처치 연출은 엔진의 `SkillHitEvent`(`source: 'plunger'`)를 `drainSkillHitEvents()` 루프에서 처리한다(블레이드·거품과 같은 경로).
- 소리는 새 `playPlungerBlastSound`(한맥 폭발음과 구분되는 "뻥" 소리), 폭발 파편은 기존 `spawnHitEffect`를 조합한다. 새 3D 모델은 만들지 않는다.

## Implementation

### I01. 박힌 몬스터만 향하는 뚫어뻥
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `triggerSkillEffect`(308행, 핸들 타입 136행) — modify
  - `src/pc/PCGamePage.tsx` :: 스킬 발동 처리(473행 `canvasRef.current?.triggerSkillEffect?.(res.weaponKind, pIdx)`) — modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnSkillEffect`(672행) — read-only(시그니처 유지)
#### Details
- **Signatures & Types**:
  ```ts
  // GameCanvas3D 핸들
  triggerSkillEffect?: (kind: WeaponKind, playerIndex?: PlayerIndex, affected?: readonly ActiveTargetEntity[]) => void;
  ```
- **Execution Flow / Logic**: `triggerSkillEffect(kind, playerIndex = 0, affected?)`에서 `skillTargets = affected ?? (기존: 화면의 착지 몬스터 전부)`로 한다(튜토리얼·센서랩 등 `affected`를 안 넘기는 호출부가 남아 있을 수 있어 기본값을 유지). `monsterPositions`와 `noStickFlags(= t.kind === 'boss')` 계산은 그대로 둔다. `PCGamePage.tsx`의 호출은 `canvasRef.current?.triggerSkillEffect?.(res.weaponKind, pIdx, res.affectedTargets)`로 바꾼다. `res`는 `triggerWeaponSkill` 결과이고 이미 `affectedTargets`를 담고 있다.
- `spawnSkillEffect`는 `count = spec.skillPlungerCount`(P02-T01에서 `visualCountByLevel`) 발을 `targetIdx = i % N`으로 배분하고 `i >= N*2`이면 바닥으로 빗나가게 한다. 박힌 몬스터가 4~8마리면 몬스터당 2발이 박히고 나머지는 바닥에서 튕기므로 코드는 그대로 둔다. 박힌 몬스터가 0마리면(`monsterPositions.length === 0`) 모든 탄이 빗나간다(기존 동작).

### I02. 폭발 연출·소리
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `drainSkillHitEvents` 루프(573~585행) — modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnPlungerBlast` — new (`spawnHanmacBlast` 옆, 700행대)
  - `src/pc/audio/SoundSynthesizer.ts` :: `playPlungerBlastSound` — new (`playHanmacBlastSound`(466행) 옆)
#### Details
- **Signatures & Types**:
  ```ts
  /** 박힌 뚫어뻥이 터지는 순간: 호박색·빨강·흰 파편. */
  public spawnPlungerBlast(position: THREE.Vector3): void
  public playPlungerBlastSound(): void
  ```
- **Execution Flow / Logic**: `spawnPlungerBlast`는 `this.spawnHitEffect(position, '#fbbf24', 24); this.spawnHitEffect(position, '#ef4444', 14); this.spawnHitEffect(position, '#ffffff', 10);`. `playPlungerBlastSound`는 `ensureContext()`로 컨텍스트를 얻고 `triangle` 파형 주파수를 320Hz → 90Hz로 0.18초 내리는 짧은 "뽕" + 노이즈 없이 게인 0.35→0.001(한맥 소리 `sawtooth` 240→45Hz와 구분). 컨텍스트가 없으면 조용히 반환.
  `GameCanvas3D`의 `drainSkillHitEvents` 루프에서 `if (ev.source === 'blade') particles.spawnSlashMark(pos);` 아래에 `if (ev.source === 'plunger') { particles.spawnPlungerBlast(pos); if (canSound || ev.killed) soundSynth.playPlungerBlastSound(); }`를 추가한다. 같은 루프의 일반 처리(`playTargetBurst`, 피격 플래시)는 폭발 피해로 **살아남은** 몬스터에게도 그대로 적용된다(`ev.killed === false`일 때만 플래시). 박힌 채 평타로 죽은 경우(`killed: true`, 피해 없음)도 같은 이벤트라 폭발이 터지는 연출이 나온다(D16).
- **함정**: 한 번에 여러 마리가 같은 프레임에 터지면 소리가 겹쳐 커진다. 루프에서 이미 쓰는 `canSound`(70ms 간격 제한)를 그대로 쓰고, 큰 몬스터(`bigKill`)는 항상 소리를 내는 기존 규칙을 따른다.

### I03. 폭발 직전 진동과 테스트
- Related Files:
  - `src/pc/three/plungerWarning.ts` :: `isPlungerBlastImminent`, `PLUNGER_BLAST_WARNING_MS` — new
  - `src/pc/components/GameCanvas3D.tsx` :: 몬스터 애니메이션 옵션 구성(730행 부근 `updateTargetAnimation3D` 호출) — modify
  - `src/pc/three/TargetModels3D.ts` :: `TargetAnimationOptions`(891행), `updateTargetAnimation3D`의 `plungerStuckGroup` 블록(931행) — modify
  - `tests/plunger-warning.test.ts` — new
#### Details
- **Signatures & Types**:
  ```ts
  export const PLUNGER_BLAST_WARNING_MS = 500;
  /** 박힌 몬스터가 곧 터지는가(남은 시간이 0 초과 500ms 이하). */
  export function isPlungerBlastImminent(plungerBlast: unknown, stunUntilMs: number | undefined, nowMs: number): boolean
  // TargetAnimationOptions에 추가
  plungerBlastImminent?: boolean;
  ```
- **Execution Flow / Logic**: `plungerBlast`가 있고 `stunUntilMs - nowMs`가 `0 < x <= 500`이면 `true`. `GameCanvas3D`가 몬스터 애니메이션 옵션에 `plungerBlastImminent: isPlungerBlastImminent(target.plungerBlast, target.stunUntilMs, time)`를 추가한다(`time`은 같은 위치에서 `isStunned`에 쓰는 값과 같은 시계 — 이 코드는 `target.stunUntilMs > time`으로 비교하고 있으므로 같은 `time` 변수를 쓴다). `updateTargetAnimation3D`의 `plungerStuckGroup`에서 `isStunned`일 때 `rotation.z = Math.sin(elapsedSec * (imminent ? 90 : 45)) * (imminent ? 0.25 : 0.12)`로 바꾼다.
- 테스트: 남은 시간 501ms → false, 500ms/1ms → true, 0ms 이하 → false, `plungerBlast` 없음 → false, `stunUntilMs` 없음 → false.

## Acceptance Criteria
- [ ] 스킬을 쓰면 뚫어뻥이 박힌 몬스터(최대 4/5/6/8마리)와 보스 쪽으로만 날아간다. 박힌 몬스터가 없으면 모두 바닥에서 튕긴다.
- [ ] 기절이 끝나면 박힌 자리에서 파편과 소리가 나는 폭발이 한 번 터지고, 박힌 채 죽을 때도 같은 연출이 나온다.
- [ ] 폭발 직전 0.5초 동안 박힌 뚫어뻥이 더 빠르고 크게 떨린다.
- [ ] 튜토리얼·센서랩에서도 스킬 연출이 깨지지 않는다(`affected` 미전달 기본값).
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/plunger-warning.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- (수동) `npm run dev` → 샷건으로 몬스터가 5마리 이상 모인 곳에서 스킬: 4마리만 박히는지, 약 2초 뒤 폭발하는지, 폭발 직전 떨림이 커지는지 확인

## Commit Message
```text
feat(shotgun): 스킬 연출을 박힌 몬스터 중심으로 바꾸고 폭발 이펙트와 소리 추가

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P02-shotgun-skill
Task: T02-plunger-visuals

- I01 triggerSkillEffect가 affectedTargets만 사용
- I02 spawnPlungerBlast·playPlungerBlastSound와 SkillHitEvent 'plunger' 처리
- I03 폭발 직전 0.5초 진동 가속과 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
