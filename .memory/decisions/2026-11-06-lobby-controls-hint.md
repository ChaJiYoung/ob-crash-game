# Decisions: 로비 조작법 안내

- Date: 2026-11-06
- Status: Confirmed

## D01. 로비(QRPairingModal)에 폰·마우스 조작법을 두 줄로 요약해 보여준다
- **Chosen**: 폰 한 줄 + 마우스 한 줄. 폰: 기울여 조준 · 탭 발사(꾹 누르면 연사) · 더블탭 피버 · 총구를 위로 휙 젖혀 스킬. 마우스: 클릭 발사(누르고 있으면 연사) · 더블클릭 피버 · 우클릭 스킬 · Esc 일시정지.
- **Rationale**: 사용자가 "폰+마우스 두 줄"을 선택했다. 폰 없이 마우스로 시작하는 사람과 폰 사용자 모두 안내를 받는다. 폰 동작은 `UnifiedTouchPad`(단발·180ms 후 연사·300ms 더블탭)와 GuideModal(스냅 스킬)로 확인했다.

## D02. 마우스 피버는 더블클릭 기준으로 적는다
- **Chosen**: 마우스 줄에 Space가 아니라 더블클릭을 쓴다.
- **Rationale**: [2026-11-06-mouse-double-click-fever](./2026-11-06-mouse-double-click-fever.md)에서 Space를 제거하기로 했다. 두 작업이 같은 문구를 다루므로 안내가 서로 어긋나지 않게 한다.

## D03. 위치와 형태
- **Chosen**: `QRPairingModal` 하단, 가이드 버튼 아래·사운드 안내 위에 작은 안내 박스. 기존 스타일(작은 글씨, 회색 계열)을 따르고 새 props는 만들지 않는다.
- **Rationale**: 자세한 설명은 가이드 모달이 맡고 로비는 한눈에 보이는 요약만 둔다. 정적 문구라 PCGamePage 변경이 필요 없다. (자동 확정)

## D04. 테스트
- **Chosen**: `tests/pc-modals-and-pairing.test.ts`에 렌더 결과에 폰·마우스 조작 문구가 포함되는지 검사를 추가한다.
- **Rationale**: 이 모달을 이미 그 파일에서 렌더 검사한다. (자동 확정)
