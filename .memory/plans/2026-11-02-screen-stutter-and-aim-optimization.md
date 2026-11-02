# Plan: Screen Stutter and Aim Performance Optimization

## Goal
마우스 및 모바일 컨트롤러 조작 시 발생하던 Three.js WebGL 캔버스 무한 파괴·재생성 루프와 2K HDRI 중복 로딩을 차단하고, React 리렌더링 없는 직접 DOM/Ref 조준 갱신 및 모바일 즉시 사격 패킷 전송·자이로 스무딩을 구현하여 60~120fps의 부드러운 화면과 즉각적인 타격감을 달성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | PC 3D 캔버스 생명주기 격리·직접 DOM 조준선 갱신 및 모바일 초저지연 컨트롤러 개선 | [P01](../phases/2026-11-02-screen-stutter-and-aim-optimization/P01-stutter-and-aim-optimization/phase.md) |
