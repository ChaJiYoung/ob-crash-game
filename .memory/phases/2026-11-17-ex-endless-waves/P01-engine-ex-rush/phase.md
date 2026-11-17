# Phase: P01 엔진: 무기 밸런스와 EX 러시

먼저 본편 무기 수치(D10·D11)를 바로잡고, 그 위에서 엔진(`BeerCrusherEngine`)만으로 EX가 끝까지 돌아가며 기록이 올바르게 나오게 한다. 화면은 아직 기존 HUD 그대로다. 검증은 vitest와 시뮬레이션 스크립트로 한다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 무기 밸런스: 탄창 Lv.3 증가, 리볼버 관통 60→40%, 샷건 반경 0.45, 부수 처치 실제 판정 | [T01](./T01-weapon-balance.md) |
| T02 | `done ✅` | EX 진입(강화 MAX) + DANGER·테마 러시 스폰(필드 상한 15/23) + 기록 | [T02](./T02-ex-entry-and-rush-spawn.md) |
| T03 | `done ✅` | EX 보스 난입(60초, 소형↔대형, 누적, 클리어 연출 없음) | [T03](./T03-ex-boss-intrusion.md) |

## Progress
- done: 3/3 (active: none)
