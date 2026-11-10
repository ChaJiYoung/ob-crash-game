# Plan: 무기 떨림 수정 (gun-jitter-fix)

## Goal
폰을 가만히 둬도 PC 화면의 3D 총이 떨리는 현상을 없앤다. 조준값이 고정이고 프레임 간격(dt)이 흔들려도 총의 x 위치가 일정해야 한다. 결정: [../decisions/2026-11-10-gun-jitter-fix.md](../decisions/2026-11-10-gun-jitter-fix.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | setSlotOffset/setPlayerColor 중복 호출 가드 + 디버그 코드 제거 + 회귀 테스트 | [P01](../phases/2026-11-10-gun-jitter-fix/P01-gun-jitter/phase.md) |
