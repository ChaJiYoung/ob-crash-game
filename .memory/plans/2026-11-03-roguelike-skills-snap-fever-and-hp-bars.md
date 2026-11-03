---
title: Roguelike 3-Weapon Evolution, '휙!' Snap Active Skills, 4s Fever Burst & 3D HP Bars
created: 2026-11-03
status: active
decision_ref: .memory/decisions/2026-11-03-roguelike-skills-snap-fever-and-hp-bars.md
---

# Goal

웨이브 중 산만하게 스폰되던 필드 아이템 드롭을 제거하고, **3종 코믹 펍 무기 아키타입(🪠 맥주관 뚫어뻥 샷건 / 🍾 황금 병따개 리볼버 / 🍺 탄산 탭 개틀링)**의 Lv.1~MAX(Lv.4) 외형·스탯 진화, **웨이브 클리어 사격형 보상 카드(Shoot-to-Select)**, **스마트폰 '휙!(Snap)' 가속도 전용 액티브 스킬**, **4초 초고밀도 피버 버스트**, **몬스터 상단 3D 네온 도트 체력바(HP Bar)** 및 **황금 캔·투사체 요격 기믹**을 도입하여 아케이드 건슈팅의 손맛과 전략적 로그라이크 성장 재미를 완성한다. 또한 모든 무기·스킬·에셋 설계를 인게임 가이드 모달과 `docs/` 문서에 동기화한다.

# Phases

- **P01-roguelike-engine-weapons-and-gimmicks**: 공유 타입·밸런스 상수 정의(`WeaponKind`, `WEAPON_ARCHETYPE_SPECS`, 상향 몬스터 체력, 4초 피버) 및 `BeerCrusherEngine` 사격형 카드 선택, 3종 무기 탄도, 액티브 스킬 판정, 황금 캔·투사체 요격 기믹 구현 (2 Tasks: `T01` ~ `T02`)
- **P02-procedural-3d-assets-and-audio**: 프로시저럴 3D 리얼 뚫어뻥 및 3종 무기 × 4단계(Lv.1~MAX) 외형 진화, 특수 타겟(황금 캔/투사체/카드) 3D 모델, 3D 비행 탄환 & 8방향 뚫어뻥 폭풍·부메랑·거품 해일 물리 이펙트 및 Web Audio 타격음 합성 (2 Tasks: `T01` ~ `T02`)
- **P03-monster-hp-hud-and-controller-snap-skill**: PC 화면 3D 투영 몬스터 네온 도트 체력바(`maxHp >= 2`) & 무기/탄창/스킬 HUD 렌더링, 모바일 컨트롤러 '휙!(Snap)' 가속도 액티브 스킬 트리거(`skillSnapTriggered`) 및 소켓 상태·햅틱 동기화 (2 Tasks: `T01` ~ `T02`)
- **P04-in-game-guide-and-documentation**: 인게임 `GuideModal` / `TutorialGuideOverlay` 무기·스킬·카드·기믹 탭 개편 및 `docs/무기_및_스킬_가이드.md` 신규 작성·기존 문서 동기화 (1 Task: `T01`)
