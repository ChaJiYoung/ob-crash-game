# Task: T02 Lobby Compact Height

## Status: done

## Goal
로비(`QRPairingModal`, `LobbyNextStepBanner`)의 세로 여백·패딩·QR 크기·카드 최소 높이를 컴팩트하게 줄여 노트북 화면에서도 모달 외곽 스크롤 없이 한 화면에 들어오도록 개선한다.

## Decision Summary
- D01: 기존 상하 구조(위: 1P/2P 카드, 아래: 랭킹 + 시작/액션 버튼)는 유지하되, 전반적인 세로 높이를 대폭 축소한다.

## Implementation

### I01. `LobbyNextStepBanner.tsx` 세로 여백 및 패딩 축소

- Related Files:
  - `src/pc/components/LobbyNextStepBanner.tsx` :: `LobbyNextStepBanner` — 마진·패딩·행 간격 축소; modify

#### Details
- **Execution Flow / Logic**:
  1. 루트 `div` 스타일에서 `marginBottom: '16px'` → `'10px'`, `padding: '10px 16px'` → `'7px 12px'`, `gap: '6px'` → `'4px'`, `borderRadius: '14px'` → `'12px'`로 축소한다.
  2. 기존 `data-testid="lobby-next-step"`, `lobby-row-${row.slot}`, `lobby-step-${row.slot}-${step.id}` 속성은 그대로 유지한다.

### I02. `QRPairingModal.tsx` 세로 높이 컴팩트화

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `SlotCard`, `QRPairingModal` — 모달 패딩, 타이틀, 슬롯 카드 높이, QR 크기, 하단 버튼·조작법 영역 세로 축소; modify

#### Details
- **Execution Flow / Logic**:
  1. 외곽 오버레이: `padding: '16px'` → `'10px'`.
  2. 모달 컨테이너(`data-testid="qr-pairing-modal-container"`):
     - `maxHeight: 'calc(100vh - 20px)'`, `padding: '16px 24px'`, `borderRadius: '20px'`.
  3. 타이틀 블록:
     - `marginBottom: '10px'`, 메인 타이틀 `fontSize: '24px'`, 부제 `fontSize: '12px'`, `marginTop: '3px'`.
  4. `SlotCard`:
     - 컨테이너: `padding: '12px 14px'`, `minHeight: '220px'`, `borderRadius: '14px'`.
     - 슬롯 헤더: `marginBottom: '8px'`.
     - 입력 선택 세그먼트: `marginBottom: '10px'`, 버튼 `padding: '6px 4px'`, `fontSize: '12px'`.
     - 카드 본문:
       - 미선택 상태: `padding: '12px 8px'`.
       - 모바일 QR 대기 상태: `QRCode.toDataURL(pairingUrl, { width: 124, margin: 1 })`, 이미지/플레이스홀더 `width: '124px'`, `height: '124px'`, `marginBottom: '6px'`, room code `fontSize: '12px'`, URL `fontSize: '10px'`.
       - 모바일 접속 완료 상태: `padding: '10px 8px'`.
       - 마우스 닉네임 입력/완료 상태: 패딩 축소(`padding: '8px 0'` / `'10px 8px'`, 아이콘 `fontSize: '28px'`).
  5. 1P/2P 카드 래퍼: `gap: '16px'`, `marginBottom: '12px'`.
  6. 하단 섹션:
     - 좌우 컨테이너: `gap: '16px'`.
     - 좌측 랭킹 박스: `flex: '0 0 340px'`, `padding: '12px 14px'`, `borderRadius: '14px'`.
     - 우측 액션 영역: `gap: '7px'`.
       - 시작/알림 버튼: `padding: '11px 14px'`, `fontSize: '15px'`.
       - 튜토리얼/가이드 버튼: `padding: '8px'`, `fontSize: '12px'`.
       - 조작법 박스: `padding: '7px 10px'`, `fontSize: '11px'`, `lineHeight: 1.45`.
       - 새 방 만들기 버튼: `padding: '7px'`, `fontSize: '11px'`.
       - 사운드 안내 문구: `fontSize: '10px'`.
  7. 모든 `data-testid` 및 `data-shootable="start"` 속성을 그대로 보존한다.

## Acceptance Criteria
- [ ] `QRPairingModal`과 `LobbyNextStepBanner`의 전체 세로 높이가 기존 대비 대폭 줄어 일반 노트북 해상도(예: 1280x800, 1366x768)에서도 외곽 스크롤이 최소화되거나 발생하지 않는다.
- [ ] 기존 로비 관련 모든 테스트(`tests/lobby-slot-cards.test.tsx`, `tests/lobby-default-input.test.ts`, `tests/pc-modals-and-pairing.test.ts` 등)와 전체 테스트 스위트가 통과한다.
- [ ] `npm run build`가 에러 없이 완료된다.

## Validation
- `npx vitest run` — 전체 테스트 스위트 통과
- `npm run build` — TypeScript 타입 체크 및 Vite 프로덕션 빌드 통과

## Commit Message
```text
style(lobby): compact vertical spacing and slot card height in QRPairingModal

Plan: 2026-11-17-lobby-compact-weapon-ranking
Phase: P02-frontend-lobby-ranking-ui
Task: T02-lobby-compact-height

- Reduce vertical padding, gaps, and margins in LobbyNextStepBanner
- Compact QRPairingModal title, SlotCard minHeight/QR size, and action buttons for laptop viewports
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
