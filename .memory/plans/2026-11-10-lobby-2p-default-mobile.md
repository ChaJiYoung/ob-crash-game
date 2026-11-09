# Plan: 로비 2P 기본 모바일 + 플레이어별 단계 뱃지 + 시작 버튼 상태 문구

## Goal
- 로비가 열리면 2P도 📱 모바일로 미리 선택돼 QR이 바로 보이고, 2P를 연결하지 않아도 1P만으로 시작할 수 있다는 점이 화면에서 분명히 보인다.
- 상단 배너는 플레이어(1P/2P)별 3단계 뱃지(QR 스캔 › 영점 조정 › 쏴서 시작)로 바뀌고 주황 문장은 사라진다. 전체 상태는 항상 보이는 시작 버튼의 괄호 문구로 알린다.
- 근거: [decisions/2026-11-10-lobby-2p-default-mobile.md](../decisions/2026-11-10-lobby-2p-default-mobile.md) (D01~D11)

- 랭킹의 `W7`이 클리어인지 사망인지 구분되도록 클리어 기록은 금색 "CLEAR" 글자로 보인다(D09~D10).
- 바뀐 화면의 문서 캡처를 다시 찍는다(D11).

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 2P 기본 모바일(로비 진입·로비 복귀 공통 규칙) | [P01](../phases/2026-11-10-lobby-2p-default-mobile/P01-default-slots/phase.md) |
| P02 | `done ✅` | 배너 플레이어별 뱃지, 시작 버튼 상태 문구, 2P 카드 "(선택)" | [P02](../phases/2026-11-10-lobby-2p-default-mobile/P02-lobby-guide-ui/phase.md) |
| P03 | `done ✅` | 랭킹 클리어 표시(서버 outcome 노출 + RankingTabs "CLEAR") | [P03](../phases/2026-11-10-lobby-2p-default-mobile/P03-ranking-clear-marker/phase.md) |
| P04 | `in_progress 🔵` | 문서 캡처 재촬영(로비 3장 + 결과 랭킹) | [P04](../phases/2026-11-10-lobby-2p-default-mobile/P04-docs-captures/phase.md) |

## 검증 공통 커맨드
- `npx vitest run <파일>` (개별), `npm test` (전체: `vitest run`), `npx tsc --noEmit` (타입)
