# Phase: P01 센서 복구 코드 수정

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | `PhoneAdapter.autoZeroFromLatest`가 원시 센서값으로 영점을 잡도록 수정 (①) | [T01](./T01-auto-zero-raw.md) |
| T02 | `done ✅` | 센서 이벤트 정지 판정 헬퍼 `SensorLiveness` 추가 (③ 기반) | [T02](./T02-sensor-liveness.md) |
| T03 | `done ✅` | 폰 컨트롤러: 화면 복귀·워치독으로 센서 리스너 재등록, 정리 로직 보강 | [T03](./T03-controller-revive.md) |
| T04 | `done ✅` | `GunGripTracker` 조준 잠금 자동 만료 추가 (D08) | [T04](./T04-aim-lock-expiry.md) |
| T05 | `done ✅` | `__setStep` 전역 노출 제거 (D09) | [T05](./T05-remove-set-step.md) |

## Progress
- done: 5/5 (완료)
