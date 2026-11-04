# Task 03: 센서 연구소 모달 실시간 렌더 성능 지표(`FPS`, `drawCalls`, `geometries`, `textures`) 연동 및 100발 발사/30마리 스폰 리소스 누수 회귀 테스트 작성

- **Status**: done
- **Phase**: `P02-render-pooling-and-lighting-diet`
- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`

## Goal
센서 연구소 모달(`MobileSensorLabModal`)이 열려 있을 때만 `renderer.info` 기반 실시간 렌더 지표(`FPS`, `drawCalls`, `geometries`, `textures`)를 표시하도록 연동하고, `tests/three-stage-and-models.test.ts`에 발사체 100발 연속 발사 및 몬스터 30마리 스폰/처치 시 리소스 누수와 공유 리소스 파괴가 발생하지 않음을 보증하는 자동화 회귀 테스트를 추가한다.

## Decision Summary
- **D02 (`2026-11-04-render-perf-optimization.md`)**:
  1. `MobileSensorLabModal.tsx`의 `SensorLiveMetrics` 인터페이스에 선택적 렌더 성능 필드(`fps?: number`, `drawCalls?: number`, `geometries?: number`, `textures?: number`)를 추가하고, 모달 하단 라이브 지표 그리드에 렌더링한다.
  2. `GameCanvas3D.tsx`의 렌더 루프에서 `onRenderStatsUpdate` 콜백(또는 ref 폴링)을 통해 `isSensorLabOpen`이 활성화되어 있을 때만 약 `250ms` 주기로 `fps`, `renderer.info.render.calls`, `renderer.info.memory.geometries`, `renderer.info.memory.textures`를 전달한다.
  3. `tests/three-stage-and-models.test.ts`에 (a) `ParticleEffects3D` 100발 연속 발사/트레이서 풀링 검증, (b) 몬스터 30마리 연속 스폰 시 지오메트리 캐시 재사용 검증, (c) `disposeSceneGroup` 호출 시 살아있는 다른 몬스터의 공유 지오메트리/머티리얼이 파괴되지 않는지 검증하는 회귀 테스트를 추가한다.

## Implementation
- [x] **I01**: `src/pc/components/MobileSensorLabModal.tsx`의 `SensorLiveMetrics` 타입에 `fps?: number; drawCalls?: number; geometries?: number; textures?: number;` 필드를 추가하고 UI에 `FPS / DrawCalls` 및 `Geometries / Textures` 카드를 표시한다.
- [x] **I02**: `src/pc/components/GameCanvas3D.tsx`의 `GameCanvas3DProps`에 `onRenderMetrics?: (metrics: { fps: number; drawCalls: number; geometries: number; textures: number }) => void` 콜백을 추가하고, 렌더 루프에서 `onRenderMetrics`가 정의된 경우에만 `250ms` 간격으로 지표를 보고한다.
- [x] **I03**: `src/pc/PCGamePage.tsx`에서 `isSensorLabOpen`이 `true`일 때만 `GameCanvas3D`의 `onRenderMetrics`로 전달받은 렌더 지표를 `sensorLiveMetrics`에 병합한다.
- [x] **I04**: `tests/three-stage-and-models.test.ts`에 발사체 100회 풀링 회귀 테스트와 몬스터 30마리 스폰 및 `disposeSceneGroup` 안전성 회귀 테스트를 작성하고 전체 테스트 스위트(`npm test`)를 실행해 검증한다.

## Related Files
- `src/pc/components/MobileSensorLabModal.tsx` (modify)
- `src/pc/components/GameCanvas3D.tsx` (modify)
- `src/pc/PCGamePage.tsx` (modify)
- `tests/three-stage-and-models.test.ts` (modify)

## Signatures & Types
```typescript
// src/pc/components/MobileSensorLabModal.tsx
export interface SensorLiveMetrics {
  rawAimX: number;
  rawAimY: number;
  filteredAimX: number;
  filteredAimY: number;
  jitterRms: number;
  linearAccelMag: number;
  packetHz: number;
  fps?: number;
  drawCalls?: number;
  geometries?: number;
  textures?: number;
}

// src/pc/components/GameCanvas3D.tsx
export interface RenderPerformanceMetrics {
  fps: number;
  drawCalls: number;
  geometries: number;
  textures: number;
}
```

## Data & Schema Fields
- `SensorLiveMetrics.fps`: `number | undefined` - 최근 프레임 구간 평균 FPS
- `SensorLiveMetrics.drawCalls`: `number | undefined` - `renderer.info.render.calls`
- `SensorLiveMetrics.geometries`: `number | undefined` - `renderer.info.memory.geometries`
- `SensorLiveMetrics.textures`: `number | undefined` - `renderer.info.memory.textures`

## Execution Flow / Logic
1. `GameCanvas3D.tsx`:
   - 애니메이션 루프 내에서 프레임 카운터(`fpsFrameCount`)와 마지막 집계 시각(`lastMetricsReportMs`)을 추적한다.
   - `now - lastMetricsReportMs >= 250`일 때 `onRenderMetricsRef.current`가 존재하면:
     - `const fps = Math.round((fpsFrameCount * 1000) / (now - lastMetricsReportMs));`
     - `onRenderMetricsRef.current({ fps, drawCalls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });`를 호출하고 카운터를 리셋한다.
2. `PCGamePage.tsx`:
   - `handleRenderMetrics` 콜백에서 `if (!isSensorLabOpenRef.current && gamePhaseRef.current !== 'SANDBOX') return;` 가드를 두고, 모달이 열려 있을 때만 `renderMetricsRef.current`를 저장 및 `setSensorLiveMetrics`에 반영한다.
3. `tests/three-stage-and-models.test.ts`:
   - `ParticleEffects3D`에 대해 `SHOTGUN`, `REVOLVER`, `GATLING` 발사체 및 트레이서를 100회 생성/업데이트하며 풀 사이즈가 상한선(예: `<= 32`) 이내로 유지되고 지오메트리가 재사용되는지 단언(assert)한다.
   - 6종 몬스터를 총 30마리 생성한 뒤 첫 6마리 생성 직후의 `getSharedTargetResourceStats().cachedGeometries`와 30마리 생성 후의 `cachedGeometries`가 동일한지 단언한다.
   - `disposeSceneGroup`으로 몬스터 15마리를 처치 정리한 후에도 나머지 15마리의 공유 지오메트리(`userData.disposed`)가 `undefined`이고 처치된 몬스터의 개별 `bodyMaterials`만 `userData.disposed === true`인지 단언한다.

## Acceptance Criteria
- `MobileSensorLabModal`에서 `fps`, `drawCalls`, `geometries`, `textures` 지표가 렌더링된다.
- 100발 발사 및 30마리 스폰/처치 회귀 테스트를 포함한 전체 테스트 스위트(`npm test`)가 100% 통과한다.

## Validation
```bash
npm test
```

## Commit Message
```text
test(three): add render metrics to sensor lab and verify pooling/cache regression

Plan: 2026-11-04-aim-sync-and-render-optimization
Phase: P02
Task: T03
```

## Progress
- 2026-11-04: MobileSensorLabModal 실시간 렌더 성능 지표(FPS, DrawCalls, 지오메트리, 텍스처 수) 표시 UI 카드 구현 완료.
- 2026-11-04: GameCanvas3D 애니메이션 루프 250ms 쓰로틀 렌더 지표 측정 콜백 연동 및 PCGamePage 센서 연구소 조건부 반영 완료.
- 2026-11-04: tests/three-stage-and-models.test.ts 100발 발사/트레이서 풀링 및 30마리 스폰/disposeSceneGroup 안전성 회귀 테스트 통과 (13개 파일 101개 테스트 통과).
