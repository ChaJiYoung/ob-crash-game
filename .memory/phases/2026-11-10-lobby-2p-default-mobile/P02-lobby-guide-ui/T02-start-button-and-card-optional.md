# Task: T02 시작 버튼 상태 문구 + 2P 카드 "(선택)"

## Status: pending

## Goal
시작 버튼이 로비에 항상 보이고, 시작할 수 없을 땐 비활성화되며(쏘기·클릭 모두 시작 불가), 전체 상태는 버튼 글자의 괄호 문구로 알린다. 1P가 준비됐고 2P 폰이 미연결이면 2P 카드 오른쪽 상태 글자가 "● 스마트폰 연결 대기 (선택)"(회색)이 된다.

## Decision Summary
- D05: 버튼 문구 표(아래 I01). 비활성일 때는 별도 "⏳ …" 박스를 버튼으로 대체한다.
- D06(b,c): 카드 상태 글자는 `isOptionalSlot`(T01에서 만든 함수) 재사용. 새 슬롯 상태는 만들지 않는다.
- D03: 영점 중 2P는 기다린다 — 제외 수단·타임아웃 없음. 📱 재클릭 토글(입력 해제)은 건드리지 않는다.
- **함정**: 시작 버튼은 `data-shootable="start"`로 화면 히트테스트(`PCGamePage.tsx:355~359`)의 대상이다. 비활성 버튼에 이 속성이 남으면 폰으로 쏴서 시작이 막히지 않는다 → 비활성일 때는 `data-shootable`을 **절대 렌더하지 않는다**.

## Implementation

### I01. `getStartButtonView` (문구 계산, 순수 함수)

- Related Files:
  - `src/pc/lobbyGuide.ts` :: `StartButtonView`, `getStartButtonView` — modify(추가)
  - `src/pc/coopSlots.ts` :: `getJoinedSlots`, `StartGate` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface StartButtonView {
    enabled: boolean;
    icon: '▶' | '⏳';
    /** 괄호 포함 전체 문구. 예: "게임 시작 (2P 준비 중…)" */
    label: string;
  }
  export function getStartButtonView(slots: SlotPair, gate: StartGate): StartButtonView;
  ```
- **Execution Flow / Logic**:
  1. `!gate.canStart`:
     - `gate.playerCount === 0` → `{ enabled:false, icon:'⏳', label:'게임 시작 (플레이어를 연결하세요)' }`
     - 그 외 → `label: `게임 시작 (${gate.message}…)`` (`gate.message`는 "2P 준비 중" 또는 "1P·2P 준비 중")
  2. `gate.canStart`:
     - `pending = slots.find(s => s.input === 'mobile' && !s.player)` (QR 대기 중인 슬롯). `gate.playerCount === 1 && pending` → `label: `게임 시작 (${pending.slot}P 없이 1인 시작)``
     - 그 외, 참여자(`getJoinedSlots`) 중 `input === 'mobile'`이 있으면 `'게임 시작 (화면 가운데를 쏘세요)'`, 없으면(마우스만) `'게임 시작 (클릭으로 시작)'`
     - 모두 `enabled:true, icon:'▶'`
  3. `PCGamePage.tryStartFromLobby`·`decideLobbyStart`는 건드리지 않는다(게이트가 이미 같은 기준).

### I02. 모달: 시작 버튼 항상 표시 + 카드 상태 글자

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: 시작 버튼 분기(약 560~640행: `startNotice ? chip : canStart ? button : waiting box`), `SlotCard`(`statusText` 계산 약 81~106행), `SlotCardProps` — modify

#### Details
- 시작 영역: `startNotice ? (기존 칩 유지) : <StartButton/>` 구조로 바꾼다. 버튼은 항상 하나만:
  - `const view = getStartButtonView(slots, startGate);`
  - 공통 `data-testid="lobby-start-button"`, `data-enabled={view.enabled}`, 내부 `<span>{view.icon}</span><span>{view.label}</span>`.
  - `view.enabled`: 기존 주황 버튼 스타일 + `data-shootable="start"` + `onClick={onStart}` (문구만 `view.label`로).
  - `!view.enabled`: `disabled` 속성, `data-shootable` **없음**, `onClick` 없음, 스타일은 기존 대기 박스(회색 `rgba(30,41,59,0.5)` 배경, `#94a3b8` 글자, `cursor: 'not-allowed'`)를 버튼 형태로.
  - 기존 `startGate.canStart ? … : <div>⏳ {startGate.message || …}</div>` 분기와 "게임 시작 (폰은 화면 가운데를 쏘세요)" 고정 문구는 삭제한다.
- `SlotCardProps`에 `optional: boolean` 추가. `QRPairingModal`에서 `optional={isOptionalSlot(slots, 1)}` / `optional={isOptionalSlot(slots, 2)}`로 전달.
- `statusText` 계산에서 `input === 'mobile'`의 `else if (!player)` 분기만 바꾼다: `optional`이면 `statusText = '● 스마트폰 연결 대기 (선택)'`, `statusColor = '#64748b'`; 아니면 기존 `'● 스마트폰 연결 대기 중…'`/`#f59e0b`. `!isConnected`(연결 끊김)가 `!player`보다 먼저 검사되는 기존 순서는 유지.
- import에 `getStartButtonView`, `isOptionalSlot`(from `../lobbyGuide`) 추가.

### I03. 테스트 갱신

- Related Files:
  - `tests/lobby-slot-cards.test.tsx` :: 1~4번째 `it` — modify
  - `tests/lobby-start-button.test.ts` — new(순수 함수 `getStartButtonView` 전용)

#### Details
- `lobby-start-button.test.ts` (표 전체):
  - 슬롯 비어 있음/폰만 선택(미연결) → `enabled:false`, `'게임 시작 (플레이어를 연결하세요)'`, icon ⏳
  - 1P 마우스 준비 + 2P 영점 전 → `'게임 시작 (2P 준비 중…)'`
  - 둘 다 참여·미준비 → `'게임 시작 (1P·2P 준비 중…)'`
  - 1P 마우스 준비 + 2P 폰 미연결 → `enabled:true`, `'게임 시작 (2P 없이 1인 시작)'`
  - 1P 폰 준비 + 2P 폰 미연결 → 같은 문구
  - 1P 마우스만(2P null) → `'게임 시작 (클릭으로 시작)'`
  - 1P 폰 준비만(2P null) → `'게임 시작 (화면 가운데를 쏘세요)'`
  - 2P만 폰 준비 + 1P 폰 미연결 → `'게임 시작 (1P 없이 1인 시작)'`
- `lobby-slot-cards.test.tsx`:
  - 첫 `it`(둘 다 비어 있음): `not.toContain('게임 시작')`/`'▶'` 단언을 `toContain('data-testid="lobby-start-button"')`, `toContain('(플레이어를 연결하세요)')`, `toContain('disabled')`, `not.toContain('data-shootable="start"')`로 교체(`비어 있음` ×2 유지).
  - 둘째 `it`(1P 마우스 준비 + 2P 모바일 미연결): `'● 스마트폰 연결 대기 중…'` → `'● 스마트폰 연결 대기 (선택)'`로 교체, `data-shootable="start"`와 `'2P 없이 1인 시작'` 포함 단언 추가.
  - 셋째 `it`(2P 영점 전): 기존 `'2P 준비 중'`·`not data-shootable` 유지 + `data-enabled="false"` 추가.
  - 넷째 `it`(1P만 준비): `data-shootable="start"`·`'게임 시작'` 유지 + `'(클릭으로 시작)'`.
  - 신규: 1P 마우스 준비 + 2P 기본 모바일 미연결 상태에서 2P 카드가 '(선택)', **1P 폰 미연결 + 2P 기본 모바일**에서는 둘 다 '(선택)' 없이 `'● 스마트폰 연결 대기 중…'`이 2번 나온다.

## Acceptance Criteria
- [ ] 시작 불가 상태에서 버튼이 `disabled`이고 `data-shootable="start"`가 DOM에 없다
- [ ] 1P 준비 + 2P 미연결: 버튼이 활성이고 "(2P 없이 1인 시작)", 2P 카드 "● 스마트폰 연결 대기 (선택)"(회색)
- [ ] 2P 영점 중: 버튼 "(2P 준비 중…)"으로 비활성
- [ ] 기존 별도 "⏳" 박스가 사라지고 `startNotice` 칩 동작은 그대로
- [ ] 전체 테스트(`npm test`) 통과, `tsc` 통과

## Validation
- `npx vitest run tests/lobby-start-button.test.ts tests/lobby-slot-cards.test.tsx tests/lobby-next-step.test.ts tests/coop-start-flow.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(lobby): 시작 버튼에 전체 상태 문구를 담고 2P 카드에 (선택) 표시

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P02-lobby-guide-ui
Task: T02-start-button-and-card-optional

- getStartButtonView 추가(활성/비활성·괄호 문구)
- 시작 버튼 항상 표시, 비활성 시 data-shootable 제거
- 2P 카드 상태 글자 "● 스마트폰 연결 대기 (선택)"(회색)
- lobby-slot-cards 테스트 갱신, lobby-start-button 테스트 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
