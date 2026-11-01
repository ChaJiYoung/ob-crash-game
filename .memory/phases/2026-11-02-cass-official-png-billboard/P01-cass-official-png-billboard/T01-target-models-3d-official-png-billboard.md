# Blueprint: T01 - TargetModels3D.ts의 bottle 타겟을 cass_official_veluga.png 고화질 실사 3D 빌보드로 개편

## Status
`done ✅`

## Description
3D 회전체 모델링의 단색 액체 셰이더로 인한 플라스틱 페트병 느낌을 근본적으로 제거하기 위해,
`src/pc/three/TargetModels3D.ts`의 `createTargetMesh3D('bottle')`을 정품 투명 700×700 PNG 에셋(`public/textures/cass_official_veluga.png`)을 사용하는 고화질 3D 실사 빌보드 메쉬 구조로 전면 교체한다.
동시에 피격 시 화이트 플래시/스쿼시 물리 애니메이션, 아이스 프리즈 서리 틴트 및 3D 얼음 링, 빅 스코프 머리 위 록온 마커, 바닥 그림자, 그리고 격파 시 뚜껑 솟구침 + 파편 비산 + 맥주 분수 연출이 100% 정상 작동하도록 유지한다.

## Target Files & Symbols
- `src/pc/three/TargetModels3D.ts`:
  - `getOrCreateCassOfficialTexture()`: 브라우저/Node 환경 겸용 텍스처 로더/캐시 (Canvas 기반 폴백 포함)
  - `createTargetMesh3D(kind: TargetKind)`: `kind === 'bottle'` 처리 로직을 실사 빌보드 메쉬 구성으로 교체.
  - `updateTargetAnimation3D(group, kind, ...)`: 빌보드 카메라 정면 정렬 및 서리/피격 틴트 호환성 유지.
- `tests/three-stage-and-models.test.ts`:
  - `bottle` 타겟 메쉬 계층 구조 검증 (`inner.children`, `DropShadow`, `frostRing`, `lockOnMarker` 등) 호환성 보장.

## Model Schema & Properties
```ts
// bottle 타겟의 inner 그룹 구조
interface CassBottleInnerGroup {
  children: [
    billboardMesh: THREE.Mesh | THREE.Sprite, // cass_official_veluga.png 기반 실사 메쉬 (PlaneGeometry 0.84 x 1.82)
    crownCapAnchor: THREE.Mesh,              // 3타 격파 시 은색 뚜껑 분출 앵커 (name: 'crownCap')
    neckAnchor: THREE.Mesh                   // 넥 라벨/넥 영역 앵커 (name: 'neckLabel')
  ];
}
```

## Verification Command
```bash
npm test && npx tsc --noEmit
```

## Commit Message
```text
feat(three): replace bottle target with official transparent PNG 3D billboard

Plan: 2026-11-02-cass-official-png-billboard
Phase: P01
Task: T01

- Replace LatheGeometry bottle with authentic 700x700 RGBA billboard (cass_official_veluga.png)
- Maintain 100% compatibility with hit flash, squash bounce, drop shadow, frost ring, and lock-on marker
- Preserve crownCap and neckLabel mesh anchors for 3D break particle explosions
- Verify unit tests across all 32 test suites
```
