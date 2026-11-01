# Plan: 비어 크러셔 3D 아케이드 v2 업그레이드 (실물 비주얼·아이템 4종·5웨이브·도감)

## Goal
3건의 확정 의사결정(`2026-11-01-visual-enhancement.md`, `2026-11-01-gameplay-systems.md`, `2026-11-01-visual-quality.md`)을 통합하여 다음을 달성한다:
1. 바 방어선 체력 5개(`🍺x5`), 스폰 거리 18m 단축, 몬스터 1.8~2.0배 확대, 5단계 테마 웨이브(총 114마리 + HP 40 냉각기 보스) 및 8초 기간제 사격 획득 아이템 4종(💥 파워 샷, 🎯 빅 스코프, 🧊 아이스 프리즈, 🍺 바 수리) 엔진 구현.
2. 오비맥주 제품 라벨 텍스처 + `LatheGeometry` 실물 캔 프로파일 + `MeshPhysicalMaterial` 유리 투과 생맥주잔 + 지상/공중 분리 및 바닥 원형 그림자 + 오비 펍 소품형 아이템 4종 3D 모델 구현.
3. Poly Haven CC0 실사 펍 HDRI 환경맵 + `UnrealBloomPass` 네온 발광 + 총구-조준점 레이저 탄도 궤적(`TracerBeam`) + 88px 다이내믹 아케이드 레티클 및 아이템 타이머 HUD 완성.
4. 업그레이드된 몬스터 6종 및 신규 아이템 4종을 3D 스튜디오에서 고해상도 캡처하고 `docs/몬스터_도감_설명서.md`에 몬스터 도감 및 아이템 설명서를 통합 수록.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 게임플레이 엔진(5목숨·5웨이브·아이템 4종), 실물 PBR 3D 모델·HDRI·Bloom·88px 조준경, 몬스터·아이템 통합 도감 완성 | [P01](../phases/2026-11-01-arcade-v2-upgrade/P01-arcade-v2-upgrade/phase.md) |
