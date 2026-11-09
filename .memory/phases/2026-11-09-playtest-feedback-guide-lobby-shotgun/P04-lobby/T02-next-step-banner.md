# Task: T02 로비 "지금 할 일" 배너와 단계 표시

## Status: pending

## Goal
로비 위쪽에 ①~③ 단계 줄과 "지금 할 일" 한 문장을 크게 보여서, 처음 온 사람이 무엇을 해야 하는지 바로 알게 한다. 문장과 강조 단계는 슬롯 상태에서 **순수 함수로 계산**한다(D10).

## Decision Summary
- 새 서버 데이터·새 상태 없음. 입력은 기존 `SlotPair`(`src/pc/coopSlots.ts`)와 `StartGate`뿐이다.
- 폰이 한 대라도 선택·연결돼 있으면 3단계(① QR 스캔 ② 영점 조정 ③ 쏴서 시작), 마우스만이면 2단계(① 닉네임 입력 ② 클릭으로 시작). 슬롯이 둘 다 비어 있으면 안내만 있고 단계 줄은 "입력 방식 선택"으로 시작한다.
- 2인이면 **아직 준비되지 않은 쪽(`StartGate.waitingSlots[0]`)** 기준으로 문장을 정하고 "2P: …"처럼 슬롯 번호를 붙인다. 1P만 연결돼 있으면 번호를 붙이지 않는다.
- 시작 방식 문구는 지금 로비 시작 버튼 문구와 같아야 한다: 폰은 "화면 가운데를 쏘세요"(`isShootToStartHit`), 마우스는 "▶ 게임 시작 버튼을 누르세요".

## Implementation

### I01. 순수 함수 `getLobbyNextAction`
- Related Files:
  - `src/pc/lobbyGuide.ts` :: `getLobbyNextAction`, `LobbyNextAction`, `LobbyStepState` — new
  - `src/pc/coopSlots.ts` :: `SlotState`, `isSlotJoined`, `isSlotReady`, `getStartGate`, `StartGate` — read-only
#### Details
- **Signatures & Types**:
  ```ts
  export type LobbyStepId = 'choose' | 'connect' | 'zero' | 'start';
  export type LobbyStepState = 'done' | 'active' | 'todo';
  export interface LobbyStep { id: LobbyStepId; label: string; state: LobbyStepState }
  export interface LobbyNextAction {
    /** 단계 줄(좌→우). 폰이 있으면 [QR 스캔, 영점 조정, 쏴서 시작], 마우스만이면 [닉네임 입력, 클릭으로 시작]. 아무도 고르지 않았으면 [입력 방식 선택]만. */
    steps: LobbyStep[];
    /** 큰 글씨 한 문장. */
    headline: string;
    /** 작은 보조 문장(선택). */
    detail?: string;
    /** 시작 가능한가(= StartGate.canStart). */
    ready: boolean;
  }
  export function getLobbyNextAction(slots: SlotPair, gate: StartGate): LobbyNextAction
  ```
- **Execution Flow / Logic** (`slotsWithInput = slots.filter(s => s.input !== null)`):
  1. `slotsWithInput.length === 0`: `steps = [{ id:'choose', label:'입력 방식 선택', state:'active' }]`, `headline = '1P 입력 방식을 선택하세요'`, `detail = '📱 모바일은 QR 스캔, 🖱 마우스는 바로 사용'`, `ready = false`.
  2. 플레이어 라벨: 입력이 있는 슬롯이 둘이면 `label(slot) = `${slot}P: ``, 하나면 빈 문자열.
  3. 단계 목록: 입력이 있는 슬롯 중 `'mobile'`이 하나라도 있으면 **폰 단계**(`connect`='QR 스캔', `zero`='영점 조정', `start`='쏴서 시작'), 없으면 **마우스 단계**(`connect`='닉네임 입력', `start`='클릭으로 시작').
  4. 활성 단계와 문장은 **가장 앞선 미완료 슬롯**으로 정한다. 대상 슬롯 = `gate.waitingSlots[0]`이 있으면 그 슬롯, 없고 `!isSlotJoined`인 입력 선택 슬롯(예: 폰 선택 후 아직 접속 전)이 있으면 그 슬롯(번호 작은 순). 대상이 없으면(전원 준비 완료) `start` 활성.
     - 대상이 `input === 'mobile'`이고 `player` 없음 → `connect` 활성, headline `${label}폰으로 QR을 스캔하세요`, detail `카메라로 QR을 비추면 컨트롤러가 열립니다`.
     - `mobile`이고 `player` 있고 `!isZeroCalibrated` → `zero` 활성, headline `${label}폰을 화면 쪽으로 들고 영점을 맞추세요`, detail `폰 화면의 안내에 따라 모니터 가운데를 겨누세요`.
     - `mobile`이고 영점 완료이지만 `!isConnected` → `zero` 활성(연결 복구 대기), headline `${label}폰 연결이 끊겼어요. 다시 연결해 주세요`.
     - `mouse`이고 `player` 없음 → `connect` 활성, headline `${label}닉네임을 입력하세요`, detail `2~10자, 입력하면 바로 준비 완료`.
     - 전원 준비 완료(`gate.canStart`) → `start` 활성. 폰이 하나라도 있으면 headline `준비 완료! 화면 가운데를 쏘면 시작합니다`, detail `마우스 슬롯은 ▶ 게임 시작 버튼으로도 시작합니다`(마우스가 있을 때만 detail). 마우스만이면 headline `준비 완료! ▶ 게임 시작 버튼을 누르세요`.
  5. `steps[i].state`: 활성 단계보다 앞은 `'done'`, 활성은 `'active'`, 뒤는 `'todo'`. `ready = gate.canStart`.
  6. 2인: 대상 슬롯이 정해진 뒤에도 다른 슬롯이 **이미 준비 완료**면 단계 줄은 대상 슬롯 기준이다(2P가 늦어도 1P는 끝났으므로 단계가 되돌아가 보이지 않게 `done` 계산은 대상 기준으로만).
- **함정**: `getStartGate`의 `waitingSlots`는 `isSlotJoined`(입력 + 프로필 있음)인 슬롯만 본다. 폰을 선택했지만 아직 프로필이 없는 슬롯(QR 스캔 대기)은 `waitingSlots`에 **없다**. 그래서 단계 4에서 "player 없음" 슬롯을 `waitingSlots`와 **별도로** 먼저 찾아야 한다(그렇지 않으면 QR 스캔 전 상태가 "준비 완료"로 오판된다).

### I02. 배너 컴포넌트와 로비 연결
- Related Files:
  - `src/pc/components/LobbyNextStepBanner.tsx` :: `LobbyNextStepBanner` — new
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModal`(제목 아래 `플레이어마다 입력 방식을 선택하세요…` 문구, 482행 부근 / 슬롯 카드 위 487행) — modify
#### Details
- **Signatures & Types**:
  ```ts
  export interface LobbyNextStepBannerProps { action: LobbyNextAction }
  export const LobbyNextStepBanner: React.FC<LobbyNextStepBannerProps>
  ```
- **Execution Flow / Logic**: 컴포넌트는 `data-testid="lobby-next-step"` 컨테이너, 각 단계 `data-testid="lobby-step-<id>"`와 `data-state`(done|active|todo) 속성, 큰 headline(`data-testid="lobby-next-headline"`)과 detail을 렌더한다. 스타일은 `QRPairingModal`의 어두운 카드 톤(배경 `rgba(15,23,42,0.65)`, 활성 단계는 앰버 `#f59e0b` 테두리·굵은 글씨, 완료는 `✓` + 초록 `#4ade80`, 대기는 회색 `#64748b`)을 따른다. `QRPairingModal`에서 `const nextAction = getLobbyNextAction(slots, startGate);`로 계산해 슬롯 카드 `div`(487행 `{/* 1P / 2P Slot Cards */}`) **바로 위**에 `<LobbyNextStepBanner action={nextAction} />`를 넣는다. 기존 제목 아래 설명 문구("플레이어마다 입력 방식을 선택하세요…")는 유지한다(2인팟 안내라 사라지면 안 된다).
- **함정**: `QRPairingModal`은 이미 높이가 큰 카드(`maxHeight: calc(100vh - 32px); overflowY: auto`)다. 배너가 한 줄 높이(약 72~96px)를 넘지 않게 해 작은 노트북 화면에서 시작 버튼이 스크롤 밖으로 밀리지 않게 한다.

### I03. 테스트
- Related Files:
  - `tests/lobby-next-step.test.ts` — new(순수 함수)
  - `tests/lobby-slot-cards.test.tsx` — modify(배너 렌더 한두 케이스)
#### Details
- `getLobbyNextAction` 케이스(슬롯은 `createInitialSlots`·`chooseSlotInput`·`updateSlot`으로 조립하고 `getStartGate`로 게이트 계산): ① 둘 다 비어 있음 → `['choose']`, headline `1P 입력 방식을 선택하세요`; ② 1P 모바일, 프로필 없음 → active `connect`, headline `폰으로 QR을 스캔하세요`(번호 접두어 없음); ③ 1P 모바일 + 프로필, 영점 전 → active `zero`, `connect` done; ④ 1P 모바일 영점 완료 → `ready true`, active `start`, headline에 `화면 가운데를 쏘면 시작`; ⑤ 1P 마우스, 프로필 없음 → steps 2개, active `connect`, headline `닉네임을 입력하세요`; ⑥ 1P 마우스 준비 완료 → headline에 `▶ 게임 시작`; ⑦ 1P 폰 준비 완료 + 2P 폰 QR 대기 → headline이 `2P: 폰으로 QR을 스캔하세요`(번호 접두어 있음), `ready false`; ⑧ 1P 마우스 준비 완료 + 2P 폰 영점 전 → 폰 단계 3개, active `zero`, headline `2P: …영점`; ⑨ 폰 연결 끊김(`isConnected false`) → `연결이 끊겼어요`.
- `QRPairingModal` 렌더: 1P 모바일 로비 슬롯으로 렌더하면 HTML에 `lobby-next-step`, `lobby-step-connect`(`data-state="active"`), `폰으로 QR을 스캔하세요`가 있고, 기존 `lobby controls hint`·`tutorial and guide buttons` 테스트는 그대로 통과한다.

## Acceptance Criteria
- [ ] 로비 위쪽에 단계 줄(폰 3단계/마우스 2단계)과 지금 할 일 한 문장이 보이고, 슬롯 상태가 바뀌면 활성 단계와 문장이 바뀐다.
- [ ] QR 스캔 전·영점 전·준비 완료·연결 끊김·2인 한쪽 대기 상태가 각각 올바른 문장으로 나온다(QR 스캔 전이 "준비 완료"로 오판되지 않는다).
- [ ] 기존 로비 요소(슬롯 카드, 튜토리얼·가이드 버튼, 조작법 두 줄, 랭킹)가 그대로 동작한다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/lobby-next-step.test.ts tests/lobby-slot-cards.test.tsx tests/pc-modals-and-pairing.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- (수동) `npm run dev` → 로비에서 QR 스캔 전/후, 영점 후, 마우스 선택, 2P 추가 상태를 차례로 바꿔 보며 문장이 맞게 바뀌는지 확인

## Commit Message
```text
feat(lobby): "지금 할 일" 배너와 단계 표시

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P04-lobby
Task: T02-next-step-banner

- I01 getLobbyNextAction 순수 함수(슬롯 상태·StartGate에서 계산)
- I02 LobbyNextStepBanner와 QRPairingModal 연결
- I03 단계별·2인 상태 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
