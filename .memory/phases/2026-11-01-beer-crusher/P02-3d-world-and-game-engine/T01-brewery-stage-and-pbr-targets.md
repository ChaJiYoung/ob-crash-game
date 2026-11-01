# Task: T01 오비맥주 브루어리 & 네온 펍 3D 스테이지, 6종 타겟 PBR 메쉬, 1인칭 탭건 및 파티클·사운드 구현

## Status: pending

## Goal
외부 무거운 `.glb` 에셋 없이 Three.js 절차적(Procedural) PBR 지오메트리와 동적 캔버스 텍스처로 **오비맥주 브루어리 & 네온 펍 3D 스테이지(`D04`)**, **6종 타겟 3D 메쉬(`D02`, `D03`)**, **1인칭 생맥주 탭건(`DraftTapGun3D`)**, 그리고 **물줄기·거품 파티클 및 Web Audio 사운드 합성기**를 구현합니다.

## Decision Summary
- **D02/D03**: 4종 캔맥주(`pilgood`, `caslight`, `obi`, `hanmac`) + 500ml 크리스탈 생맥주잔(`mug`) + 업소용 생맥주 냉각기 보스(`boss`)를 절차적 Three.js PBR(`MeshStandardMaterial` / `MeshPhysicalMaterial`)로 구현
- **D04**: 전방 `1.8m` 원목/황동 바 카운터 데드라인, 부채꼴 거리 아크(`10m`, `20m`, `28m`), 좌우 구리 발효 탱크 6기 및 네온 사인 배경 홀 구성

## Implementation

### I01. 브루어리 3D 스테이지, 6종 타겟 PBR 팩토리 및 1인칭 생맥주 탭건 구현
- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D`, `BreweryStageRig` — 3D 홀 바닥, 부채꼴 거리 아크(`10m`/`20m`/`28m`), 구리 발효 탱크 6기, `1.8m` 바 카운터 방어선, 네온 조명 생성; new
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `updateTargetAnimation3D`, `applyTargetHitFlash3D` — 6종 타겟(`pilgood`, `caslight`, `obi`, `hanmac`, `mug`, `boss`) 절차적 PBR 3D 그룹 생성 및 애니메이션; new
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D` — 화면 우측 하단 1인칭 골드/크롬 생맥주 탭건 3D 모델, 조준 회전, 반동(Recoil) 및 피버 발광 제어 클래스; new
  - `src/pc/three/ParticleEffects3D.ts` :: `ParticleEffects3D` — 청량한 맥주 워터젯 궤적 및 타격 시 황금/화이트 거품 폭발 파티클 풀; new
  - `src/pc/audio/SoundSynthesizer.ts` :: `SoundSynthesizer` — Web Audio API 기반 사격, `PERFECT`/`GREAT`/`GOOD` 타격음, 1.2초 자동 장전음, 피버 팡파르 합성기; new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface BreweryStageRig {
    root: THREE.Group;
    neonLights: THREE.PointLight[];
    defenseArcMesh: THREE.Mesh;
    updateStageAnimation: (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => void;
  }
  export function buildBreweryStage3D(scene: THREE.Scene): BreweryStageRig;
  export function createTargetMesh3D(kind: TargetKind): THREE.Group;
  export function updateTargetAnimation3D(mesh: THREE.Group, kind: TargetKind, elapsedSec: number, hpRatio: number): void;

  export class DraftTapGun3D {
    public readonly group: THREE.Group;
    constructor();
    updateAimAndRecoil(aimX: number, aimY: number, dtSec: number, isFeverActive: boolean): void;
    triggerRecoil(isFeverShot?: boolean): void;
  }
  ```
- **Data & Schema Fields**:
  - `createTargetMesh3D(kind)` 내부 `userData` 필드: `{ kind: TargetKind, hitRadiusM: number, labelTextureGenerated: boolean }`
- **Execution Flow / Logic**:
  1. **Precondition & Validation**:
     - Node.js Vitest(Headless) 환경에서 `document`가 없거나 `canvas.getContext('2d')`가 `null`일 때도 크래시 없이 단색 `THREE.DataTexture` 폴백을 반환하도록 방어 로직 포함.
  2. **Core Processing**:
     - `pilgood`, `caslight`, `obi`, `hanmac`: 알루미늄 베벨 실린더 바디(`metalness: 0.78, roughness: 0.24`), 상단 실버 크롬 리드 & 풀탭 링, 브랜드별 동적 캔버스 라벨(`FiLGOOD` 고래, `Cass Light` 아이스 실버, `OB LAGER` 랄라베어, `HANMAC` 골드 엠블럼), 거품 크라운.
     - `mug` (`500ml 생맥주잔`): 10각 다면체 유리 바디(`MeshPhysicalMaterial`, `transmission: 0.55`), 내부 황금 생맥주 코어 + 상승 기포 입자, 우측 두꺼운 유리 손잡이(`TorusGeometry`), 상단 풍성한 구름형 크림 거품 헤드.
     - `boss` (`업소용 생맥주 냉각기 보스`): 대형 매트 블랙 스틸 캐비닛(`metalness: 0.72`), 전면 황금 OB 엠블럼 패널, 측면 통풍 루버 그릴, 상단 스테인리스 드립 트레이, 중앙 크롬 드래프트 타워 + 듀얼 골드 스파우트 탭 & 블랙 레버 핸들, 하단 4륜 캐스터 바퀴.
  3. **State Transition & Return**:
     - 생성된 `THREE.Group` 반환 및 매 프레임 `updateTargetAnimation3D`로 캔/머그의 바운스·틸트 및 보스 레버/LED 점멸 애니메이션 갱신.

### I02. 3D 스테이지·6종 타겟 메쉬·1인칭 탭건 구조 단위 테스트
- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `describe('3D Brewery Stage & 6 Target Models')` — 6종 타겟 메쉬 생성, 자식 지오메트리 구성, 스테이지 및 탭건 반동 검증; new

#### Details
- 6종 `TargetKind` 각각에 대해 `createTargetMesh3D(kind)` 호출 시 `THREE.Group`이 정상 생성되고 `userData.kind === kind`, 자식 Mesh 개수가 최소 4개 이상(보스는 10개 이상)인지 검증.
- `buildBreweryStage3D(scene)` 호출 시 방어선 아크(`defenseArcMesh`)와 조명(`neonLights`)이 씬에 추가되는지 검증.
- `DraftTapGun3D.triggerRecoil()` 호출 후 `updateAimAndRecoil` 실행 시 Z축 반동 변위가 발생했다가 원위치로 복원되는지 검증.

## Acceptance Criteria
- [ ] 외부 이미지/3D 파일 의존성 없이 6종 타겟(`pilgood`, `caslight`, `obi`, `hanmac`, `mug`, `boss`)이 고유한 실루엣과 브랜드 컬러로 생성됨
- [ ] 브루어리 3D 스테이지(`1.8m` 바 카운터 방어선 + `10m`/`20m`/`28m` 부채꼴 거리 아크)와 1인칭 생맥주 탭건이 정상 동작함
- [ ] `npx vitest run tests/three-stage-and-models.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 6종 타겟 메쉬 팩토리, 스테이지 릭, 탭건 반동 단위 테스트 통과

## Commit Message
```text
feat(3d): build brewery 3D stage, 6 procedural PBR targets, tap gun, and audio-particle fx

Plan: 2026-11-01-beer-crusher
Phase: P02-3d-world-and-game-engine
Task: T01-brewery-stage-and-pbr-targets

- Implement BreweryStage3D with 1.8m bar counter defense line and fan distance arcs
- Implement 6 procedural PBR targets (4 cans, 500ml crystal mug, commercial cooler boss)
- Add DraftTapGun3D, ParticleEffects3D, and Web Audio SoundSynthesizer
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
