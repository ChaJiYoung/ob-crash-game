# Task: T05 물속 시각 상태

## Status: pending

## Goal
찰랑이 물속일 때 몸체가 납작해지고 병·눈이 숨겨지며 물결 링이 보이게 하고, 수면 위로 나오면 원래대로 돌아온다. 이 상태는 T02의 `isTargetSubmerged` 판정과 같은 값을 쓴다.

## Decision Summary
- D01: 물속은 타격 불가. 플레이어가 "지금 맞힐 수 없음"을 알 수 있도록 시각으로 구분한다.
- 시각 상태는 `updateTargetAnimation3D`의 옵션으로 전달한다. 기존 `isGuarding`(obi) 전달 방식과 같다.
- 명중 판정은 다시 구현하지 않는다. 시각 값은 엔진의 `isTargetSubmerged` 결과를 그대로 받는다.

## Implementation

### I01. 물속 연출 옵션을 애니메이션 함수에 추가

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `updateTargetAnimation3D`(line 908) — 옵션 타입에 `isSubmerged?: boolean` 추가, 찰랑 분기 추가; modify

#### Details
- **Signatures & Types**:
  ```ts
  // updateTargetAnimation3D 옵션 객체에 추가
  isSubmerged?: boolean;
  ```
- **Execution Flow / Logic** (`kind === 'chalang'`일 때만):
  1. `isSubmerged === true`:
     - `chalangBody.scale.y`를 `0.12`로 줄인다(납작한 물 표면). 원래 값은 `1`이다. 부드럽게 바꾸려면 `THREE.MathUtils.lerp(current, target, 0.2)`를 프레임마다 쓴다.
     - `chalangEyes.visible = false`, `chalangBottle.visible = false`.
     - `chalangRipple.visible = true`, `chalangRipple.rotation.z += 0.02`(천천히 회전, 프레임 기준이면 `time` 기반 `Math.sin(time * 4) * 0.05`로 대체).
  2. `isSubmerged === false`(또는 undefined):
     - `chalangBody.scale.y = 1`, 눈과 병 `visible = true`, `chalangRipple.visible = false`.
  3. `chalangBody`, `chalangRipple` 등이 없으면(다른 종류 또는 로드 실패) 아무것도 하지 않는다.
- **Error & Exception Handling**: `root.userData.chalangBody` 등 키가 없으면 `undefined` 검사 후 바로 반환(크래시 방지).

### I02. 게임 캔버스에서 엔진 상태 전달

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `updateTargetAnimation3D(...)` 호출부 옵션 객체(line 757 부근, 기존 `isGuarding: Boolean(target.isGuarding)` 다음 줄) — `isSubmerged: engine.isTargetSubmerged(target, time)` 추가; modify
  - `src/pc/components/MonsterHpBarLayer.tsx` :: 체력 바 대상 목록 — 물속이면 체력 바 숨김(목록 필터 확인 후 적용); modify

#### Details
- **Execution Flow**:
  1. `GameCanvas3D.tsx` 호출부 객체에 `isSubmerged: engine.isTargetSubmerged(target, time)`를 추가한다. `time`은 같은 블록에서 이미 쓰는 프레임 시각 변수다(line 747~752 참조).
  2. `MonsterHpBarLayer.tsx`는 구현 전에 체력 바를 그리는 대상 목록이 어떤 데이터에서 오는지 읽는다. 엔진의 `isTargetable`/`isTargetLanded` 같은 필터가 없다면, 물속 찰랑의 체력 바를 숨기는 조건(`isSubmerged`)을 추가한다. 필터가 이미 같은 목록을 쓰면 바꾸지 않는다(확인만 하고 결과를 커밋 메시지에 남긴다).
- **Error & Exception Handling**: `engine.isTargetSubmerged`는 P02 T02에서 public으로 추가된 메서드다. 이 Task는 T02 이후에만 빌드된다.

## Acceptance Criteria
- [ ] 물속 찰랑은 몸체가 납작하고 병·눈이 보이지 않으며 물결 링이 보인다.
- [ ] 수면 위 찰랑은 원래 모습이다.
- [ ] 물속 상태의 체력 바가 숨겨진다(또는 기존 목록이 이미 제외함을 확인했다).
- [ ] 다른 종류 몬스터의 렌더링이 바뀌지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0개
- `npx vitest run` — 전체 통과
- 수동: `npm run dev` → 테스트 랩에서 찰랑 소환 → 물속 상태에서 납작해짐과 링 확인, 수면 복귀 확인. 스크린샷을 `docs/screens/chalang-submerge-*.png`로 남긴다(선택).

## Commit Message
```text
feat(chalang): 물속 시각 상태와 체력 바 숨김을 연결

Plan: 2026-11-12-chalang-monster
Phase: P03-visuals-and-asset
Task: T05-submerged-visual-state

- I01: updateTargetAnimation3D에 isSubmerged 옵션과 찰랑 연출 추가
- I02: GameCanvas3D에서 엔진 잠수 상태 전달, 물속 체력 바 숨김
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
