# 렌더링 진단 스크립트

전제: `npm run dev`(Vite https://localhost:5173 + WS 8787) 실행 중. 프로젝트 루트에서 실행.

| 스크립트 | 용도 | 전제 조건 |
|---|---|---|
| `capture-start-state.mjs` | PC 단독 시작 → 엔진 상태(activeTargets, isWeaponSelectPending) 출력 + 스크린샷 `out/start-state.png` | 없음 (`window.__engine`은 기본 노출) |
| `inspect-target-meshes.mjs` | 카드/몬스터 메시의 위치·NDC·자식 머티리얼 정보 출력 | `GameCanvas3D.tsx`에서 `window.__scene/__camera/__targetMeshMap` 임시 노출 필요 (커밋 금지) |

사용 예: 조명 다이어트 전/후 `capture-start-state.mjs` 스크린샷 비교.

```bash
node .memory/references/scripts/capture-start-state.mjs
```
