# Plan: 3D Forward Vector Raycast Aiming and Gimbal Lock Elimination

## Goal
스마트폰의 W3C 오일러 각도(`alpha`, `beta`, `gamma`)의 개별 분리 연산으로 인해 대각선(특히 좌측 상단) 조준 시 발생하던 축 꼬임 및 짐벌락(우측 상단으로 튐) 현상을 원천 제거하고, 폰의 윗부분(총구)을 가리키는 3D 단위 벡터 $\vec{F} = Q \cdot (0, 1, 0)$와 중력 기준 가상 모니터 화면 직교 기저 평면 투영 알고리즘으로 전면 개편하여 어떤 파지세에서도 100% 왜곡 없는 조준을 달성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 3D 총구 Forward Vector 투영 및 대각선 조준 짐벌락 검증 | [P01](../phases/2026-11-02-forward-vector-raycast-aiming/P01-forward-vector-aiming/phase.md) |
