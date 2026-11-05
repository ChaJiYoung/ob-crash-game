# Plan: 컨트롤러 연결 유지 + 일시정지 메뉴

- Decisions: [2026-11-05-controller-persistence-and-pause](../decisions/2026-11-05-controller-persistence-and-pause.md)

## Goal
1. 한 번 연결한 폰은 QR을 다시 찍지 않는다. 폰 화면이 꺼졌다 켜져도, PC 페이지를 새로고침해도 같은 방으로 자동 복귀한다.
2. 게임 중 PC 화면 버튼 또는 Esc로 일시정지하고 `이어하기`(3초 카운트다운) 또는 `다시시작`(무기 선택부터, 점수 미저장)을 고른다.
3. 게임 중 폰이 끊기면 자동 일시정지하고, 재연결되면 일시정지 메뉴에서 사용자가 이어하기를 누를 때까지 멈춰 있는다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | PC 방 코드 유지, 폰 자동 재연결, 재연결 뒤 PC 화면 동기화 | [P01](../phases/2026-11-06-controller-persistence-and-pause/P01-connection-persistence/phase.md) |
| P02 | `done` | 일시정지 메뉴, 끊김 자동 일시정지, 문서·전체 검증 | [P02](../phases/2026-11-06-controller-persistence-and-pause/P02-pause-menu/phase.md) |
