# Task: T02 QR 페어링·실시간 닉네임 환영·PC 단독 시작 모달, TOP 5 결과 모달 및 PCGamePage 통합

## Status: done

## Goal
대기 중인 3D 브루어리 배경 위에 블러 오버레이로 뜨는 **QR 페어링 & 로그인 대기 모달(`QRPairingModal`)**과 게임 종료 시 최고 점수 갱신 여부 및 **TOP 5 명예의 전당을 보여주는 결과 모달(`ResultRankingModal`)**을 구현하고, WebSocket 세션 및 PC 마우스/키보드 즉시 시작 모드를 `PCGamePage.tsx`에 통합합니다.

## Decision Summary
- **D05**: QR 페어링 모달 하단에 스마트폰 없이도 즉시 플레이할 수 있는 `[🖱️ PC 마우스/키보드로 바로 시작]` 버튼 배치
- **D08**: 스마트폰 QR 스캔 시 기존 회원은 즉시 `"🔫 [닉네임]님 접속 완료! (최고 기록: N점)"` 환영 배너 표시, 게임 종료 시 서버에 점수 전송 후 TOP 5 리더보드 렌더링

## Implementation

### I01. QR 페어링 모달, TOP 5 명예의 전당 결과 모달 및 `PCGamePage` 통합
- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModal`, `buildControllerPairingUrl` — 4자리 Room ID 기반 QR 코드(`qrcode` 패키지) 생성, 실시간 플레이어 접속 환영 카드, TOP 5 미니 보드, `[🖱️ PC 마우스/키보드로 바로 시작]` 버튼; new
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModal` — `VICTORY` / `GAME OVER` 타이틀, 최종 점수·최대 콤보·도달 웨이브 요약, `NEW RECORD!` 배지, TOP 5 명예의 전당 테이블, `[🔄 같은 닉네임으로 재도전]` 버튼; new
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — WebSocket 클라이언트(`CREATE_ROOM`, `CONTROLLER_PAIRED`, `ZERO_CALIBRATED`, `SENSOR_RELAY`, `GAME_SCORE_SUBMIT`), `GameCanvas3D`, `ArcadeOverlayHUD`, 모달 2종을 통합한 PC 메인 페이지; new

#### Details
- **Signatures & Types**:
  ```typescript
  export function buildControllerPairingUrl(origin: string, roomId: string): string;
  ```
- **Execution Flow / Logic**:
  1. **QR URL 생성 (`buildControllerPairingUrl`)**:
     - `${origin.replace(/\/$/, '')}/controller?room=${encodeURIComponent(roomId)}` 반환.
     - `qrcode.toDataURL(url, { width: 240, margin: 1 })`로 QR 이미지 생성.
  2. **페어링 및 영점 완료 전환 (`PCGamePage.tsx`)**:
     - 서버로부터 `CONTROLLER_PAIRED` 수신 시 `pairedPlayer` 상태를 갱신하고 모달 내 환영 배너 활성화.
     - 이어서 `ZERO_CALIBRATED` 수신 시(또는 사용자가 `[게임 시작]` / `[PC 마우스로 바로 시작]` 클릭 시) `gamePhase = 'PLAYING'`으로 전환하고 웨이브 시작.
  3. **게임 종료 및 랭킹 제출**:
     - `VICTORY` 또는 `GAMEOVER` 진입 시 `{ type: 'GAME_SCORE_SUBMIT', roomId, deviceId, score, waveReached, maxCombo }`를 전송하고, 수신된 `RANKING_UPDATED`로 `ResultRankingModal`의 TOP 5 리스트를 즉시 갱신.

### I02. QR 페어링 URL 빌더 및 TOP 5 랭킹 하이라이트 단위 테스트
- Related Files:
  - `tests/pc-modals-and-pairing.test.ts` :: `describe('PC QR Pairing URL & Leaderboard Modal Helpers')` — QR URL 포맷, 신규 기록 판별, 현재 플레이어 하이라이트 검증; new

#### Details
- `buildControllerPairingUrl('https://192.168.0.15:5173/', 'AB12')` 호출 시 `'https://192.168.0.15:5173/controller?room=AB12'`를 정확히 반환하는지 검증.
- TOP 5 랭킹 배열에서 현재 플레이어의 `deviceId`가 일치하는 행이 정확히 식별되고 `isNewRecord` 배지 조건이 맞는지 검증.

## Acceptance Criteria
- [ ] `QRPairingModal`에 QR 코드, 4자리 Room ID, 실시간 접속 플레이어 환영 메시지, TOP 5 보드, `[PC 마우스/키보드로 바로 시작]` 버튼이 모두 동작함
- [ ] `ResultRankingModal`이 게임 종료 시 최종 점수와 TOP 5 명예의 전당을 렌더링함
- [ ] `npx vitest run tests/pc-modals-and-pairing.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/pc-modals-and-pairing.test.ts` — QR 페어링 URL 생성 및 랭킹 모달 헬퍼 단위 테스트 통과

## Commit Message
```text
feat(pc-modals): implement QR pairing modal, TOP 5 result modal, and PCGamePage integration

Plan: 2026-11-01-beer-crusher
Phase: P03-pc-arcade-display
Task: T02-qr-pairing-and-result-modals

- Implement QRPairingModal with QR code generation, live nickname welcome, and PC mouse start button
- Implement ResultRankingModal with TOP 5 Hall of Fame leaderboard
- Connect WebSocket room session and game lifecycle in PCGamePage
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
