# Task: T01 guard-and-regression-test

## Status: done

## Goal
매 프레임 호출되는 `DraftTapGun3D.setSlotOffset`이 같은 값이면 위치를 덮어쓰지 않게 해서, 프레임 간격이 흔들려도 총 x 위치가 목표값으로 수렴·안정되게 한다. 임시 디버그 코드는 제거한다.

## Decision Summary
- 수정은 `setSlotOffset` 안 가드 한 곳(D02). 호출부 `GameCanvas3D.tsx:780`의 `syncGuns()`는 총 생성/제거도 담당하므로 건드리지 않는다.
- 디버그 변경(`PCGamePage.tsx`, `DraftTapGun3D.ts`의 `[DEBUG_*]`)은 전부 되돌린다(D03). 현재 working tree의 두 파일 변경은 100% 디버그 코드다.

## Implementation

### I01. 디버그 변경 되돌리기
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `onAim` 콜백 — `[DEBUG_AIM]` 로그 4줄 제거; modify
  - `src/pc/three/DraftTapGun3D.ts` :: `setSlotOffset`, `updateAim` — `(this as any)` 디버그 블록 제거; modify

#### Details
- **Execution Flow / Logic**:
  1. 두 파일의 변경은 디버그뿐이므로 `git checkout -- src/pc/PCGamePage.tsx src/pc/three/DraftTapGun3D.ts`로 HEAD 상태로 복구한다.
  2. `git diff`가 비어 있고 `grep -rn "DEBUG_" src`가 0건임을 확인한다.
  3. 함정: I02 편집은 반드시 복구 이후에 한다(복구가 가드를 지운다).

### I02. setSlotOffset / setPlayerColor 가드
- Related Files:
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D.setSlotOffset` (현재 ~425행) — 같은 값이면 return; modify
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D.setPlayerColor` — 같은 hex면 return; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private slotOffsetX = 0;            // 기존 필드 재사용
  private playerColorHex: string | null | undefined = undefined; // 신규 필드: 마지막으로 적용한 색 (undefined = 아직 적용 안 함)

  public setSlotOffset(offsetX: number): void
  public setPlayerColor(hex: string | null): void
  ```
- **Execution Flow / Logic**:
  1. `setSlotOffset`: 맨 앞에 `if (this.slotOffsetX === offsetX && this.hasSlotOffsetApplied) return;` 대신, 생성 직후 첫 호출도 정상 적용돼야 하므로 `slotOffsetX` 초기값 0과 첫 호출 `offsetX=0`이 같아도 문제 없다: 생성자가 `group.position.copy(basePosition)`(x=0)로 이미 맞춰 둔다. 따라서 `if (this.slotOffsetX === offsetX) return;` 하나로 충분하다.
  2. 값이 다를 때만 기존 3줄(`slotOffsetX`, `basePosition.x`, `group.position.x`) 실행. 이때 위치 점프(슬롯 변경 시 1회)는 기존 동작과 같다.
  3. `setPlayerColor`: `if (this.playerColorHex === hex) return;` 후 `this.playerColorHex = hex;` 를 저장하고 기존 로직 실행.
  4. 함정: `group.position.x`를 목표값으로 되돌리는 코드는 `updateAim`이 따로 담당한다. `updateAim`은 수정하지 않는다.

### I03. 회귀 테스트
- Related Files:
  - `tests/gun-slot-offset-jitter.test.ts` :: `describe('DraftTapGun3D slot offset')` — new

#### Details
- 테스트 환경: 이 repo의 vitest(`npm test`)에서 `new DraftTapGun3D()`가 Node에서 생성된다(시뮬레이션으로 확인됨). import 경로 `../src/pc/three/DraftTapGun3D`.
- 케이스:
  1. 매 프레임 `setSlotOffset(0)` → `updateAim({yaw:0,pitch:0},{aimX:1,aimY:0},dt,false)`를 120프레임 반복, dt는 `i%2 ? 1/90 : 1/40`. 마지막 60프레임 x의 (max-min) < 1e-6 이고, 마지막 x가 0.04에 1e-3 이내.
  2. dt 일정(1/60)일 때도 마지막 x가 0.04에 1e-3 이내(가드 없으면 0.012에 멈춰 실패해야 함).
  3. 다른 값 `setSlotOffset(0.5)`는 적용된다: 호출 직후 `group.position.x === 0.5`.
  4. `setPlayerColor('#ff0000')` 두 번 호출해도 `ringMesh.visible`이 true로 유지되고, `setPlayerColor(null)` 후 false.
- 가드를 임시로 빼면 케이스 1·2가 실패하는지 한 번 확인한다(테스트 유효성).

## Acceptance Criteria
- [ ] `grep -rn "DEBUG_" src`가 0건이다
- [ ] 새 테스트가 통과하고, 가드 제거 시 케이스 1·2가 실패한다
- [ ] 전체 `npm test`와 `npx tsc --noEmit`이 통과한다

## Validation
- `npx vitest run tests/gun-slot-offset-jitter.test.ts` — 4개 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
fix(pc): 무기가 가만히 있어도 떨리는 현상 수정 (setSlotOffset 중복 호출 가드)

Plan: 2026-11-10-gun-jitter-fix
Phase: P01-gun-jitter
Task: T01-guard-and-regression-test

- I01: 임시 디버그 로그 제거
- I02: setSlotOffset/setPlayerColor가 같은 값이면 건너뛰어 매 프레임 위치 리셋 방지
- I03: dt가 흔들려도 총 x 위치가 안정되는지 회귀 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 786581e
