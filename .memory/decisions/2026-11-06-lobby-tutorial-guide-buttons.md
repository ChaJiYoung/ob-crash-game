# Decisions: 로비 튜토리얼·가이드 버튼 나란히 배치

- Date: 2026-11-06
- Status: Confirmed

## D01. 로비에 `🎓 튜토리얼`과 `📖 가이드` 버튼을 한 줄에 양쪽으로 둔다
- **Chosen**: `QRPairingModal`의 가이드 버튼 한 줄(현재 "게임 가이드 & 튜토리얼" 하나, `onOpenGuide`)을 `display: flex; gap` 두 칸으로 바꿔, 왼쪽 `🎓 튜토리얼 시작`(바로 튜토리얼 진입), 오른쪽 `📖 게임 가이드`(가이드 모달 열기)를 같은 크기로 배치한다.
- **Rationale**: 지금은 튜토리얼에 가려면 가이드를 열고 그 안의 버튼을 한 번 더 눌러야 한다. 로비에서 한 번의 클릭으로 둘 중 하나로 갈 수 있게 한다. (사용자 요청)

## D02. 튜토리얼 버튼은 기존 `handleStartTutorial`을 그대로 쓴다
- **Chosen**: `QRPairingModalProps`에 `onStartTutorial?: () => void`를 추가하고 `PCGamePage`가 `handleStartTutorial`을 넘긴다. 가이드를 열었다 닫는 단계를 거치지 않는다.
- **Rationale**: `handleStartTutorial`(`PCGamePage.tsx:874`)이 가이드 닫기, 엔진 튜토리얼 시작, 단계 전환을 이미 모두 한다. 새 로직이 필요 없다. (코드 확인으로 자동 확정)

## D03. 가이드 모달 안의 튜토리얼 버튼은 그대로 둔다
- **Chosen**: `GuideModal`의 `튜토리얼 플레이` 버튼(`showTutorialButton`)은 변경하지 않는다.
- **Rationale**: 중복이지만 가이드를 읽다가 바로 시작하는 동선이 유용하고, 지우면 범위가 넓어진다. (자동 확정)

## D04. 두 버튼은 `onStartTutorial` 유무와 상관없이 가이드가 항상 보이게 한다
- **Chosen**: `onOpenGuide`만 있으면 가이드 버튼, `onStartTutorial`만 있으면 튜토리얼 버튼, 둘 다 있으면 나란히. 좁은 화면에서는 두 칸이 줄어들어도 글자가 잘리지 않도록 줄바꿈을 허용한다.
- **Rationale**: 선택 props라서 한쪽이 없을 때 빈 칸이 생기지 않게 한다. 모달 너비가 고정이라 두 칸이면 글자가 길어 쉽게 넘친다. (자동 확정)

## D05. 테스트
- **Chosen**: `tests/pc-modals-and-pairing.test.ts`에 두 콜백을 넘긴 렌더가 `튜토리얼`과 `가이드` 버튼을 모두 포함하는지, 하나만 넘기면 나머지 버튼이 없는지 검사한다.
- **Rationale**: 이 모달은 이미 같은 파일에서 렌더 검사한다. (자동 확정)
