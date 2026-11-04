# Plan: Mobile Sensor Stabilizer & PC Recognition Test Lab

## Goal
Galaxy A15 등 물리적 자이로스코프가 없는 안드로이드 보급형 기기의 가상 자이로 지자기 노이즈(부들부들 떨림 및 에임 표류)를 적응형 1€ Filter(One Euro Filter)와 데드존(Deadzone) 알고리즘으로 완전 소멸시키고, PC 화면 어디서든 폰을 쥔 채로 실시간 모바일 인식을 테스트·검증하고 튜닝할 수 있는 상시 '모바일 센서 진단 랩' 팝업과 원터치 기기 프리셋을 구축한다.

## Decisions Reference
- [.memory/decisions/2026-11-04-mobile-sensor-stabilizer.md](../decisions/2026-11-04-mobile-sensor-stabilizer.md)
  - D01. 적응형 1€ Filter (One Euro Filter) 및 데드존(Deadzone) 도입
  - D02. PC 상단 '🎯 모바일 인식 테스트 & 보정' 상시 팝업 제공
  - D03. Raw(원시 센서) vs Filtered(보정 에임) 실시간 비교 시각화 & 지터 진단
  - D04. 기기별 원터치 프리셋 및 로컬 영구 저장 (localStorage)
  - D05. 아이폰 13 미니 기본 조준 감각 절대 보존 (Default = 기존 로직 유지, 안정화는 선택적 개입)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 모바일 센서 노이즈 필터링 코어(1€ Filter & Deadzone) 및 센서 프로토콜 확장 | [P01](../phases/2026-11-04-mobile-sensor-stabilizer/P01-sensor-filter-core/phase.md) |
| P02 | `done` | PC 상시 모바일 인식 테스트 랩 팝업, 실시간 에임 시각화 및 E2E 검증 | [P02](../phases/2026-11-04-mobile-sensor-stabilizer/P02-pc-sensor-test-lab/phase.md) |


