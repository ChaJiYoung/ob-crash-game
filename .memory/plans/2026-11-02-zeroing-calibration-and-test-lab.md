# Plan: Zeroing Calibration, Pitch/Yaw Recognition Fix, Center Gun Alignment, and Interactive Module Test Lab

## Goal
스마트폰 자이로 센서의 상하(Pitch)·좌우(Yaw) 인식 불량 및 영점 즉시 시작으로 인한 대응 불가 문제를 해결하기 위해, (1) W3C `DeviceOrientation` 표준 기반 상하/좌우 각도 추출 및 2단계 가동 범위 맞춤 캘리브레이션을 도입하고, (2) 3D 총기를 화면 정중앙 하단(`x = 0`)에 배치하여 [총구 방향 = 조준선 = 탄도 궤적 = 몬스터 높이별 피격 판정]을 단일 3D 좌표계로 통합하며, (3) 영점 완료 후 조준선 프리뷰 확인 및 3초 카운트다운 시작 흐름과 (4) 센서·영점·몬스터 6종·아이템 4종·피버·총기 모션을 한곳에서 시험할 수 있는 올인원 모듈 테스트장(Sandbox Test Lab)을 구축합니다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 자이로 상하/좌우 보정, 2단계 가동 범위 영점, 중앙 총기 및 탄도 일체화, 카운트다운 시작, 올인원 모듈 테스트장 구현 | [P01](../phases/2026-11-02-zeroing-calibration-and-test-lab/P01-zeroing-and-test-lab/phase.md) |
