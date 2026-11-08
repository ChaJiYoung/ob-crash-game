# Task: T01 마우스 보조 입력 폐기

## Status: pending

## Goal
폰으로 혼자 플레이할 때 마우스를 움직이거나 클릭해도 조준경·사격에 영향이 없게 한다. 마우스는 로비에서 마우스로 참여한 슬롯(`input === 'mouse'`)만 조종한다.

## Decision Summary
- 결정 문서: [2026-11-08-fever-ammo-and-aim-source](../../../decisions/2026-11-08-fever-ammo-and-aim-source.md) D05(마우스 보조 입력 완전 폐기), D06(`/sensor-test`에서 폰이 없으면 마우스로 조준 불가, 예외 없음).
- 원인: `src/pc/coopSlots.ts`의 `getMouseBinding`이 마우스 슬롯이 없어도 `playerCount === 1`이면 `0`을 돌려줘서, `PCGamePage.tsx`의 `MouseAdapter`(약 273행)가 폰이 쓰는 플레이어 0의 조준을 `mousemove`마다 덮어썼다.
- 함정: `MouseAdapter.sink()`가 `null`이면 `onMove/onLeftDown/onLeftUp/onRightClick`이 모두 조용히 무시된다(`src/pc/input/MouseAdapter.ts`). 따라서 `getMouseBinding`만 고치면 조준·사격·우클릭 스킬이 한꺼번에 막힌다. HTML 버튼(메뉴·일시정지·결과)의 `onClick`은 이 경로를 쓰지 않아 영향이 없다.

## Implementation

### I01. `getMouseBinding` 보조 분기 삭제
- Related Files:
  - `src/pc/coopSlots.ts` :: `getMouseBinding` — `playerCount` 인자와 `playerCount === 1` 분기 삭제; modify
  - `src/pc/PCGamePage.tsx` :: `MouseAdapter` 생성부(약 273~277행) — 호출 인자에서 `engine.players.length` 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /**
   * 마우스 어댑터가 어느 플레이어 처리부를 조종할지 결정.
   * 마우스로 참여한 슬롯이 있으면 그 플레이어, 없으면 null(게임 중 마우스 조준·사격 비활성).
   * 폰 혼자일 때 마우스를 보조 입력으로 쓰던 동작은 폐기했다(폰 조준을 뺏었다).
   * HTML 버튼 클릭은 영향 없다.
   */
  export function getMouseBinding(
    slots: SlotPair,
    map: Partial<Record<PlayerSlot, PlayerIndex>>
  ): PlayerIndex | null {
    return getMouseIndex(slots, map);
  }
  ```
- **Execution Flow / Logic**: 함수 본문은 `getMouseIndex` 결과를 그대로 돌려준다. `getMouseBinding`이 쓰이는 곳은 `PCGamePage.tsx`뿐이다(`grep -rn getMouseBinding src`). 함정: `playerCount`를 지우면 `PCGamePage.tsx`의 호출부 인자 개수도 맞춰야 `tsc`를 통과한다.

### I02. 센서 테스트장 안내 문구 정리
- Related Files:
  - `src/pc/components/SensorAndModuleTestLabOverlay.tsx` :: 헤더의 `(🖱️ PC 마우스 또는 스마트폰 연결)`(약 152행 근처) — 문구를 폰 연결 안내로 변경; modify

#### Details
- 문구를 `(📱 조준하려면 스마트폰을 연결하세요)`로 바꾼다. 마우스 안내가 남아 있으면 `/sensor-test`에서 마우스로 조준되는 줄 알고 혼란스럽다(폰이 없으면 마우스 조준 불가, D06). 제어판의 HTML 버튼은 그대로 쓸 수 있다.
- `grep -rn "마우스 또는\|PC 마우스" src README.md docs/튜토리얼_훈련장_가이드.md`로 같은 의미의 안내가 더 있는지 확인하고, 있으면 "참여한 기기로만 조준" 취지로 고친다. 마우스로 참여했을 때의 안내(`마우스 더블클릭` 등 `GuideModal.tsx`의 마우스 모드 설명)는 그대로 둔다. `docs/` 아래 발표용 HTML은 건드리지 않는다.

### I03. 테스트
- Related Files:
  - `tests/slot-binding.test.ts` :: `describe('getMouseBinding')`(28~76행 근처), 245·283·322행 호출 — 인자 개수 변경과 기대값 수정; modify

#### Details
- 새 규칙 케이스: (1) 마우스 슬롯이 없고 1인(폰 슬롯만 참여)일 때 `getMouseBinding(slots, map)`은 `null`이다(이전에는 `0`). (2) 마우스 슬롯이 참여 중이면 그 플레이어 번호를 돌려준다. (3) 마우스 슬롯과 폰 슬롯이 함께 있으면 마우스 슬롯의 번호만 돌려준다. (4) 슬롯이 모두 비어 있으면 `null`.
- 기존 테스트 중 `playerCount === 1`이라서 `0`을 기대하던 케이스(34·43행 근처)는 위 규칙 (1)로 바꾼다. 인자 `2`를 넘기던 호출(54·65·76·245·283·322행)은 인자 하나를 지운다.
- `tests/input-adapters.test.ts`의 `MouseAdapter` 테스트가 `getMouseBinding`을 쓰는지 확인하고 쓰면 같이 고친다. `MouseAdapter`가 `sink()`가 `null`이면 아무것도 보내지 않는다는 기존 단언이 있으면 유지한다.

## Acceptance Criteria
- [ ] 폰으로 혼자 플레이 중 마우스를 움직여도 조준경이 폰만 따라간다(코드상 마우스 입력이 어느 플레이어에도 연결되지 않는다).
- [ ] 마우스로 참여한 슬롯은 지금처럼 마우스로 조준·사격·우클릭 스킬이 된다.
- [ ] 메뉴·일시정지·결과 화면의 HTML 버튼은 마우스로 그대로 눌린다.
- [ ] `/sensor-test`에서 폰이 없으면 마우스로 조준되지 않고, 안내 문구가 폰 연결을 말한다.

## Validation
- `npx vitest run tests/slot-binding.test.ts tests/input-adapters.test.ts tests/coop-slots.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
fix(input): 폰으로 혼자 할 때 마우스가 조준경을 뺏어 가던 문제 수정

Plan: 2026-11-08-unsupported-phone-block
Phase: P03-fever-ammo-aim
Task: T01-mouse-binding-joined-only

- I01: getMouseBinding에서 1인 보조 입력 분기와 playerCount 인자 삭제
- I02: 센서 테스트장 안내 문구를 폰 연결 기준으로 변경
- I03: 바인딩 규칙 테스트 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
