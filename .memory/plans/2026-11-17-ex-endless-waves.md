# Plan: EX 무한 러시 (EX Endless Rush)

## Goal
7웨이브를 클리어한 판이 끝나지 않고 곧바로 "EX 무한 러시"로 이어지게 한다. 클리어 기록(outcome=VICTORY)은 지키고, 이후 DANGER 단계마다 강해지는 테마 러시와 60초마다 난입하는 보스로 점수 경쟁을 만든다.

측정 가능한 결과:
- W7 보스 클리어 후 `gamePhase`가 `VICTORY`로 가지 않고 `PLAYING`을 유지하며 EX가 시작된다(플레이어 강화 MAX).
- EX에서 목숨이 0이 되면 제출 기록이 `outcome: 'VICTORY'`, `waveReached: 7 + DANGER`가 된다.
- 러시는 10초마다 바뀌고, 할당량(1인 20+8n, 2인 ×1.5)을 필드 상한(1인 15, 2인 23) 안에서 내보낸다.
- 무기 격차: EX 점수가 무기 간 약 1.3배 이내(시뮬레이션 기준), 본편 클리어율이 실제 쓰는 방식 기준으로 비슷.
- HUD에 `⚠ DANGER n`과 `▶ {테마} RUSH!`가, 결과 화면에 `CLEAR · DANGER n 도달`이 나온다.

결정 근거: [decisions/2026-11-17-ex-endless-waves.md](../decisions/2026-11-17-ex-endless-waves.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 엔진: 무기 밸런스 조정 + EX 진입·러시 스폰·보스 난입·기록 | [P01](../phases/2026-11-17-ex-endless-waves/P01-engine-ex-rush/phase.md) |
| P02 | `done ✅` | 화면: HUD·배너·결과 화면과 최종 검증 | [P02](../phases/2026-11-17-ex-endless-waves/P02-ex-ui-and-result/phase.md) |
