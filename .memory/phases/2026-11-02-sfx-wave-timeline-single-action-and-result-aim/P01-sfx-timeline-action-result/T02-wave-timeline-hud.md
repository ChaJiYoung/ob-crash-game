# Task: T02 Wave Timeline Progress Bar HUD

## Status: done

## Goal
화면 상단 중앙에 현재 웨이브의 토벌 진행도(남은 몬스터 수 / 전체 몬스터 수)와 진행률 퍼센트(%)를 나타내는 컴팩트 단일 바 HUD를 렌더링하여 이번 웨이브 잔여 적 정보를 플레이어가 직관적으로 파악할 수 있도록 한다.

## Decision Summary
- 상단 중앙 웨이브 배지 아래에 복잡한 노드 대신 깔끔하고 세련된 네온 컴팩트 게이지 바를 배치하고 실시간 처치율과 남은 적 수를 동적 바인딩 ([D02](../../decisions/2026-11-02-sfx-wave-timeline-single-action-and-result-aim.md)).

## Implementation

### I01. Engine Wave Progress Query Method

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — 진행도 반환 메서드; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface WaveProgressInfo {
    wave: number;
    totalWaves: number;
    killedInWave: number;
    totalSpawns: number;
    remainingInWave: number;
    progressPercent: number; // 0 to 100
  }

  export class BeerCrusherEngine {
    public getWaveProgress(): WaveProgressInfo;
  }
  ```
- **Execution Flow / Logic**:
  1. 현재 웨이브 인덱스 `this.currentWave`로 `waveDefinitions`에서 해당 웨이브의 `totalSpawns`를 조회.
  2. 처치된 적 수: `this.killedInWave`.
  3. 남은 적 수: `Math.max(0, totalSpawns - this.killedInWave)`.
  4. 퍼센트 계산: `Math.min(100, Math.round((this.killedInWave / totalSpawns) * 100))`.
  5. 튜토리얼/샌드박스 모드일 때는 기본 안전값(100% 또는 0%) 반환.

### I02. Arcade HUD Compact Progress Bar Rendering

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUD` — UI 렌더링; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — hudState 전달 연동; modify

#### Details
- **Props & State**:
  - `ArcadeOverlayHUDProps`에 `waveProgress?: WaveProgressInfo` 추가.
  - `PCGamePage.tsx`의 50ms interval HUD tick에서 `engine.getWaveProgress()`를 호출하여 `hudState`에 포함.
- **UI Structure & Styling**:
  - 위치: 상단 중앙 `WAVE {wave} / {totalWaves}` 배지 바로 아래 (`marginTop: '6px'`).
  - 너비: 320px, 높이: 16px (컴팩트 바).
  - 배경: `rgba(17, 24, 39, 0.85)` + 테두리 `1px solid rgba(245, 158, 11, 0.4)`.
  - 내부 게이지 채움: `linear-gradient(90deg, #f59e0b, #fbbf24)` 네온 골드 글로우.
  - 텍스트 오버레이: 정중앙에 미니 폰트(11px, bold)로 `처치 {killedInWave}/{totalSpawns} ({progressPercent}%)` 또는 `남은 적 {remainingInWave}마리` 표시.

## Acceptance Criteria
- [ ] 적을 처치할 때마다 상단 게이지 바가 0%에서 100%까지 부드럽게 차오른다.
- [ ] 남은 적 수와 현재 처치 수 정보가 일치한다.
- [ ] 다음 웨이브로 넘어가면 게이지가 다시 0%로 리셋되어 새로 시작된다.
- [ ] 보스전(Wave 5)에서도 보스 체력바와 함께 자연스럽게 조화된다.

## Validation
- `pnpm test` — 기존 53개 유닛 테스트 전체 통과
- `pnpm build` — TypeScript 컴파일 및 번들링 성공

## Commit Message
```text
feat(hud): add compact wave timeline progress bar to arcade overlay

Plan: 2026-11-02-sfx-wave-timeline-single-action-and-result-aim
Phase: P01-sfx-timeline-action-result
Task: T02-wave-timeline-hud

- Add getWaveProgress() query method to BeerCrusherEngine
- Render compact wave kill progress bar with remaining enemy count in ArcadeOverlayHUD
- Connect wave progress info to PCGamePage HUD tick loop
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
