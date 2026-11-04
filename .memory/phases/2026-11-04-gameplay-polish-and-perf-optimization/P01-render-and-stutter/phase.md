# Phase: P01 Render and Stutter

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 총구 플래시 크기 버그 수정과 조명 깜빡임 완화 | [T01](./T01-fix-muzzle-flash-and-soften-stage-pulses.md) |
| T02 | `done ✅` | 블룸 제거와 렌더링 300만 픽셀 상한 | [T02](./T02-remove-bloom-and-cap-render-pixels.md) |
| T03 | `done ✅` | 셰이더·공유 텍스처 유지와 예열 수정 | [T03](./T03-keep-shaders-and-shared-textures-alive.md) |
| T04 | `done ✅` | 포인트 라이트 3개를 네온 메시로 교체 | [T04](./T04-replace-point-lights-with-neon-strips.md) |
| T05 | `done ✅` | 파티클 묶어 그리기와 타격 이펙트 약 30% 축소 | [T05](./T05-instance-particles-and-slim-effects.md) |
| T06 | `done ✅` | HUD 블러·그림자 제거 | [T06](./T06-strip-hud-compositing-costs.md) |
| T07 | `done ✅` | HUD 갱신 구조 개선, 사격 이펙트 직접 호출, 효과음 중복 제거 | [T07](./T07-decouple-hud-and-shot-fx-from-react.md) |
| T08 | `in_progress 🔵` | 측정 스크립트 갱신과 성능 재측정 | [T08](./T08-update-perf-script-and-verify.md) |

## Progress
- done: 7/8 (active: T08)

## Phase Goal
게임 규칙을 바꾸기 전에 렌더링 문제부터 해결한다. 이후 Phase의 시뮬레이션과 직접 플레이가 멈춤 없는 상태에서 이루어지게 하기 위해서다.
