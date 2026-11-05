# Task: T02 소형·대형 냉각기 모델, OB 로고, 대왕 바닥 맞춤

## Status: done

## Goal
소형은 은색 1구, 대형은 검정 3구·금색 레버·왕관으로 한눈에 구분되고, 이름판에 실제 OB 로고가 있으며, 둘 다 바닥에 서 있다.

## Decision Summary
- 결정 D05, D06, D07. 시안: `.memory/references/screens/mockup-boss-cooler-design-2026-11-05.png` 1안. 체력, 판정 크기, `kingScale`, 이동, 소환, 발사는 바꾸지 않는다. 대왕의 판정 높이만 D07대로 올라간다.

## Implementation

### I01. 로고 파일
- Related Files:
  - `public/textures/labels/ob-logo.jpg`; new
  - `public/textures/labels/SOURCES.md`; modify

#### Details
- 내려받기: `curl -sL -A 'ob-crash-game/1.0' 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Oriental_Brewery_Co.%2CLtd._logo.jpg' -o public/textures/labels/ob-logo.jpg` 후 `file` 명령으로 JPEG(334×113)인지 확인한다.
- `SOURCES.md` 표에 추가: 대상 "냉각기 보스 이름판", 출처 `https://commons.wikimedia.org/wiki/File:Oriental_Brewery_Co.,Ltd._logo.jpg`(표기: 공개 도메인, 출처 www.obbeer.co.kr), 주의 "상표권은 별개, 2020년 CI 이전 로고, 공개 전 최신 파일과 승인 필요. 같은 파일명으로 교체".
- `boss.jpg` 줄의 설명은 "이전 모델용, 현재 게임 모델은 사용하지 않음"으로 고친다.

### I02. 모델
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `getObLogoTexture`, `kind === 'boss'` 분기(약 357행), `shadowMesh`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function createTargetMesh3D(kind: TargetKind, bossRole?: 'cooler' | 'king'): THREE.Group;
  function getObLogoTexture(): THREE.Texture | null;
  ```
- `getObLogoTexture`: `typeof document === 'undefined'`이면 `null`. 아니면 한 번만 `new THREE.TextureLoader().load('/textures/labels/ob-logo.jpg')`로 읽어 `colorSpace = THREE.SRGBColorSpace`, `markShared`하고 캐시한다. `null`이면 이름판은 흰색 재질로 그린다(테스트 환경).
- 치수(모델 안쪽 단위, 기존 `modelScale` 1.65 적용 전): 몸통 `W=1.3, H=1.75, D=1.2`, 바닥 `floorY = -1.15 / 1.65`(= -0.697), 몸통 중심 `cy = floorY + H / 2`.
- 기존 cabinet, grille, tower, spout, handle, wheel 코드를 모두 아래로 교체한다. 재질은 `getCachedMaterial`을 쓰되 몸통과 윗면만 매번 새로 만든다.
  | 부품 | 지오메트리 / 위치 | 소형 | 대형 |
  | :--- | :--- | :--- | :--- |
  | 몸통 | `BoxGeometry(W,H,D)`, `y=cy`, `userData.isBodyMaterial=true` | `0xc4cad2`, metal 0.75, rough 0.32 | `0x17191d`, metal 0.55, rough 0.42 |
  | 윗면(재질 배열 index 2) | 몸통과 함께 | `0x3a4048` | `0x3a4048` |
  | 옆 통풍구 | `BoxGeometry(0.015,0.035,D*0.55)`, 좌우 `x=±(W/2+0.008)`, 위·아래 묶음 5줄씩 간격 0.07 | `0x050608` | 같음 |
  | 탭 | `x` 목록에 하나씩(아래 참고), `y=cy+0.46`, `z=D/2` | `x=[0]`, 크기 k=1.6 | `x=[-0.34,0,0.34]`, k=1.3 |
  | 레버 | 탭의 위쪽, `rotation.x=-0.22`, `handles.push` | 검정 `0x0a0a0a` | 금색 `goldMat` |
  | 물받이 | `BoxGeometry(W*0.86,0.16,0.42)`, `y=floorY+0.2`, `z=D/2+0.2`; 위에 은색 살 9줄 | `0x17191d` | 같음 |
  | 이름판 | `PlaneGeometry(0.6,0.2)`(로고 비율 약 3:1), `y=cy-0.2`, `z=D/2+0.012`; 뒤에 `BoxGeometry(0.66,0.26,0.01)` 테두리 | 은색 `capMat` | `goldMat` |
  | 왕관 | 대형만. `y=floorY+H+0.08`, 반지름 0.42 원통 띠 + 원뿔 8개(`ConeGeometry(0.095,0.3,6)`) + 빨간 구 4개(`emissive 0xef4444`) | 없음 | 있음 |
- 탭 하나: 크롬 칼라 `CylinderGeometry(.06k,.06k,.1k)`(X축 회전, `z+.05k`), 크롬 몸통 `CylinderGeometry(.055k,.05k,.2k)`(`z+.14k`), 주둥이 `CylinderGeometry(.03k,.022k,.16k)`(`y-.18k, z+.14k`), 레버 `CylinderGeometry(.036k,.024k,.34k)`(`y+.24k, z+.12k`). 크기별 지오메트리 캐시 키에 `k`를 넣는다.
- `bossRole === 'king'`일 때 대형, 그 외(`undefined` 포함)는 소형이다. `docs` 도구와 예열이 역할 없이 불러도 동작해야 한다.
- 함정: 예전 코드는 공유 재질 `capMat`을 몸통 재질 배열에 넣었다. `isBodyMaterial` 메시의 재질은 얼음 효과가 색을 바꾸므로, 몸통 배열에는 공유 재질을 넣지 않는다.
- `root.userData.bossRole = bossRole`, `bossTapHandles = handles`를 유지한다. `updateTargetAnimation3D`는 레버 수와 상관없이 동작한다.
- 대왕 그림자: 역할이 `king`이면 `shadowMesh.position.y = -(baseY * GAME_TUNING.boss.kingScale) + 0.01`.

### I03. 연결과 대왕 높이
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 메시 생성(약 618행); modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnBossEncounter`; modify
  - `src/pc/three/ShaderWarmup.ts` :: `buildShaderAnchorGroup`; modify

#### Details
- `mesh = createTargetMesh3D(target.kind, target.bossRole);`
- 대왕 생성 뒤 `king.customBaseY = getTargetBaseY('boss', false) * GAME_TUNING.boss.kingScale;`(1.725). 판정 중심, 체력바, 처치 폭발은 모두 `customBaseY` 또는 메시 위치를 따라가므로 함께 올라간다.
- 예열: `WARMUP_TARGET_KINDS` 순회 뒤 `group.add(createTargetMesh3D('boss', 'king'));`를 추가한다. 빠뜨리면 7웨이브 첫 등장 때 끊길 수 있다.

### I04. 테스트
- Related Files:
  - `tests/three-stage-and-models.test.ts` :: 보스 검사(약 64행); modify
  - `tests/boss-model-roles.test.ts`; new

#### Details
- 기존 검사: 레버 수 2 → 1, 주석의 `draft tower, dual taps` 표현을 새 구조로 고친다.
- 새 테스트:
  - 소형 레버 1개, 대형 3개. 대형만 왕관이 있다(`name === 'bossCrown'`).
  - 소환 때 대형 레버 3개 모두 `0.65`, 평소 `-0.22`.
  - 소형: `Box3`로 잰 몸통 바닥이 `baseY` 위치에서 월드 y 0 ±0.05.
  - 대형: `kingScale`을 곱하고 `customBaseY` 위치에 뒀을 때 바닥이 0 ±0.05, 그림자가 약 0.01.
  - 엔진: 7웨이브 대왕의 `customBaseY`는 1.725이고 냉각기는 `undefined`. 체력과 `hitRadiusM`은 그대로다.
  - 예열 그룹에 `bossRole === 'king'`인 메시가 있다.

## Acceptance Criteria
- [x] 7웨이브에서 소형 둘과 대왕이 색, 탭 수, 왕관으로 바로 구분된다.
- [x] 이름판에 실제 OB 로고가 보이고, 파일을 바꾸면 로고가 바뀐다.
- [x] 소형과 대왕이 바닥에 서 있고 물받이가 보인다.
- [x] 소환 때 모든 레버가 젖혀지고, 얼음 효과가 다른 모델 색을 바꾸지 않는다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/boss-model-roles.test.ts tests/boss-encounters.test.ts tests/boss-clear-sequence.test.ts tests/boss-hp-summons.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 40 all "보통(탭)"` — T01 결과와 비교해 기록(대왕 판정 높이 변경 확인)

## Commit Message
```text
feat(boss): rebuild the coolers as front-tap units with a real OB logo plate

Plan: 2026-11-05-playtest-visual-feedback
Phase: P02-shell-and-boss-models
Task: T02-boss-cooler-models

- Small cooler is silver with one tap; the king is black with three gold taps and a crown
- Stand the king on the floor instead of sinking 0.94m below it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
