# Task: T08 Update Perf Script and Verify

## Status: done

## Goal
후처리 제거로 깨진 측정 스크립트를 고치고, P01의 결과를 실측으로 확인한다. 수치가 기준에 못 미치면 다음 Phase로 넘어가지 않는다.

## Decision Summary
- D14: 실제 플레이 중 `linkProgram` 0회, 처치 시 텍스처 업로드 0회, 프레임 p95가 60Hz 16.7ms 또는 50Hz 20ms 이내.
- 측정 전제: `npm run dev` 실행 중(https://localhost:5173), 이 맥의 Radeon Pro 560X.

## Implementation

### I01. 스크립트 갱신

- Related Files:
  - `.memory/references/scripts/perf-frame-profile.mjs` — 주입 지점과 시나리오 수정; modify

#### Details
- **Execution Flow / Logic**:
  1. `GameCanvas3D.tsx` 라우트 주입을 바꾼다.
     - `container.appendChild(renderer.domElement);` 뒤에 `window.__renderer=renderer;`
     - `scene.add(particles.group);` 뒤에 `window.__particles=particles;`
     - `composer`, `bloomPass` 주입은 삭제한다.
  2. `PCGamePage.tsx` 라우트 주입과 `__noReact`, `noBloom`, `dpr1`, `noPointLights`, `noMuzzleFlash` 토글을 지운다. `noCss` 토글도 지운다.
  3. `__particles.particles.length`를 `__particles.activeParticleCount`로 바꾼다.
  4. 시나리오를 아래처럼 정리한다.
     - 스파이크: 몬스터 첫 스폰, 1마리 처치(같은 종류 생존), 전부 처치 후 재스폰 2회, 카드 스폰 2회, 스킬 3종
     - 지속: 개틀링 Lv.4 연사, 샷건 Lv.4 연사, 피버 연사
     - 실제 플레이 30초: `linkProgram`, 텍스처 업로드, 초당 커밋, 프레임 분포
     - 스크린샷: 한 발 쏜 직후 화면(`out/after-shot.png`)
  5. 결과를 `out/perf-after-P01.json`에 저장한다.

### I02. 측정과 판정

#### Details
- 실행:
  ```bash
  node .memory/references/scripts/perf-frame-profile.mjs 3440 1440 1 ultrawide 3000
  node .memory/references/scripts/perf-frame-profile.mjs 1440 900 2 retina 3000
  ```
- **판정 기준**:
  | 항목 | 기준 | 수정 전 |
  | :--- | :--- | :--- |
  | 실제 플레이 `linkProgram` | 0회 | 7회 |
  | 실제 플레이 0.25초 초과 프레임 | 0회 | 9회 |
  | 처치 시 텍스처 업로드 | 0회 | 2회 |
  | 카드 두 번째 스폰 최대 프레임 | 100ms 미만 | 561ms |
  | 개틀링 연사 평균 FPS | 90 이상 | 37 |
  | 개틀링 연사 p95 | 20ms 이하 | 28ms(블룸 끈 뒤) |
  | 전투 중 초당 React 커밋 | 15회 이하 | 25~50회 |
  | 사격 직후 스크린샷 | 화면이 덮이지 않음 | 대부분 청록색 |
- 측정이 길어지면 발열 제한이 걸린다. 각 실행 뒤 `pmset -g therm`의 `CPU_Speed_Limit`가 100에 가까워진 다음 다음 측정을 한다.

### I03. 기준 미달 시

#### Details
- 원인을 찾아 해당 Task의 코드를 고친 뒤 다시 측정한다. 기준 수치를 낮추지 않는다.
- `linkProgram`이 남으면 어떤 재질인지 기록한다. `renderer.info.programs`의 이름과 셰이더 코드로 찾는다. 앵커 그룹에 빠진 재질을 추가한다.
- 수정으로 해결되지 않으면 결과를 사용자에게 보고하고 판단을 받는다.

## Acceptance Criteria
- [x] I02 표의 기준을 모두 만족한다.
- [x] 측정 결과 파일이 `out/`에 있다.
- [x] 사격 직후 스크린샷을 직접 확인했다.

## Validation
- `node .memory/references/scripts/perf-frame-profile.mjs 3440 1440 1 ultrawide 3000` — 기준 충족
- `npm test` — 전체 통과

## Commit Message
```text
test(perf): verify render and stutter fixes with updated profiler

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T08-update-perf-script-and-verify

- Update profiler for direct rendering
- Record shader, texture, frame, and commit measurements
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: test(perf): verify render and stutter fixes with updated profiler
