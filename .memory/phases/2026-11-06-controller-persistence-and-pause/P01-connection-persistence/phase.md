# Phase: P01 연결 유지

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | PC가 방 코드를 localStorage에 저장·재사용, 서버는 기존 방을 덮어쓰지 않음, '새 QR 발급' 버튼 | [T01](./T01-pc-room-code-memory.md) |
| T02 | `done` | 폰이 방 코드를 기억하고 끊기면 지수 백오프로 자동 재연결, 재연결 배너 | [T02](./T02-controller-auto-reconnect.md) |
| T03 | `pending` | 폰 재연결 뒤 PC 화면(PAIRING)이 ZEROING으로 넘어가도록 `resume` 플래그 중계 | [T03](./T03-resume-sync.md) |

## Progress
- done: 2/3 (active: T03)
