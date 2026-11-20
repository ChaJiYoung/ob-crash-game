# Decisions: Monster Render Optimization

- Date: 2026-11-20
- Status: Confirmed

## D01. 몬스터 HP 바 렌더링 방식
- **Chosen**: 단일 2D `<canvas>` 오버레이로 교체 (`MonsterHpBarLayer`)
- **Rationale**: Chrome DevTools Performance Trace 측정 결과, 몬스터가 많을 때 매 프레임 `div` 요소들의 `style.left`, `style.top`, `style.width`를 갱신하면서 `UpdateLayoutTree` 및 `ForcedReflow`가 3,861회 이상 발생해 메인 스레드 버벅임을 유발했다. 화면 전체 크기의 단일 `<canvas>` 1장에 모든 HP 바와 `⚡STUN` / `❄️SLOW` 태그를 일괄 드로우하면 브라우저 레이아웃 재계산을 0회로 제거할 수 있다.

## D02. Three.js 드로우콜 및 스폰 부하 최적화 범위
- **Chosen**: 바닥 그림자(`DropShadow`) `InstancedMesh` 통합 + `TargetModels3D` 미캐싱 재질/지오메트리 공유 캐시 정리 + `ShaderWarmup` 보완
- **Rationale**: 모든 몬스터·아이템·투사체마다 개별 `shadowMesh`를 붙이는 대신 씬 전체에서 단 1개의 `THREE.InstancedMesh`로 일괄 렌더링하면 마릿수에 비례하던 그림자 드로우콜을 1회로 압축할 수 있다. 또한 스폰마다 `new`로 생성되던 일부 재질을 공유 캐시(`getCachedMaterial`)로 전환해 스폰 시점의 90ms 스파이크를 완화한다. (몬스터 `THREE.Group` 전체 풀링은 상태 오염 회귀 위험이 커 범위에서 제외)

## D03. 최적화 검증 기준
- **Chosen**: Vitest 회귀·신규 단위 테스트 통과 + 브라우저(Chrome DevTools Trace) 성능 실측 검증
- **Rationale**: 기존 테스트(`three-stage-and-models.test.ts` 등)의 호환성을 유지·갱신하고, 2D Canvas HP 바 및 그림자 인스턴싱 매니저 단위 테스트를 추가한다. 구현 완료 후 실제 브라우저 트레이스로 레이아웃 스래싱 해소와 드로우콜 감소를 정량 검증한다.
