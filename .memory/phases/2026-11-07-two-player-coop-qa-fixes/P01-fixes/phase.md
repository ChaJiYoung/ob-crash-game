# Phase: P01 QA 수정

QA에서 나온 문제 5건을 고친다. 끝나면 전체 테스트·타입·빌드가 통과하고, 브라우저에서 사격할 때 콘솔 에러가 없으며, 2인 총구가 각자 십자선을 겨눈다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `pending` | 처리부 타이머 바인딩(`Illegal invocation`) 수정과 재발 방지 테스트 | [T01](./T01-timer-binding.md) |
| T02 | `pending` | 조준 좌표 순수 모듈 분리 + 총구가 십자선 지점을 겨누는 계산(`gunAim.ts`) | [T02](./T02-gun-aim.md) |
| T03 | `pending` | 조준 경로 하나로: 캔버스의 마우스 직접 쓰기·옛 조준 ref·`updateAimDirect` 제거 | [T03](./T03-single-aim-path.md) |
| T04 | `pending` | 로비 모달이 1440×900·1024×768 안에 들어오게 | [T04](./T04-lobby-fit.md) |
| T05 | `pending` | 불안정 테스트 찾기와 원인 제거 | [T05](./T05-flaky-test.md) |

## Progress
- done: 0/5 (active: T01)
