---
title: Weapon-Specific Crosshairs & Hit-Detection Alignment
created: 2026-11-03
status: planned
decision_ref: .memory/decisions/2026-11-03-weapon-crosshairs-and-hit-detection.md
---

# Goal

모든 무기가 동일한 88px 사각 브래킷 단일 점 판정을 사용함으로써 발생하던 "샷건/개틀링 조준경 원 안에 몬스터가 들어왔는데도 MISS가 떠서 콤보와 피버가 끊기는 억울한 현상"을 원천 해결한다.
3종 무기 아키타입(🪠 맥주관 뚫어뻥 샷건 / 🍾 황금 병따개 리볼버 / 🍺 탄산 탭 개틀링)별로 고유한 비주얼 조준경 HUD를 렌더링하고, 각 조준경의 시각적 범위와 `BeerCrusherEngine`의 실제 피격 판정 범위(Hit Tolerance)를 1:1로 완전 동기화한다.

# Phases

- **P01-weapon-crosshairs-hud**: `CrosshairOverlay.tsx` 컴포넌트에 `weaponKind`, `weaponLevel` prop 추가 및 3종 무기별 고유 조준경(샷건 120px 펠릿 링, 리볼버 76px 스나이퍼 십자선, 개틀링 88px 회전 톱니) 렌더링, `PCGamePage.tsx` 상태 연동 (1 Task: `T01`)
- **P02-engine-hit-tolerance-and-sync**: `BeerCrusherEngine.ts`의 `shootAt`에 무기별 판정 허용 배율(`weaponHitToleranceMult`) 적용, 조준경-피격 범위 1:1 동기화, `WeaponCrosshairHitDetection.test.ts` 단위/통합 테스트 작성 및 검증 (1 Task: `T01`)
