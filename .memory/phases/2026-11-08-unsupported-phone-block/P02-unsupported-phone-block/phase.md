# Phase: P02 미지원 폰 차단

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 센서 판별 코어(`SensorSupportProbe.ts`): 순수 판정 함수 + 실측 함수 + 상수 + 단위 테스트 | [T01](./T01-sensor-probe-core.md) |
| T02 | `done ✅` | 프로토콜 `DEVICE_UNSUPPORTED`/`CONTROLLER_UNSUPPORTED`와 서버 핸들러(슬롯 비우기) + 서버 테스트 | [T02](./T02-server-unsupported-message.md) |
| T03 | `done ✅` | PC: 메시지 수신 시 로비 슬롯 비우기 + 안내 칩 표시 + 테스트 | [T03](./T03-pc-unsupported-notice.md) |
| T04 | `done ✅` | 폰: 권한 허용 뒤 판별 → 차단 화면 + 서버 통지 + 개발 모드 우회 + README | [T04](./T04-phone-block-screen.md) |

## Progress
- done: 4/4 (완료)
