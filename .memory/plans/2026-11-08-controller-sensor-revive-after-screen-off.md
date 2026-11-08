# Plan: 폰 화면 꺼짐 후 조준 고정 수정

- Decisions: [2026-11-08-controller-sensor-revive-after-screen-off](../decisions/2026-11-08-controller-sensor-revive-after-screen-off.md)

## Goal
1P 폰 / 2P 마우스 상태에서 폰 화면이 꺼졌다 켜진 뒤 재연결해도 십자선과 탄착점이 폰 움직임을 따라간다 (지금은 정중앙 (0,0)에 고정).
- 본 수정: 화면 복귀 시 `deviceorientation`/`devicemotion` 리스너 재등록, 영점 유지, 조준 잠금·타이머 정리 (D01~D04)
- ①: `PhoneAdapter.autoZeroFromLatest` 영점 누적 오류 수정 (D06)
- ③: 센서 이벤트 정지 워치독 (D06)
- 추가(D08): 조준 잠금 자동 만료 (`GunGripTracker`)
- 추가(D09): `__setStep` 전역 노출 제거
- 제외: ② 처리기 재생성 시 조준값 초기화
- 측정 가능한 결과: 단위 테스트 통과 + 실기기에서 화면 껐다 켠 뒤 십자선이 움직임 + 임시 로그 제거 후 `tsc`·`vitest`·`build` 통과

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 코드 수정: 영점 오류 수정, 센서 정지 판정 헬퍼, 폰 컨트롤러 재등록·워치독 연결, 조준 잠금 자동 만료, `__setStep` 제거 | [P01](../phases/2026-11-08-controller-sensor-revive-after-screen-off/P01-sensor-revive/phase.md) |
| P02 | `pending` | 실기기 검증: 임시 로그 릴레이로 가설 확인, 임계값 확정, 임시 코드 제거 | [P02](../phases/2026-11-08-controller-sensor-revive-after-screen-off/P02-device-verify/phase.md) |
