# Task: T02 Lobby Debug Panel

## Status: done

## Goal
디버그 모드 로비에서 `RankingTabs` 자리에 디버그 패널이 뜨고, [시작 조건] 탭에서 시작 지점·무기 레벨·카드 스택을 바꾸며, [최근 기록] 탭에서 최근 디버그 판 10개를 본다. 로비 상단에 `DEBUG MODE · 랭킹 미등록` 배지가 붙는다.

## Decision Summary
- D06: 기존 `QRPairingModal`을 그대로 쓰고 랭킹 칸만 교체(QR·슬롯·2P 흐름 불변). 높이는 RankingTabs 고정값(본문 290px / 확장 350px, 커밋 e54738d)을 따른다.
- D07: [최근 기록]은 T02(P01)의 `DEBUG_RECORDS_REQUEST`로 받는다.

## Implementation

### I01. `DebugLobbyPanel` 컴포넌트

- Related Files:
  - `src/pc/components/DebugLobbyPanel.tsx` :: `DebugLobbyPanel`, `DebugLobbyPanelProps`, `formatDebugRunReach`; new

#### Details
- ```typescript
  export type DebugPanelTab = 'config' | 'records';
  export interface DebugLobbyPanelProps {
    config: DebugStartConfig;
    onChangeConfig: (cfg: DebugStartConfig) => void;
    runs: DebugRunEntry[] | null;   // null = 불러오는 중
    onRequestRuns: () => void;      // [최근 기록] 탭을 열 때 호출
    initialTab?: DebugPanelTab;
  }
  export function formatDebugRunReach(waveReached: number): string; // ≤7 → `W${n}`, ≥8 → `DANGER ${n-7}`
  ```
- [시작 조건] 탭:
  - 시작 지점 버튼 3개(W1/W6/EX). 누르면 `onChangeConfig(presetForStart(x))`(프리셋으로 덮어씀).
  - 무기 Lv 1~4 버튼, 카드 6종 각각 `−`/`+`(0..상한, 상한은 `GAME_TUNING.cards`). 라벨: 피해↑, 쿨감, 피버연장, 판정확대, 빠른장전, 행운.
  - `startAt === 'EX'`이면 레벨·카드 컨트롤을 disabled로 두고 "EX는 MAX 고정" 안내 표시(엔진이 MAX 강제).
- [최근 기록] 탭: 탭 진입 시 `onRequestRuns()`. 행마다 `1P/2P · 무기 · 시작(W1/W6/EX) · 점수 · 도달(formatDebugRunReach) · 피격 n`. 행 클릭 시 펼쳐서 웨이브·DANGER별 피격 목록(`waves`). `runs === null` → "불러오는 중…", 빈 배열 → "디버그 기록 없음".
- 본문 높이는 `RankingTabs`의 고정 높이 상수/스타일을 그대로 쓰고 넘치면 내부 스크롤(`overflowY: auto`). RankingTabs에서 높이 값을 export하지 않는다면 같은 값(290px)을 쓰고 주석으로 출처를 남긴다(구현 시 `RankingTabs.tsx`의 실제 값·compact 분기 확인).
- 마우스로 조작한다. 로비 크로스헤어 사격으로 버튼을 누르는 기존 방식(`pressScreenButton`)과 충돌하지 않게 일반 `onClick` 버튼만 쓴다.

### I02. `QRPairingModal` 교체 지점

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps.debugPanel`, 랭킹 칸(537행), 상단 배지; modify

#### Details
- `debugPanel?: React.ReactNode` prop 추가. 있으면 `<RankingTabs .../>` 대신 렌더하고, 모달 상단(제목 영역)에 `DEBUG MODE · 랭킹 미등록` 배지(T01 HUD 배지와 같은 색).
- 없으면 기존 렌더 그대로(회귀 없음).

### I03. PCGamePage 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `debugRuns` state, WS 메시지 처리(`case 'DEBUG_RECORDS'`, 769행 switch), `requestDebugRuns`, `<QRPairingModal debugPanel=...>`(1927행); modify

#### Details
- `const [debugRuns, setDebugRuns] = useState<DebugRunEntry[] | null>(null);`
- `requestDebugRuns = useCallback(() => { setDebugRuns(null); ws OPEN이면 send({ type:'DEBUG_RECORDS_REQUEST', roomId: roomIdRef.current }) }, [])`.
- WS switch: `case 'DEBUG_RECORDS': if (msg.roomId === roomIdRef.current) setDebugRuns(msg.runs); break;`
- 결과 화면에서 로비로 돌아올 때(PAIRING 진입) 디버그 모드면 `requestDebugRuns()` 한 번 호출(방금 판 반영).
- `debugPanel={isDebugMode ? <DebugLobbyPanel config={debugConfig} onChangeConfig={updateDebugConfig} runs={debugRuns} onRequestRuns={requestDebugRuns} /> : undefined}`

### I04. 테스트

- Related Files:
  - `tests/debug-lobby-panel.test.tsx` — new

#### Details
- `tests/ranking-tabs.test.tsx`·`tests/lobby-slot-cards.test.tsx`의 렌더 방식을 따른다.
- W6 버튼 클릭 → `onChangeConfig`가 W6 프리셋으로 호출. `+` 상한에서 더 안 오름, `−` 0에서 더 안 내림. EX면 레벨·카드 disabled.
- [최근 기록] 탭 클릭 → `onRequestRuns` 1회. runs null/빈/데이터 각각 문구. `formatDebugRunReach(7) === 'W7'`, `(10) === 'DANGER 3'`.
- `QRPairingModal`에 `debugPanel` 주면 랭킹 탭 텍스트가 없고 배지가 있음, 안 주면 기존과 같음.

## Acceptance Criteria
- [x] `?debug=1` 로비에서 랭킹 칸이 디버그 패널로 바뀌고 QR·슬롯·시작 버튼은 그대로다.
- [x] 패널에서 바꾼 설정이 다음 판에 적용되고 새로고침 후에도 유지된다.
- [x] [최근 기록]에 방금 끝낸 디버그 판이 보인다.

## Validation
- `npx vitest run tests/debug-lobby-panel.test.tsx tests/pc-modals-and-pairing.test.ts tests/ranking-tabs.test.tsx tests/lobby-slot-cards.test.tsx` — 통과
- `npx tsc --noEmit` — 에러 0

## Commit Message
```text
feat(lobby): add debug panel with start config and recent debug runs

Plan: 2026-11-17-debug-mode
Phase: P03-pc-debug-ui
Task: T02-lobby-debug-panel

- I01: add DebugLobbyPanel with start config controls and recent runs tab
- I02: let QRPairingModal swap RankingTabs for a debug panel and show badge
- I03: request and receive DEBUG_RECORDS in PCGamePage
- I04: test panel controls, records states and modal swap
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
