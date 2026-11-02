# Decisions: Fix Mid-Game Countdown Restart, Fever Miss Banner/Combo, and Guide Pause/Resume

- Date: 2026-11-02
- Status: Confirmed

## D01. 인게임 도중 3-2-1 카운트다운 재시작 버그 원천 차단 (Stale Closure 및 상태 덮어쓰기 수정)
- **Chosen**: `PCGamePage.tsx`에 `gamePhaseRef`를 도입하여 웹소켓 핸들러(`socket.onmessage`)와 `startCountdownAndGame`이 항상 최신 `gamePhase`를 참조하도록 수정하고, `PAIRING` / `ZEROING` 대기 상태에서만 시작 과녁 피격 및 새 게임 카운트다운이 작동하도록 엄격히 제한함. 또한 `ZERO_CALIBRATED` 수신 시 인게임(`PLAYING`, `TUTORIAL`, `SANDBOX`) 상태를 절대 덮어쓰지 않도록 보호함.
- **Rationale**: 기존 `socket.onmessage`가 마운트 시점의 `gamePhase === 'PAIRING'`을 클로저로 캡처하고 있어, 인게임 중에도 화면 중앙을 조준해 스냅 사격하면 대기 화면 과녁을 쏜 것으로 오판하여 3, 2, 1 카운트다운과 함께 게임을 처음부터 리셋시키는 치명적 버그가 발생했기 때문.

## D02. 피버 타임 중 허공 자동 연사 `MISS` 배너 숨김 및 콤보 100% 보존
- **Chosen**: 피버 모드 활성(`isFeverActive`) 중에는 초당 10발 자동 연사 중 허공에 빗맞은 탄환이 발생해도 화면에 `MISS` 판정 배너(`setLastJudgment`)를 절대 띄우지 않고(명중 시 `PERFECT!`만 표시), `ScoreAndFeverManager`에서도 피버 충전 완료(`isFeverReady`) 및 피버 활성(`isFeverActive`) 중에는 콤보가 0으로 초기화되지 않도록 보호함.
- **Rationale**: 피버 자동 연사(0.095초 간격) 특성상 타겟 이동 사이나 타겟 처치 직후 허공 탄환이 필연적으로 발생하는데, 이때마다 `MISS` 배너가 `PERFECT!` 배너를 덮어쓰고 피버 진입 직전 빗맞은 탄환 때문에 콤보가 0이 되는 문제를 완전히 해결하기 위함.

## D03. 인게임 가이드 모달 열람 시 완벽 일시정지(Time Freeze) & 닫을 때 3-2-1 재개 카운트다운/영점 재보정
- **Chosen**: 인게임(`PLAYING`, `TUTORIAL`) 중 가이드를 열면 `engine.setPaused(true, nowMs)`를 호출하여 몬스터 이동, 스폰, 피버 자동 연사, 피버/아이템 버프/재장전 타이머를 모두 완벽히 동결함. 가이드를 닫으면 즉시 재개하지 않고 3, 2, 1 재개 카운트다운을 실행하며, 0초 도달 시 일시정지 시간만큼 모든 타이머 만료 시각을 보정(`shiftTimersByPauseDuration`)하고 현재 조준 방향을 정면 영점(0, 0)으로 재정렬한 뒤 게임을 재개함.
- **Rationale**: 가이드를 읽는 동안 뒤에서 몬스터가 방어선을 뚫거나 피버/버프 시간이 소모되는 불합리함을 막고, 가이드를 보는 동안 자세가 흐트러진 스마트폰 영점을 3, 2, 1 재개 카운트다운과 함께 자연스럽게 재정렬할 수 있도록 하기 위함.
