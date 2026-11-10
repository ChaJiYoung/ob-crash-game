# Decisions: 무기 떨림(gun jitter) 수정

- Date: 2026-11-10
- Status: Confirmed

## D01. 원인 판정
- **Chosen**: `GameCanvas3D.tsx:780`의 매 프레임 `syncGuns()` → `DraftTapGun3D.setSlotOffset`이 `group.position.x`를 매 프레임 `offsetX`로 리셋하는 것이 원인. 센서 노이즈는 원인 아님.
- **Rationale**: 실제 로그에서 aim `(0.094,-1.000)`·rot cur==target으로 입력은 일정한데, setSlotOffset 호출 시점의 posX가 0.0013~0.0037로 변함. Node 시뮬레이션에서도 dt가 흔들리면 x 변화폭 0.005~0.010 재현, 가드 적용 시 0.

## D02. 수정 위치
- **Chosen**: `DraftTapGun3D.setSlotOffset`에서 `offsetX`가 현재 값과 같으면 early return. 같은 파일의 `setPlayerColor`도 같은 값이면 건너뛰게 맞춤.
- **Rationale**: 한 곳만 수정하면 되고 호출부(GameCanvas3D)를 건드리지 않아 총 생성/제거 타이밍 회귀 위험이 없음.

## D03. 디버그 코드 제거
- **Chosen**: `PCGamePage.tsx`(`[DEBUG_AIM]`)와 `DraftTapGun3D.ts`(`[DEBUG_GUN*]`, `(this as any)`)의 디버그 변경을 모두 되돌리고 수정에 포함하지 않음.
- **Rationale**: 임시 진단용이며 JITTER 감지 로그는 prevX가 항상 리셋값이라 무의미.

## D04. 회귀 테스트
- **Chosen**: 조준값 고정 + 프레임 간격(dt) 흔들림 조건에서 매 프레임 `setSlotOffset` 후 `updateAim`을 호출해도 x가 목표값으로 수렴·안정되는 vitest 추가.
- **Rationale**: 시뮬레이션으로 재현된 조건을 그대로 고정해 재발 방지.

## 범위 밖 (보고만, 미결정)
- aimY가 -1.000(한계)에 붙는 현상, 시작 시 rot 5.520→-0.380 초기 스냅.
