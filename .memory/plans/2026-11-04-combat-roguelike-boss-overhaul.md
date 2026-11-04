# Plan: Combat Judgment, Kill-Gauge Cards, Boss Cooler Summon, UI & Guide/Tutorial Overhaul

## Goal
플레이 테스트에서 드러난 타격감·밸런스·조작·가독성 문제를 전면 개편하여, ① 정확도(`GOOD 0.8x / GREAT 1.0x / PERFECT 1.5x`) 기반 데미지 및 1레벨 무기 원샷 타격감 보장(MISS 페널티 폐지), ② 콤보 UI 제거 및 `PERFECT(+8%)`/`처치(+12%)` 기반 피버 충전과 피버 2배 실제 데미지 적용, ③ 몬스터 킬 게이지 기반 전투 중 보상 카드 팝업(전장 일시정지) 및 적 처치 시 아이템 드롭(기본 4%, 패시브 카드로 2배·3배·4배 증가), ④ Wave 5 냉각기 보스 전방 10m 정지 및 탭 레버 소환 액션 기반 부하 미니웨이브, ⑤ 모바일·PC 공통 홀드 자동 연발(`투두두두`) 및 100% 비율 게이지 체력바·3D 카드/스킬 시야 개선, ⑥ 인게임 가이드 모달(3탭)·3단계 인터랙티브 튜토리얼·공식 가이드 문서(`README.md`, `docs/*.md`) 전면 개편을 완성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 코어 전투 엔진 개편: 정밀도 데미지 배율(0.8x/1.0x/1.5x), 1레벨 화력 상향, 피버 충전·2배 데미지, 킬 게이지 카드(전장 일시정지), 적 처치 아이템 드롭 및 보스 10m 정지·미니웨이브 소환 | [P01](../phases/2026-11-04-combat-roguelike-boss-overhaul/P01-core-combat-and-roguelike-engine/phase.md) |
| P02 | `done` | 조작 및 HUD/3D 연출 개편: 모바일·PC 공통 홀드 자동 연발(`투두두두`), 100% 연속 게이지 체력바, 콤보 UI 제거, 3D 카드/개틀링 시야 개선 및 보스 탭 레버 3D 액션 | [P02](../phases/2026-11-04-combat-roguelike-boss-overhaul/P02-autofire-controls-and-3d-hud-polish/phase.md) |
| P03 | `done` | 가이드·튜토리얼·문서 SSOT 동기화: 인게임 가이드 모달(3탭), 3단계 인터랙티브 사격 훈련장, 결과 모달 및 공식 마크다운 문서(6종) 전면 개편 | [P03](../phases/2026-11-04-combat-roguelike-boss-overhaul/P03-guide-tutorial-and-docs-sync/phase.md) |
