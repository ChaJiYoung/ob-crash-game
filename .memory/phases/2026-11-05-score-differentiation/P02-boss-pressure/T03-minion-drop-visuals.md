# Task: T03 Minion Drop Visuals

## Status: todo

## Goal
낙하 중인 부하를 위에서 떨어지는 모습으로 그리고, 착지 위치에 표식을 보여 준다. 낙하 중에는 체력바를 숨긴다.

## Decision Summary
- D07 구현 메모: 착지 위치 표식(그림자 또는 링)으로 모바일에서도 대응할 수 있게 한다.
- 성능 규칙: 플레이 중 `linkProgram` 0회, 처치·착지 시 텍스처 업로드 0회. 새 재질은 셰이더 워밍업 앵커에 포함하거나 이미 워밍업된 재질을 재사용한다.

## Implementation

### I01. 낙하 위치와 표식

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 대상 메시 갱신(`:541` 부근 `baseY`/`position.set`) — 낙하 높이 적용; modify
  - `src/pc/three/TargetModels3D.ts` :: 착지 표식 생성 함수; modify
  - `src/pc/three/ShaderWarmup.ts` :: 표식 재질 앵커(새 재질을 쓸 때만); modify

#### Details
- **Execution Flow / Logic**:
  1. 낙하 중(`dropLandAtMs > nowMs`)인 대상: `remaining = (dropLandAtMs - nowMs) / dropMs`, `y = baseY + DROP_HEIGHT_M * remaining * remaining`(가속하며 떨어지는 느낌, `DROP_HEIGHT_M`은 약 8m). x/z는 착지 위치 그대로.
  2. 착지 표식: 대상 위치 바닥(y 약 0.05)의 얇은 링 메시. 남은 시간이 줄수록 링이 수축하고 투명도가 올라간다. 풀링(최대 8개)하고 낙하가 끝나면 숨긴다.
  3. 표식 재질은 이미 워밍업된 `MeshBasicMaterial`(바닥 네온선 등)을 재사용한다. 새 재질이 필요하면 `ShaderWarmup`의 앵커 목록에 추가한다.
  4. 착지 순간 약한 먼지/링 파티클은 기존 `ParticleEffects3D` 풀을 재사용한다(새 지오메트리 생성 금지).

### I02. 체력바

- Related Files:
  - `src/pc/components/MonsterHpBarLayer.tsx` :: 막대 표시 조건 — 낙하 중 숨김; modify

#### Details
- 낙하 중 대상에는 체력바를 그리지 않는다. 착지하면 정상 표시.

### I03. 테스트와 렌더 측정

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: 표식 생성·풀링 검사; modify
  - `.memory/references/scripts/perf-frame-profile.mjs` :: 보스 소환 구간 포함; modify

#### Details
- 표식 풀이 최대 개수를 넘지 않고, 낙하가 끝나면 숨겨진다.
- 프로파일러 보스 구간에서 `linkProgram` 0회, 처치·착지 시 텍스처 업로드 0회를 확인한다.


## Acceptance Criteria
- [ ] 부하가 위에서 떨어지고 착지 위치가 미리 보인다.
- [ ] 낙하 중에는 체력바가 보이지 않는다.
- [ ] 보스 소환 구간에서 `linkProgram` 0회, JS 막힘 프레임이 늘지 않는다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/render-budget.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음, `npm run build` — 성공
- `node .memory/references/scripts/perf-frame-profile.mjs` — 보스 구간 `linkProgram` 0 (개발 서버 필요)

## Commit Message
```text
feat(render): animate minion drops with a landing marker

Plan: 2026-11-05-score-differentiation
Phase: P02-boss-pressure
Task: T03-minion-drop-visuals

- Drop minions from above with an accelerating fall
- Show a pooled landing ring that shrinks until impact
- Hide health bars while a minion is still falling
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
