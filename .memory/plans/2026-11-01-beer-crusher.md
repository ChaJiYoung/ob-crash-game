# Plan: 비어 크러셔 (Beer Crusher) 3D 모션 슈팅 게임 구현

## Goal
스마트폰을 실제 권총처럼 쥐어(**상단 `+Y`축 = 모니터 총구 방향, 화면 `+Z`축 = 좌측 방향**) PC 대형 화면(16:9 풀스크린) 속 **오비맥주 브루어리 & 네온 펍 3D 홀**에서 부채꼴 전방위로 몰려오는 **6종 타겟(필굿·카스 라이트·오비 라거·한맥·500ml 생맥주잔·업소용 생맥주 냉각기 보스)**을 사격하는 WebSocket 연동 3D 모션 슈팅 게임을 4개 Phase(레이어별 마일스톤)로 나누어 구현합니다.

## Reference Documents
- 의사결정 기록: [2026-11-01-beer-crusher.md](../decisions/2026-11-01-beer-crusher.md) (`D01` ~ `D09`)
- 요구사항 분석서: [비어 크러셔 요구사항 분석서.md](../../docs/비어%20크러셔%20요구사항%20분석서.md)
- 상세설계서: [비어 크러셔 상세설계서.md](../../docs/비어%20크러셔%20상세설계서.md)
- 3D 스테이지 & 타겟 프로토타입: [stage-concepts-preview.html](../../docs/stage-concepts-preview.html)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 공유 프로토콜 및 WebSocket 세션·랭킹 서버 레이어 (`D01`, `D08`) | [P01](../phases/2026-11-01-beer-crusher/P01-backend-and-protocol/phase.md) |
| P02 | `pending` | Three.js 3D 스테이지·타겟 모델링 및 코어 슈팅 엔진 레이어 (`D02`, `D03`, `D04`, `D06`, `D07`, `D09`) | [P02](../phases/2026-11-01-beer-crusher/P02-3d-world-and-game-engine/phase.md) |
| P03 | `pending` | PC 16:9 풀스크린 아케이드 화면 및 모달 UI 레이어 (`D05`, `D08`) | [P03](../phases/2026-11-01-beer-crusher/P03-pc-arcade-display/phase.md) |
| P04 | `pending` | 스마트폰 권총 그립(`+Y` 총구·화면 좌측) 센서 및 85:15 통합 터치 컨트롤러 레이어 (`D08`, `D09`) | [P04](../phases/2026-11-01-beer-crusher/P04-mobile-gun-grip-controller/phase.md) |
