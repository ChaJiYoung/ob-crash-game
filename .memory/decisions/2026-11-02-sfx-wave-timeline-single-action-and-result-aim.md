# Decisions: Beer Destruction SFX, Wave Timeline HUD, Single-Action Safety, and Result Screen Crosshair Selection

- Date: 2026-11-02
- Status: Confirmed (All Interview Branches Resolved)

## D01. Beer Target Variety Destruction & Damage SFX (캔 파열/병 파쇄/보스 폭발 및 단계별 타격 사운드)
- **Chosen**:
  - `SoundSynthesizer.ts`에 몬스터 종류별 전용 피격(전조음) 및 파괴(처치음) 음향 구현:
    - **피격 시 (HP 감소 시)**: 둔탁하고 쨍한 금속 마찰/찌그러짐 전조음(`playMetallicHitSound`)
    - **최종 처치 시 (HP 0 파괴 시)**:
      - 캔 4종 (Pilgood, Caslight, Obi, Hanmac): 알루미늄 캔이 통쾌하게 찌그러지는 파열음 (`playCanCrushSound`)
      - 병 (Cass Bottle): 맑고 시원하게 산산조각 나는 유리 파열음 (`playBottleShatterSound`)
      - 보스 (Mega Golden Cass): 묵직한 중저음과 충격파가 울려 퍼지는 거대 폭발음 (`playBossExplosionSound`)
- **Rationale**:
  - 기존에는 병일 때만 단순 팝 사운드가 나고 캔/보스는 일반 비프음만 들려 타격감이 밋밋했음.
  - 일반 피격과 최종 처치를 분리하여 보스전이나 고체력 캔 공략 시 타격감과 파괴의 쾌감을 극대화.

## D02. Compact Wave Timeline Progress Bar HUD (상단 중앙 컴팩트 웨이브 토벌 게이지)
- **Chosen**:
  - `ArcadeOverlayHUD.tsx` 상단 중앙에 현재 웨이브 번호 배지와 함께, 현재 웨이브의 토벌 진행도(남은 몬스터 수 / 전체 몬스터 수)를 실시간 네온 게이지와 퍼센트(%)로 표시하는 **컴팩트 단일 바** 렌더링.
  - `BeerCrusherEngine`의 웨이브 진행 데이터(`wave`, `killedInWave`, `spawnedInWave`, `totalSpawns`)를 HUD에 실시간 바인딩.
- **Rationale**:
  - 사용자의 선택에 따라 군더더기 없는 컴팩트한 게이지 형태로 현재 웨이브의 진행 상황과 남은 토벌 대상을 직관적으로 파악할 수 있도록 구현.

## D03. Single-Action Safety Lock & Re-Cocking Haptic Feedback (1터치 1발 단발 안전장치 및 재코킹 피드백)
- **Chosen**:
  - **터치 시작 (`pointerDown`)**: 코킹 활성화 (`isCocked = true`), 모바일 컨트롤러에서 25ms 숏 햅틱 진동 + 찰칵 장전음 재생.
  - **스냅 발사 (`snapFire`)**: 1발 격발 즉시 `isCocked = false`로 강제 잠금.
  - **터치 유지 중**: 손가락을 뗄 때까지 아무리 손목 반동이나 후속 가속도가 발생해도 2차 오발(Double-Fire)을 원천 차단.
  - **손가락 뗌 ➔ 재터치**: 손가락을 뗐다가 다시 누를 때 햅틱+찰칵음과 함께 다음 탄환 재코킹.
- **Rationale**:
  - 손목 스냅 발사 직후 발생하는 폰의 감속/반동 관성으로 인해 의도치 않은 2차 발사가 일어나 미스가 나던 문제를 완벽 차단하고, 1발 1발 확실한 손맛과 안정성을 확보.

## D04. Result Screen Hover Feedback & Instant Shoot-to-Select (결과창 호버 피드백 및 즉각 사격 선택)
- **Chosen**:
  - 게임 종료 모달(VICTORY / GAMEOVER)이 표시될 때도 `CrosshairOverlay`를 최상위(z-index 160)로 노출.
  - 결과창의 "다시 도전하기(Restart)" 및 "로비로 이동(Return to Lobby)" 버튼 영역 위에 조준경이 올라가면 버튼이 네온 글로우로 반응 및 확대(Hover 피드백).
  - 해당 상태에서 손목 스냅 사격(Shoot) 시 해당 액션을 즉시 실행(Shoot-to-Select).
  - 기존 PC 마우스/터치 클릭도 정상 동작하도록 유지하여 사격과 마우스 클릭 둘 다 지원.
- **Rationale**:
  - 게임 종료 후에도 플레이어가 마우스를 잡을 필요 없이, 로비에서처럼 총을 조준하고 버튼을 쏴서 바로 재도전할 수 있도록 하여 아케이드 건슈팅의 완벽한 일체감을 제공.
