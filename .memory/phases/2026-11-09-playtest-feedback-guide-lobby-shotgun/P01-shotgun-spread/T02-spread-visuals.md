# Task: T02 샷건 평타 퍼짐 연출

## Status: pending

## Goal
샷건을 쏠 때 탄이 지금의 약 2배로 넓게 퍼지고, 추가 명중이 일어난 몬스터 쪽으로도 탄이 날아가게 해서 "퍼진 곳에 있으면 맞는다"가 눈으로 보이게 한다(D05 연출, D17). 엔진은 T01에서 이미 끝났고 이 Task는 화면만 바꾼다.

## Decision Summary
- 탄(펠릿)은 `spec.pelletCount`발(3/4/5/6). 지금은 주 대상 한 점을 중심으로 가로 간격 0.28씩 퍼진다. 새 기준은 간격 **0.56**(2배) + 추가 대상이 있으면 일부 탄을 그 대상 위치로 보낸다.
- 탄 배분은 THREE에 의존하지 않는 **순수 함수**로 만들어 테스트한다(`src/pc/three/shotgunPellets.ts`). 추적선(tracer)은 주 대상 한 줄만 유지한다.
- 십자선 UI(`CrosshairOverlay`의 펠릿 링 104px)는 바꾸지 않는다. 퍼짐 범위는 눈에 보이는 링이 아니라 탄이 실제로 날아가는 곳으로 보여 준다(링을 그리려면 화면 비율·세로 0.85 보정이 필요해 이번 범위에서 뺀다).

## Implementation

### I01. 탄 배분 순수 함수와 파티클 연결
- Related Files:
  - `src/pc/three/shotgunPellets.ts` :: `computeShotgunPelletTargets`, `SHOTGUN_PELLET_SPREAD_STEP` — new
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnWeaponProjectile` (589행 부근, 샷건 분기 609~632행) — modify
#### Details
- **Signatures & Types**:
  ```ts
  export interface Vec3Like { x: number; y: number; z: number }
  /** 탄 가로 간격. 지금(0.28)의 2배. */
  export const SHOTGUN_PELLET_SPREAD_STEP = 0.56;
  /** 세로 흔들림 폭(지금 0.25의 2배). */
  export const SHOTGUN_PELLET_JITTER_Y = 0.5;
  /**
   * 탄마다 날아갈 목표점. 반환 길이 = pelletCount.
   * extras가 없으면 모든 탄이 primary 주변에 가로로 퍼진다(탄 i의 x 오프셋 = (i - (n-1)/2) * step).
   * extras가 k개(1~3)이면 i % (k+1) === 0인 탄은 primary 주변, 나머지 탄은 extras[(i % (k+1)) - 1] 근처(오프셋의 반만)로 보낸다.
   * rand는 세로 흔들림용 [0,1) 난수 함수(테스트에서 고정값 주입).
   */
  export function computeShotgunPelletTargets(
    primary: Vec3Like,
    extras: readonly Vec3Like[],
    pelletCount: number,
    rand?: () => number
  ): Vec3Like[]
  ```
- **Execution Flow / Logic**:
  1. `extras.length === 0`: 모든 탄 `target = { x: primary.x + (i-(n-1)/2)*STEP, y: primary.y + (rand()-0.5)*JITTER_Y, z: primary.z }`.
  2. `k = extras.length`: `slot = i % (k+1)`; `slot === 0`이면 위와 같고, 아니면 `base = extras[slot-1]`에 `x 오프셋 = ((i - (n-1)/2) * STEP) * 0.5`, 세로 흔들림은 같은 폭.
  3. 호출부에서 `extras`는 최대 3개이고 `pelletCount`는 3 이상이므로 모든 대상이 최소 한 발씩 받도록 `slot` 분배가 순환한다(예: n=4, k=2 → slot 0,1,2,0).
- `ParticleEffects3D.spawnWeaponProjectile`의 시그니처에 선택 파라미터를 **끝에** 추가한다: `(origin, targetPos, kind, level = 1, tracerColor?, extraTargetPositions?: readonly THREE.Vector3[])`. 샷건 분기에서 `const targets = computeShotgunPelletTargets(targetPos, extraTargetPositions ?? [], pelletCount)`를 구해 각 탄의 `targetPos`로 쓴다(기존 `spreadTarget` 계산 삭제). `spawnTracerBeam(origin, targetPos, ...)`은 그대로. 동시 투사체 상한(`this.projectiles.length >= 32`)과 `maxLifeSec: 0.45`는 유지한다. 리볼버·게틀링 분기는 건드리지 않는다.

### I02. 화면 호출부에서 추가 대상 위치 전달
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `playShotFx` (221행), `getPiercedTargets` (90행), `targetMeshMapRef` — modify
#### Details
- `playShotFx` 안 `if (result.grade !== 'MISS' && result.target)` 블록에서 이미 `getPiercedTargets(result).forEach(...)`가 추가 대상에 플래시·파편을 그린다(리볼버 관통과 같은 코드, 변경 없음). 샷건일 때만 같은 목록으로 위치 배열을 만든다:
  ```ts
  const extraPositions: THREE.Vector3[] = weaponState.weaponKind === 'shotgun'
    ? getPiercedTargets(result).map((rear) => {
        const m = targetMeshMapRef.current.get(rear.id);
        return (m ? m.position.clone() : new THREE.Vector3(rear.x, 0.8, rear.z)).add(new THREE.Vector3(0, 0.35, 0));
      })
    : [];
  ```
  이 배열을 `particlesRef.current.spawnWeaponProjectile(muzzlePos, targetPos, weaponState.weaponKind, weaponState.weaponLevel, beamColor, extraPositions)`로 넘긴다. 배열 생성은 `result.grade !== 'MISS' && result.target` 블록 밖에서 쓰이므로 `let extraPositions` 선언을 블록 바깥(`targetPos` 선언 옆)에 두고, 맞았을 때만 채운다.
- **함정**: 추가 대상이 이번 발에 죽었으면 `targetMeshMapRef`에서 이미 제거됐을 수 있다. 메시가 없으면 몬스터 좌표(`rear.x`, `rear.z`)로 대체해 탄이 허공으로 가지 않게 한다(위 코드의 fallback).

### I03. 테스트
- Related Files:
  - `tests/shotgun-pellet-targets.test.ts` :: 순수 함수 테스트 — new
#### Details
- `rand`를 `() => 0.5`로 고정하면 세로 흔들림이 0이다. 케이스: ① extras 없음 → n개이고 x가 중앙 기준 대칭(`(i-(n-1)/2)*0.56`), 모든 z가 primary.z; ② extras 2개·n=4 → slot 0,1,2,0이라 1번 탄은 extras[0] 근처, 2번 탄은 extras[1] 근처, 0·3번 탄은 primary 근처; ③ extras 3개·n=3(Lv1에서는 extras 최대 2개이지만 함수는 일반화) → 탄 수가 더 적어도 `length === pelletCount`; ④ 간격 상수가 0.56이다(`SHOTGUN_PELLET_SPREAD_STEP`); ⑤ `pelletCount === 0`이면 빈 배열.

## Acceptance Criteria
- [ ] 샷건 탄이 지금보다 가로로 2배 넓게 퍼진다(간격 0.56).
- [ ] 추가 명중이 난 몬스터 쪽으로도 탄이 날아간다. 추가 대상이 없으면 이전과 같은 모양(넓어진 퍼짐)이다.
- [ ] 리볼버·게틀링 사격 연출과 추적선은 그대로다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/shotgun-pellet-targets.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- (수동) `npm run dev` 후 샷건으로 몬스터가 뭉친 곳을 쏴서 탄이 주변 몬스터에도 날아가는지 확인

## Commit Message
```text
feat(shotgun): 평타 탄 퍼짐 2배와 추가 명중 대상으로 날아가는 연출

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P01-shotgun-spread
Task: T02-spread-visuals

- I01 shotgunPellets 순수 함수와 spawnWeaponProjectile 연결(간격 0.56)
- I02 playShotFx가 추가 대상 위치를 전달
- I03 탄 배분 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
