# Decisions: 로비 튜토리얼·가이드 버튼 나란히 배치

- Date: 2026-11-06
- Status: Confirmed

## D01. 로비에 `🎓 튜토리얼`과 `📖 가이드` 버튼을 한 줄에 양쪽으로 둔다
- **Chosen**: `QRPairingModal`의 가이드 버튼 한 줄(현재 "게임 가이드 & 튜토리얼" 하나, `onOpenGuide`)을 `display: flex; gap` 두 칸으로 바꿔, 왼쪽 `🎓 튜토리얼 시작`(바로 튜토리얼 진입), 오른쪽 `📖 게임 가이드`(가이드 모달 열기)를 같은 크기로 배치한다.
- **Rationale**: 지금은 튜토리얼에 가려면 가이드를 열고 그 안의 버튼을 한 번 더 눌러야 한다. 로비에서 한 번의 클릭으로 둘 중 하나로 갈 수 있게 한다. (사용자 요청)

## D02. 튜토리얼 버튼은 기존 `handleStartTutorial`을 그대로 쓴다
- **Chosen**: `QRPairingModalProps`에 `onStartTutorial?: () => void`를 추가하고 `PCGamePage`가 `handleStartTutorial`을 넘긴다. 가이드를 열었다 닫는 단계를 거치지 않는다.
- **Rationale**: `handleStartTutorial`(`PCGamePage.tsx:874`)이 가이드 닫기, 엔진 튜토리얼 시작, 단계 전환을 이미 모두 한다. 새 로직이 필요 없다. (코드 확인으로 자동 확정)

## D03. 가이드 모달 안의 `튜토리얼 플레이` 버튼은 제거한다
- **Chosen**: `GuideModal`의 하단 `튜토리얼 플레이` 버튼과 관련 props(`onStartTutorial`, `showTutorialButton`)를 삭제하고, 그 자리(왼쪽 `<div />` 자리표시)는 닫기 버튼만 오른쪽에 남도록 정리한다. `PCGamePage`가 `GuideModal`에 넘기던 `showTutorialButton`·`onStartTutorial`도 지운다. `handleStartTutorial`은 로비 버튼이 쓰므로 유지하고, 그 안의 `setIsGuideOpen(false)`도 해가 없어 둔다.
- **Rationale**: 사용자가 "가이드 모달 안에 건 제거"를 요청했다. 로비에 튜토리얼 버튼이 생겨 중복이 됐다. 가이드는 게임 중에도 열 수 있어(`handleOpenGuide`) 원래 `showTutorialButton`이 로비에서만 켜지도록 막고 있었으므로, 제거 후 게임 중 동작은 달라지지 않는다.

## D04. 두 버튼은 `onStartTutorial` 유무와 상관없이 가이드가 항상 보이게 한다
- **Chosen**: `onOpenGuide`만 있으면 가이드 버튼, `onStartTutorial`만 있으면 튜토리얼 버튼, 둘 다 있으면 나란히. 좁은 화면에서는 두 칸이 줄어들어도 글자가 잘리지 않도록 줄바꿈을 허용한다.
- **Rationale**: 선택 props라서 한쪽이 없을 때 빈 칸이 생기지 않게 한다. 모달 너비가 고정이라 두 칸이면 글자가 길어 쉽게 넘친다. (자동 확정)

## D05. 테스트
- **Chosen**: `tests/pc-modals-and-pairing.test.ts`에 두 콜백을 넘긴 렌더가 `튜토리얼`과 `가이드` 버튼을 모두 포함하는지, 하나만 넘기면 나머지 버튼이 없는지 검사한다.
- **Rationale**: 이 모달은 이미 같은 파일에서 렌더 검사한다. (자동 확정)
- 추가: `GuideModal` 소스에 `튜토리얼 플레이`·`showTutorialButton`이 남지 않았는지 소스 검사하고, 기존 `tests/tutorial-and-guide.test.ts`가 이 버튼을 참조하면 함께 고친다.
