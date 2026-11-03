# Task Blueprint: T01-engine-weapon-hit-tolerance

- **Phase**: P02-engine-hit-tolerance-and-sync
- **Status**: todo

## 1. 대상 파일 및 심볼
- `src/pc/engine/BeerCrusherEngine.ts`
  - `shootAt`:
    - 무기별 히트 판정 허용 배율 정의 (`weaponHitToleranceMult`):
      - `shotgun`: 1.55 (120px 대형 조준경 링 내부 걸침 100% 명중 보장)
      - `revolver`: 0.95 (초정밀 스나이퍼) + 수직 관통 허용 배율 `(aimY - proj.targetNormY) * 0.70` (수직 관통 쾌감 증대)
      - `gatling`: 1.25 (88px 연사 스프레드 커버)
    - `effectiveHitRadius = proj.apparentHitRadius * weaponHitToleranceMult` 계산
    - `dist <= effectiveHitRadius` 체크 및 `evaluateHitJudgment` 평가 시 `effectiveHitRadius` 전달
- `src/tests/WeaponCrosshairHitDetection.test.ts`
  - 샷건 조준경 범위(외곽 1.4배 거리)에서 샷건은 HIT, 리볼버는 MISS되는지 비교 검증
  - 개틀링 연사 조준 범위(1.2배 거리)에서 개틀링은 HIT되는지 검증
  - 리볼버 수직 관통 축 조준 시 유효타 적중 검증
  - 조준경 범위 내 타격 시 MISS가 아닌 유효 등급(PERFECT, GREAT, GOOD) 판정 검증

## 2. 모델 스키마 & 인터페이스
```ts
// BeerCrusherEngine.ts 내부 로직
const weaponHitToleranceMult =
  weaponKind === 'shotgun' ? 1.55 :
  weaponKind === 'gatling' ? 1.25 :
  0.95; // revolver

const verticalToleranceScale = weaponKind === 'revolver' ? 0.70 : 0.85;

const effectiveHitRadius = proj.apparentHitRadius * weaponHitToleranceMult;
```

## 3. 검증 커맨드
```bash
npx tsc --noEmit
npx vitest run src/tests/WeaponCrosshairHitDetection.test.ts
npx vitest run
```

## 4. 커밋 메시지
```text
feat(engine): synchronize weapon hit detection tolerance with crosshairs and fix miss judgments

Plan: 2026-11-03-weapon-crosshairs-and-hit-detection
Phase: P02-engine-hit-tolerance-and-sync
Task: T01-engine-weapon-hit-tolerance
```
