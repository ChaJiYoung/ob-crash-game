# 렌더링 진단 스크립트

전제: `npm run dev`(Vite https://localhost:5173 + WS 8787) 실행 중. 프로젝트 루트에서 실행.

| 스크립트 | 용도 | 전제 조건 |
|---|---|---|
| `capture-start-state.mjs` | PC 단독 시작 → 엔진 상태(activeTargets, isWeaponSelectPending) 출력 + 스크린샷 `out/start-state.png` | 없음 (`window.__engine`은 기본 노출) |
| `inspect-target-meshes.mjs` | 카드/몬스터 메시의 위치·NDC·자식 머티리얼 정보 출력 | `GameCanvas3D.tsx`에서 `window.__scene/__camera/__targetMeshMap` 임시 노출 필요 (커밋 금지) |
| `perf-frame-profile.mjs` | 멈춤 원인(셰이더 재생성·텍스처 업로드), 항목별 FPS 비교, 실제 플레이 프레임 측정. 인자: `너비 높이 DPR 태그 측정ms` | 소스 수정 없음(라우트에서 임시 주입). 결과는 `out/`에 저장. 재연결 대상 문자열이 바뀌면 함께 수정 |
| `simulate-balance-bundles.ts` | 봇(조준/대충/훑기/한 곳)으로 판정 범위·웨이브 조합의 클리어율 비교. `npx tsx <경로> 40` | 없음. 게임 상수를 런타임에서만 변경 |
| `simulate-current-decisions.ts` | 결정 문서의 최종 수치 전체 시뮬레이션(7웨이브, 보스 3회, 쉴드, 카드 9종, 연사 규칙). 봇 7종의 클리어율, 승리 시 체력, 피버·카드·보스 시간 출력. `npx tsx <경로> 60` | 없음. 런타임 패치만 사용. 엔진 구현 후에는 패치를 실제 코드로 교체 |

사용 예: 조명 다이어트 전/후 `capture-start-state.mjs` 스크린샷 비교.

```bash
node .memory/references/scripts/capture-start-state.mjs
```
