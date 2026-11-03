---
id: T01-guide-modal-and-docs-synchronization
phase: P04-in-game-guide-and-documentation
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: In-Game GuideModal Weapon/Skill Tabs & Comprehensive Weapon/Asset Documentation in docs/
status: done
---

# Goal

인게임 가이드 모달(`src/pc/components/GuideModal.tsx`)과 튜토리얼 오버레이(`src/pc/components/TutorialGuideOverlay.tsx`)에 **3종 무기 도감 & Lv.1~MAX 진화표, '휙!(Snap)' 전용 액티브 스킬, 사격형 웨이브 보상 카드, 변경된 몬스터 체력(한맥 3HP / 맥주병 4HP / 보스 60HP) 및 황금 캔·투사체 요격 기믹, 4초 피버 버스트**를 시각적으로 안내한다. 또한 `docs/무기_및_스킬_가이드.md`를 신규 작성하고 기존 `docs/몬스터_도감_설명서.md`, `docs/비어 크러셔 상세설계서.md`, `README.md`를 최신 설계와 동기화한다.

# Target Files & Symbols

1. `src/pc/components/GuideModal.tsx`
   - 탭 구성 개편 및 콘텐츠 업데이트:
     - **탭 1: `🔫 3종 무기 & 스킬 도감` (신규 핵심 탭)**:
       - **🪠 맥주관 뚫어뻥 샷건 (`shotgun`)**: 산탄(3~6발) & 근접 넉백 | Lv.1(1.05 DMG) ➔ Lv.2(1.60 DMG + 넉백) ➔ Lv.3(2.50 DMG + 호박색 맥주관) ➔ MAX(3.60 DMG + 쿼드 배럴 + 둔화) | 전용 스킬 **[사방 뚫어뻥 폭풍]** (8방향 12~22발 포물선 폭격, 적중 시 1.0~2.0초 뚫어뻥 부착 기절, 빗나간 탄은 바닥 바운스)
       - **🍾 황금 병따개 리볼버 (`revolver`)**: 고화력 일직선 관통 저격 | Lv.1(0.75 DMG + 후열 0.35 관통) ➔ Lv.2(1.0 DMG + 롱배럴) ➔ Lv.3(1.35 DMG + 시안 레이저 스코프 + 2마리 관통) ➔ MAX(1.75 DMG + 100% 2관통 + 머즐 브레이크) | 전용 스킬 **[오프너 불릿 타임 & 참격]** (대형 황금 병따개 회전 부메랑 + 전 몬스터 3.5~5.0초간 40~60% 슬로우 모션)
       - **🍺 탄산 탭 개틀링 (`gatling`)**: 초고속 탄산 기포 연사(6.6~12발/s) | Lv.1(0.15 DMG, 18발) ➔ Lv.2(0.20 DMG, 22발) ➔ Lv.3(0.25 DMG, 28발 + 듀얼 카스 드럼통) ➔ MAX(0.35 DMG, 35발 + 12총열 아크 스파크) | 전용 스킬 **[거품 해일 160도 오버히트]** (전방 90~160도 거품 파도 + 전방 몬스터 1.0~1.4m 광역 후퇴 & 둔화)
     - **탭 2: `👾 몬스터 도감 & 기믹`**:
       - 6종 몬스터 상향된 체력(`pilgood: 1`, `caslight: 1`, `obi: 2`, `hanmac: 3`, `bottle: 4`, `boss: 60`) 및 3D 머리 위 네온 도트 체력바(`maxHp >= 2` 표시) 설명
       - **🌟 황금 캔 보너스**: 웨이브당 1회 고속 횡단, 처치 시 `+500점` + 스킬 & 피버 즉시 100% 완충
       - **🫧 거품 투사체 요격**: 한맥·보스가 날리는 거품/병뚜껑 투사체를 공중에서 사격해 격추(방어선 도달 시 바 체력 -1)
     - **탭 3: `🃏 웨이브 보상 카드 & 조작법`**:
       - 웨이브 클리어 시 등장하는 3장의 홀로그램 카드(**무기 레벨업 / 고속 장전 / 바리케이드 수리 / 피버 부스터**) 중 원하는 카드를 직접 조준 사격(Shoot-to-Select)하여 성장
       - 조작법 요약:
         - **단발/연사 사격**: 스마트폰 터치패드 탭 (또는 PC 좌클릭)
         - **전용 액티브 스킬 발동**: 스마트폰 총구를 위로 가볍게 **'휙!(Snap)'** 젖히기 (또는 PC `R` 키 / 우클릭) — 쿨타임 25s~16s (MAX 레벨 시 최대 2회 연속 충전!)
         - **4초 초고밀도 피버 버스트**: 피버 100% LOCK 상태에서 **더블 탭(Double-Tap)** 시 4초간 무한 탄창 + 0.08초 초고속 난사

2. `src/pc/components/TutorialGuideOverlay.tsx`
   - 튜토리얼 안내 문구에서 피버 지속시간 표기를 `10초` ➔ **`4초 초고밀도 버스트`**로 수정하고, `'휙!' 스냅 스킬` 및 `보상 카드 사격 선택` 팁을 반영

3. `docs/무기_및_스킬_가이드.md` (신규 생성)
   - 3종 코믹 펍 무기 아키타입 컨셉 및 프로시저럴 3D 에셋 구조(리얼 고무 벨 뚫어뻥 지오메트리, 레벨별 총열/파츠 진화 명세)
   - Lv.1 ~ Lv.4(MAX) 상세 밸런스 수치표(데미지, 탄창, 재장전, 발사 간격, 관통/넉백)
   - '휙!(Snap)' 가속도 전용 액티브 스킬 3종 메커니즘, 물리 연출(몬스터 부착 vs 바닥 튕김), 쿨타임 및 2스택 시스템
   - 웨이브 보상 카드(Shoot-to-Select) 4종 및 황금 캔·투사체 요격 전술 가이드

4. `docs/몬스터_도감_설명서.md`, `docs/비어 크러셔 상세설계서.md`, `README.md`
   - 변경된 몬스터 체력(`한맥 3HP`, `맥주병 4HP`, `보스 60HP`), 3D 네온 도트 체력바, 4초 피버 버스트, 3종 무기 및 스냅 액티브 스킬 내용을 반영하여 문서 간 모순이 없도록 업데이트

# Verification Command

```bash
npx vitest run
```

# Commit Message

```text
docs(guide): update in-game GuideModal and add comprehensive weapon, skill, and 3D asset documentation

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P04-in-game-guide-and-documentation
Task: T01-guide-modal-and-docs-synchronization
```
