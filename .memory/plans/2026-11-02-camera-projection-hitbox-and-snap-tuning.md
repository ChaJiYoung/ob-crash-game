# Plan: 3D Camera Perspective Projection Hit Judgment and Continuous Snap Fire Tuning

## Goal
Three.js 3D 카메라의 실제 뷰-투영 행렬(`Vector3.project(camera)`)을 명중 판정에 직접 연동하여 화면상 조준선 위치와 몬스터 위치의 오차를 0.00으로 제거(조준선에 걸친 적 100% 명중)하고, 모바일 스냅 가속도 역치를 2.2 m/s²로 완화하며 화면 터치 유지 시 연속 코킹(Continuous Cocking) 및 110ms 쿨다운을 지원하여 손가락을 댄 채 가볍게 손목을 튕기면 "타닥타닥타닥" 딜레이 없이 즉각 연속 발사되는 아케이드 건슈팅 손맛을 완성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 3D 카메라 원근 투영 1:1 피격 판정 및 스냅 감도/연속 격발 튜닝 | [P01](../phases/2026-11-02-camera-projection-hitbox-and-snap-tuning/P01-camera-projection-and-continuous-snap/phase.md) |
