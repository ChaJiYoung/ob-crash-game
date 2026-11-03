---
id: T01-monster-3d-hp-bars-and-weapon-skill-hud
phase: P03-monster-hp-hud-and-controller-snap-skill
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Monster 3D Tracking Neon Dot HP Bars, Weapon/Skill HUD & PC Input Integration
status: done
---

# Goal

`src/pc/components/ArcadeOverlayHUD.tsx`, `src/pc/components/GameCanvas3D.tsx`, `src/pc/PCGamePage.tsx`에 **다회 타격 몬스터(`maxHp >= 2`)의 3D 머리 위를 실시간 추적하는 슬림 네온 도트 체력바(HP Bar)**와 **현재 장착 무기/레벨/동적 탄약 및 액티브 스킬 쿨타임·스택 배지**를 렌더링하고, PC 단독 플레이 시에도 키보드 `R` 키 / 마우스 우클릭으로 액티브 스킬을 발동할 수 있게 연동한다.

# Target Files & Symbols

1. `src/pc/components/ArcadeOverlayHUD.tsx`
   - **`MonsterHudProjection` 인터페이스 추가**:
     - `id: string`
     - `kind: TargetKind`
     - `hp: number`
     - `maxHp: number`
     - `leftPercent: number` (3D 월드 좌표를 카메라 투영하여 변환한 뷰포트 X `%`)
     - `topPercent: number` (몬스터 머리 위 Y 좌표를 투영한 뷰포트 Y `%`)
     - `isStunned?: boolean`
     - `isSlowed?: boolean`
     - `isBoss?: boolean`
     - `cardTitle?: string`
   - **헬퍼 함수 export 추가 (단위 테스트 검증용)**:
     - `shouldRenderMonsterHpBar(maxHp: number, isItem?: boolean, isProjectile?: boolean): boolean`
       - D03 규칙: 1HP 공중 캔(`pilgood`, `caslight`)이나 아이템/투사체는 화면 복잡도를 줄이기 위해 숨기고(`false`), `maxHp >= 2`인 다회 타격 몬스터(`obi: 2`, `hanmac: 3`, `bottle: 4`, `boss: 60`)만 `true` 반환!
     - `formatWeaponSkillBadge(weaponKind: WeaponKind, weaponLevel: WeaponLevel, skillStock: number, maxSkillStock: number, cooldownRemainingMs: number): { weaponTitle: string; levelBadge: string; skillStatusText: string; isReady: boolean; accentColor: string }`
   - **HUD 렌더링 확장**:
     - 다회 타격 몬스터(`shouldRenderMonsterHpBar === true`) 머리 위 좌표(`leftPercent`, `topPercent`)에 슬림 네온 도트 체력바 렌더링:
       - 일반 엘리트(`obi`, `hanmac`, `bottle`): `Math.ceil(maxHp)` 칸으로 분할된 네온 세그먼트 도트(`[■][■][■][ ]`), 현재 `hp` 비율에 따라 에메랄드/앰버/레드 컬러 전환 + 기절(`⚡STUN`) / 둔화(`❄️SLOW`) 미니 태그 표시
       - 보스(`boss`, `maxHp: 60`): 상단/타겟 추적 와이드 보스 네온 체력 게이지 바 + 남은 수치(`42.5 / 60 HP`) 표시
     - 좌하단 무기 & 탄약 & 액티브 스킬 패널:
       - 장착 무기 아이콘·이름·레벨 배지(`Lv.1` ~ `Lv.4 MAX`)
       - 동적 탄창 표시: 탄창이 12발 이하(샷건/리볼버)이면 개별 황금 탄환 아이콘 + 텍스트, 12발 초과(개틀링 최대 35발)이면 컴팩트 고속 탄창 게이지 바 + `28 / 28` 카운터 표시
       - 액티브 스킬 슬롯: 충전 완료 시 네온 점멸(`"⚡ SKILL READY! [위로 휙! / R키]"`) + 스택 아이콘(`[★][★]`), 쿨타임 중일 때 원형/바 진행률 및 남은 초(`14.2s`) 표시

2. `src/pc/components/GameCanvas3D.tsx` & `src/pc/PCGamePage.tsx`
   - `GameCanvas3D.tsx`: 매 프레임 활성 몬스터(`maxHp >= 2`)의 머리 위 월드 좌표(`pos.y + hitRadiusM * 0.9`)를 `camera`로 투영(`vector.project(camera)`)하여 `MonsterHudProjection[]` 배열을 `ArcadeOverlayHUD`에 전달
   - `PCGamePage.tsx`:
     - 키보드 **`R` 키 또는 마우스 우클릭(Right-Click)** 시 `engine.triggerWeaponSkill(nowMs)` 발동 지원
     - 개틀링(`gatling`) 장착 시 마우스 좌클릭 홀드로 빠른 연사 지원

3. `tests/pc-hud-and-banner.test.ts`
   - `shouldRenderMonsterHpBar` (1HP 캔 `false`, 2HP+ 몬스터 `true`), `formatWeaponSkillBadge` (Lv.1~MAX 및 쿨타임/스택 포맷) 단위 테스트 추가

# Verification Command

```bash
npx vitest run tests/pc-hud-and-banner.test.ts
```

# Commit Message

```text
feat(hud): render 3D-projected monster neon dot HP bars and weapon/skill cooldown HUD on PC

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P03-monster-hp-hud-and-controller-snap-skill
Task: T01-monster-3d-hp-bars-and-weapon-skill-hud
```
