# Task: T01 로비 1P 입력 방식 기억·기본값

## Status: pending

## Goal
로비가 열릴 때 1P 슬롯이 **마지막에 쓴 입력 방식**(기록이 없으면 모바일)으로 미리 선택되어 QR이 바로 보이게 한다. 2P는 항상 비어 있다. 판이 끝나 "로비로" 돌아올 때도 같은 기본값이 다시 적용된다(D09).

## Decision Summary
- 저장은 `localStorage`(읽기·쓰기 모두 `try/catch`), 키 `beer_crusher_lobby_input_1p`, 값 `'mobile' | 'mouse'`. `deviceIdentity.ts`처럼 테스트용 `storage` 주입 인자를 받는다. 잘못된 값·접근 실패는 `'mobile'`.
- **1P가 명시적으로 고른 입력만 저장**한다(`input !== null`). 같은 버튼을 다시 눌러 비우는 것(`null`)은 저장하지 않는다. 비운 뒤 로비로 돌아오면 다시 기본값이 적용된다.
- 마우스를 기억해 둔 경우는 버튼을 직접 누른 것과 **같은 경로**를 탄다: 서버 `LOOKUP_LOCAL_PLAYER` 조회 → 등록된 기기는 닉네임 없이 바로 준비 완료, 처음 보는 기기는 닉네임 폼(결정 문서 D09 정정 참고).
- `createInitialSlots()`는 그대로 두고(두 슬롯 `input: null`) 기존 테스트와 센서랩·테스트가 쓰는 빈 슬롯 동작을 보존한다. 로비용 새 함수 `createLobbySlots`를 추가한다.

## Implementation

### I01. 저장 도우미와 로비용 슬롯 생성
- Related Files:
  - `src/pc/lobbyInputMemory.ts` :: `LOBBY_INPUT_STORAGE_KEY`, `loadLastInput`, `saveLastInput` — new
  - `src/pc/coopSlots.ts` :: `createLobbySlots` — modify (`createInitialSlots` 22행 아래)
  - `src/shared/deviceIdentity.ts` :: `getOrCreateDeviceId` — read-only (저장소 접근 패턴 참고)
#### Details
- **Signatures & Types**:
  ```ts
  // lobbyInputMemory.ts
  import type { SlotInput } from './coopSlots';
  export const LOBBY_INPUT_STORAGE_KEY = 'beer_crusher_lobby_input_1p';
  /** 1P가 마지막에 고른 입력. 없거나 이상하면 'mobile'. 저장소 접근이 막혀도 예외를 던지지 않는다. */
  export function loadLastInput(storage?: Pick<Storage, 'getItem'>): SlotInput
  /** 저장 실패(사생활 보호 모드 등)는 무시한다. */
  export function saveLastInput(input: SlotInput, storage?: Pick<Storage, 'setItem'>): void

  // coopSlots.ts
  /** 로비가 열릴 때의 슬롯: 1P는 firstInput으로 미리 선택, 2P는 비어 있다. */
  export function createLobbySlots(firstInput: SlotInput): SlotPair
  ```
- **Execution Flow / Logic**:
  1. `loadLastInput(storage?)`: `storage`가 없으면 `typeof window !== 'undefined' && window.localStorage`. `getItem(KEY)`를 `try/catch`로 감싸 `'mobile' | 'mouse'`면 그대로, 아니면 `'mobile'`.
  2. `saveLastInput(input, storage?)`: 같은 방식으로 `setItem(KEY, input)`을 `try/catch`(실패 무시).
  3. `createLobbySlots(firstInput)` = `chooseSlotInput(createInitialSlots(), 1, firstInput).slots`. 2P는 `input: null` 그대로. (`chooseSlotInput`은 다른 슬롯이 마우스이면 거절하지만 처음에는 둘 다 비어 있어 항상 성공한다.)
- 순환 import 주의: `lobbyInputMemory.ts`가 `coopSlots.ts`의 **타입만** import(`import type`)하므로 순환이 생기지 않는다.

### I02. PCGamePage 연결(초기값·저장·재시도·복귀)
- Related Files:
  - `src/pc/PCGamePage.tsx` :: 101행 `useState<SlotPair>(createInitialSlots)`, `handleChooseInput`(1344행), `ROOM_CREATED` 처리(523~535행), `handleReturnToLobby`(1371행), `sendLookupLocalPlayer`(1337행) — modify
#### Details
- **Execution Flow / Logic**:
  1. 초기값: `useState<SlotPair>(() => createLobbySlots(loadLastInput()))`. import에 `createLobbySlots`와 `loadLastInput`, `saveLastInput`을 추가한다(`createInitialSlots` import는 다른 곳에서 쓰지 않으면 제거).
  2. 저장: `handleChooseInput(slot, input)`에서 `res.rejected`가 없고 `slot === 1 && input !== null`이면 `saveLastInput(input)`.
  3. 기억한 마우스의 서버 조회: 처음 로드 때 1P가 `'mouse'`로 시작하면 `handleChooseInput`을 거치지 않으므로 조회가 안 나간다. `ROOM_CREATED` 처리(서버 재시작 복구용 루프)의 조건을 `seat.input === 'mouse' && seat.player && ws.readyState === OPEN`에서 `seat.input === 'mouse' && ws.readyState === OPEN`로 바꿔 **player가 아직 없는 마우스 슬롯도** 조회하게 한다(보내는 내용은 같다: `LOOKUP_LOCAL_PLAYER`, `roomId: msg.roomId`, `deviceId: getOrCreateDeviceId()`, `slot: seat.slot`). 응답 `LOCAL_PLAYER_REGISTERED`는 슬롯 입력이 마우스가 아니면 무시하는 기존 방어가 있다(583행).
  4. 로비 복귀: `handleReturnToLobby`의 `setSlots(prev => ...)`에서 기존 코드가 마우스 슬롯을 `chooseSlotInput(next, n, null)`로 비운다. 그 뒤에 `if (next[0].input === null) next = chooseSlotInput(next, 1, loadLastInput()).slots;`를 추가한다. 2P는 건드리지 않는다. 복귀 후 1P가 마우스로 다시 선택되면 서버 조회가 필요하므로 `setSlots` 바깥에서 `if (loadLastInput() === 'mouse') sendLookupLocalPlayer(1)`을 호출한다(`handleReturnToLobby`의 `useCallback` 의존성 배열에 `sendLookupLocalPlayer` 추가). 모바일이 기억돼 있고 1P 폰이 이미 연결돼 있던 경우(`next[0].input === 'mobile'`)는 기존대로 유지된다.
  5. 이 외의 `setPhase('PAIRING')` 경로(튜토리얼 종료 `handleExitTutorial`, 센서랩 `onExitToLobby`)는 슬롯을 건드리지 않으므로 바뀌지 않는다.
- **함정**: ① `handleReturnToLobby`는 `slotsRef.current`가 아니라 `setSlots` 함수형 업데이트로 슬롯을 바꾼다. `loadLastInput()`은 업데이트 함수 **안에서** 호출해도 되지만(순수 읽기), 서버 조회 전송은 업데이트 함수 안에서 하면 안 된다(React가 업데이트 함수를 두 번 호출할 수 있다 — StrictMode). ② `pc-page-smoke.test.tsx`는 첫 렌더에 "입력 방식을 선택하세요"가 있는지 본다. 2P 슬롯이 계속 비어 있어 이 문구는 남으므로 통과해야 한다. 1P가 `'mobile'`이면 QR 영역이 보인다.

### I03. 테스트
- Related Files:
  - `tests/lobby-default-input.test.ts` — new
  - `tests/lobby-slot-cards.test.tsx`, `tests/pc-page-smoke.test.tsx` — 전체 실행 후 필요 시 modify
#### Details
- 케이스: ① 저장소에 값이 없으면 `loadLastInput()`이 `'mobile'`; 값 `'mouse'`면 `'mouse'`; `'foo'`·빈 문자열이면 `'mobile'`; ② `getItem`이 예외를 던지는 가짜 저장소 → `'mobile'`; `setItem`이 던져도 `saveLastInput`이 예외를 안 던짐; ③ 저장 후 읽기 왕복(`Map` 기반 가짜 저장소); ④ `createLobbySlots('mobile')` → `[0].input === 'mobile'`, `[1].input === null`, 두 슬롯 `isZeroCalibrated false`; `createLobbySlots('mouse')` → 1P 마우스, 2P 비어 있고 `chooseSlotInput(slots, 2, 'mouse')`는 `rejected: 'MOUSE_TAKEN'`; ⑤ `createInitialSlots()`는 여전히 둘 다 `null`(기존 계약 유지); ⑥ 1P가 `'mobile'`인 로비 슬롯을 `QRPairingModal`로 렌더하면 `Slot 1 QR Code` 이미지 또는 "QR 생성 중"이 보이고 "비어 있음"은 1개뿐(2P).

## Acceptance Criteria
- [ ] 처음 접속하면 1P가 📱 모바일로 선택되어 QR이 바로 보이고 2P는 비어 있다.
- [ ] 1P가 마우스를 고르면 다음 로비(새로고침·"로비로" 복귀)에서 1P가 마우스로 시작하고, 등록된 기기는 닉네임 없이 바로 준비 완료다.
- [ ] 같은 버튼을 눌러 1P를 비우면 저장되지 않고, 다음 로비에서 다시 기본값(마지막 저장값 또는 모바일)이 선택된다.
- [ ] 저장소 접근이 막힌 환경에서도 로비가 모바일 기본값으로 정상 동작한다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/lobby-default-input.test.ts tests/lobby-slot-cards.test.tsx tests/pc-page-smoke.test.tsx tests/coop-slots.test.ts tests/coop-start-flow.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(lobby): 1P 입력 방식 기억과 모바일 기본 선택

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P04-lobby
Task: T01-default-input-memory

- I01 lobbyInputMemory(저장·읽기 try/catch)와 createLobbySlots
- I02 PCGamePage: 초기 슬롯, 선택 저장, 마우스 기억 시 서버 조회, 로비 복귀 시 재적용
- I03 기본값·저장소 실패 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
