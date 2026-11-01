# Task: T01 실제 '올 뉴 카스 프레시' V-컷 바디 라벨(`bottle.jpg`) 및 전용 넥 라벨(`bottle-neck.jpg`) 고해상도 텍스처 생성

## Status: done

## Goal
불량 체커보드 흑백 로고(`scripts/assets/cass_logo.png`)를 제거하고, 사용자가 제시한 실제 '올 뉴 카스 프레시' 투명병 사진(`scripts/assets/cass_fresh_ref.jpg`)의 디자인과 100% 일치하는 **상단 V-컷 대각선 `Cass Fresh` 블루/골드 바디 라벨(`public/textures/labels/bottle.jpg`)**과 **육각형 눈꽃 온도 센서 + `COLD BREWED` 전용 넥 라벨(`public/textures/labels/bottle-neck.jpg`)**을 고해상도(1024×512)로 분리 생성한다.

## Decision Summary
- D01 반영: 바디 라벨과 넥 라벨이 동일한 텍스처를 공유해 병목에 바디 로고가 찌그러져 나오던 문제를 해결하기 위해 `bottle.jpg`와 `bottle-neck.jpg` 2종의 독립 텍스처를 생성한다.
- 정면 카메라(`u = 0.5`, `x = 512` 중심)에서 보았을 때 참조 사진(`cass_fresh_ref.jpg`)의 정면 비율과 정확히 일치하도록 정면 영역(`x = 270 ~ 754`)에 상단 V-컷(위쪽은 투명 병맥주 황금빛 앰버 톤), 대각선 상승 입체 `Cass` 로고, 필기체 `Fresh`, 중앙 하단 육각형 눈꽃 쿨 타이머 센서, 골드 `COLD BREWED` 및 하단 골드 메탈릭 밴드를 정밀 렌더링한다.

## Implementation

### I01. 불량 로고 제거 및 `scripts/generate-labels.mjs` 카스 프레시 바디/넥 라벨 렌더러 재구현

- Related Files:
  - `scripts/assets/cass_logo.png` — 체커보드 배경이 박힌 잘못된 흑백 문장 이미지 삭제; delete
  - `scripts/assets/cass_fresh_ref.jpg` — 사용자 제공 실제 카스 프레시 투명병 참조 에셋; read-only
  - `scripts/generate-labels.mjs` :: `labelConfigs` (`bottle`, `bottle-neck`) — 정품 V-컷 바디 라벨 및 전용 넥 라벨 캔버스 생성기; modify
  - `public/textures/labels/bottle.jpg` — 생성된 바디 라벨 텍스처; modify
  - `public/textures/labels/bottle-neck.jpg` — 생성된 전용 넥 라벨 텍스처; new

#### Details
- **Body Label (`bottle.jpg`, 1024×512)**:
  1. **배경 및 상단 V-컷 앰버 존**:
     - 라벨 상단 중앙(`x = 512`, `y = 85` 꼭짓점)이 V자 형태로 깊게 파인 V-컷 구조를 구현하기 위해, V-컷 위쪽 삼각형 영역은 병 내부의 황금빛 앰버 맥주 색상(`#eab308` ~ `#ca8a04` 그라데이션)으로 칠해 유리병 몸통과 자연스럽게 이어지게 한다.
     - V-컷 아래쪽 메인 라벨 영역은 실제 카스 프레시 특유의 메탈릭 코발트/로열 블루 사선 광택 그라데이션(`#001e4d` ➔ `#0052b4` ➔ `#0284c7` ➔ `#002b66`)과 대각선 다이나믹 스트라이프 패턴을 적용한다.
     - V-컷 경계선에는 얇고 날렵한 골드/실버 메탈릭 라인을 따라 그린다.
  2. **대각선 `Cass` & 필기체 `Fresh` 로고 (정면 중앙 `x = 512`)**:
     - 좌하단에서 우상단으로(-22도 기울기) 시원하게 솟구치는 거대한 화이트·실버 3D 입체 **`Cass`** 타이포그래피(짙은 네이비 드롭 섀도우 + 실버 베벨 하이라이트)를 렌더링한다.
     - `Cass` 우측 하단에 하늘색(`#7dd3fc`) 필기체(Italic Serif/Script) **`Fresh`**를 배치한다.
  3. **중앙 하단 육각형 눈꽃 온도 센서(Cool Timer) & `COLD BREWED`**:
     - 중앙(`x = 512`)에서 수직으로 내려오는 실버/골드 온도계 스템 라인과 정육각형 시안 블루(`#38bdf8`) 메탈 배지 내부에 눈꽃(Snowflake) 아이콘을 정밀하게 그린다.
     - 센서 좌측에 `카스 프레시`, 센서 바로 아래에 굵은 골드 메탈릭(`#fbbf24`) **`COLD BREWED`**와 하늘색 **`저온숙성으로 프레시하게`** 문구를 배치한다.
  4. **하단 골드 메탈릭 밴드**:
     - `y = 468 ~ 512` 구간에 고급스러운 골드 포일 그라데이션(`#b45309` ➔ `#fbbf24` ➔ `#f59e0b` ➔ `#b45309`) 밴드를 두른다.
- **Neck Label (`bottle-neck.jpg`, 1024×512)**:
  1. 상단 68%(`y = 0 ~ 348`): 메탈릭 로열 블루 사선 그라데이션 배경 + 정중앙(`x = 512`, `y = 175`)에 하늘색 정육각형 배지(`#0284c7` / `#38bdf8`)와 눈꽃(Snowflake) 결정 아이콘.
  2. 하단 32%(`y = 348 ~ 512`): 골드 포일 그라데이션 밴드(`#d97706` ➔ `#fde047` ➔ `#b45309`) 배경 위에 짙은 네이비(`#001e4d`) 볼드체로 **`COLD BREWED`**를 선명하게 인쇄한다.

## Acceptance Criteria
- [ ] `scripts/assets/cass_logo.png`(불량 흑백 체커보드 이미지)가 삭제되었다.
- [ ] `node scripts/generate-labels.mjs` 실행 시 `public/textures/labels/bottle.jpg`와 `public/textures/labels/bottle-neck.jpg`가 정상 생성된다.
- [ ] 생성된 두 이미지를 시각적으로 확인했을 때 체커보드 아티팩트가 전혀 없고, 실제 카스 프레시 사진의 V-컷 블루/골드 바디 라벨 및 `COLD BREWED` 넥 라벨과 일치한다.

## Validation
- `node scripts/generate-labels.mjs` — 7종 라벨(`pilgood`, `caslight`, `obi`, `hanmac`, `bottle`, `bottle-neck`, `boss`) 생성 확인

## Commit Message
```text
feat(assets): generate authentic Cass Fresh V-cut body label and dedicated COLD BREWED neck label

Plan: 2026-11-02-real-cass-fresh-longneck-bottle
Phase: P01-real-cass-fresh-longneck-bottle
Task: T01-authentic-cass-vcut-and-neck-labels

- Remove defective checkerboard cass_logo.png asset
- Rebuild bottle.jpg with V-cut top edge, diagonal 3D Cass Fresh typography, hexagon cool-timer sensor, and gold COLD BREWED band
- Add dedicated bottle-neck.jpg texture with hexagon snowflake emblem and gold COLD BREWED collar band
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
