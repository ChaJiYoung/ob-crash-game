---
id: T02-mobile-controller-snap-skill-and-sync
phase: P03-monster-hp-hud-and-controller-snap-skill
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Mobile Controller '휙!' Snap Active Skill Trigger, SKILL_STATE_SYNC Relay & Haptic Feedback
status: done
---

# Goal

모바일 컨트롤러(`src/controller/MobileControllerPage.tsx`, `src/controller/components/GunGripPad.tsx`, `server/index.ts`)에서 **스마트폰을 위로 '휙!(Snap)' 젖히는 가속도 제스처(`detectSnapFire`)를 전용 액티브 스킬 트리거(`skillSnapTriggered`)로 연결**하고, PC로부터 `SKILL_STATE_SYNC`를 수신해 스마트폰 화면의 스킬 READY 배지 및 충전 완료 햅틱 진동을 동기화한다.

# Target Files & Symbols

1. `src/controller/MobileControllerPage.tsx`
   - D02: `onMotion` 이벤트에서 `tracker.detectSnapFire(...)`가 `true`일 때, 기존의 일반 단발 사격 대신 **`skillSnapTriggered: true` 플래그를 WebSocket 센서 프레임으로 전송**하여 무기 전용 액티브 스킬을 발동시킨다!
   - 서버로부터 `SKILL_STATE_SYNC` 수신 시 현재 무기 종류/레벨/스킬 스택/쿨타임을 상태에 반영하고, 스킬 충전 완료 순간 스마트폰 진동(`triggerHaptic([60, 40, 90])`) 피드백 제공
2. `src/controller/components/GunGripPad.tsx`
   - 상단/중앙에 현재 장착 무기 이름(`🪠 뚫어뻥 샷건 Lv.2`)과 액티브 스킬 상태 배지 표시:
     - `skillStock > 0`: 황금/시안 네온 배지 `"⚡ SKILL READY! 총구를 위로 '휙!' 젖혀 필살기 발동!"`
     - `skillStock === 0`: 쿨타임 프로그레스 바 `"스킬 재충전 중... 15s"`
3. `src/pc/PCGamePage.tsx` & `server/index.ts`
   - `PCGamePage.tsx`: 수신된 `SensorFramePayload.skillSnapTriggered === true`일 때 `engine.triggerWeaponSkill(nowMs)` 실행 및 `SKILL_STATE_SYNC` 소켓 메시지 송신
   - `server/index.ts`: `SKILL_STATE_SYNC` 메시지 브로드캐스트 릴레이 지원
4. `tests/controller-sensors.test.ts`
   - '휙!(Snap)' 가속도 감지 시 액티브 스킬 트리거(`skillSnapTriggered`) 시나리오 테스트 추가

# Verification Command

```bash
npx vitest run tests/controller-sensors.test.ts
```

# Commit Message

```text
feat(controller): bind mobile snap gesture to active skill trigger and sync skill cooldown/haptics

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P03-monster-hp-hud-and-controller-snap-skill
Task: T02-mobile-controller-snap-skill-and-sync
```
