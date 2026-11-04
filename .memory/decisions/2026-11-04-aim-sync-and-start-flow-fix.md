# Decisions: Aim Synchronization & Gameplay Start Flow Fix

- Date: 2026-11-04
- Status: Confirmed

## D01. 조준경 순간이동 완화 및 실시간 보간 (Aim Sync & Lerp)
- **Chosen**: 양방향 보완 (모바일 스무딩 연속화 + PC 화면 requestAnimationFrame Lerp 보간)
- **Rationale**: 
  - 모바일 `GunGripTracker`에서 `delta > 0.15` 시 스무딩 가중치가 1.0으로 단절되며 Raw 센서 값으로 급격히 점프하던 하드코딩 분기를 제거하고, 연속적인 가변 추적을 적용합니다.
  - PC `PCGamePage` 및 `CrosshairOverlay`에서 수신된 웹소켓 좌표를 DOM에 즉시 박아 넣던 방식을 변경하여, 모니터 주사율(60~144Hz) rAF 애니메이션 루프 내에서 목표 좌표로 부드럽게 감속 추적(Lerp)하도록 개선하여 Wi-Fi 네트워크 지터를 완벽히 흡수합니다.

## D02. 3D 시작 카드 시인성 복원 및 몬스터 스폰 연계 (Card Visibility & Monster Spawning)
- **Chosen**: 3D 카드 자체 발광 네온 테두리 복원 및 중앙 안내 HUD 배너 추가
- **Rationale**: 
  - 최근 커밋에서 외곽 발광 링(`borderRing`)이 제거되어 HDRI 배경 조명에 카드가 묻혀 화면에서 전혀 보이지 않았습니다.
  - 카드가 보이지 않아 플레이어가 사격(Shoot-to-Select)을 진행할 수 없었고, 이로 인해 엔진의 `isWeaponSelectPending` 상태(Combat Freeze)가 유지되어 몬스터 스폰과 웨이브 진행이 영구 정지되었습니다.
  - 카드의 자체 발광(Emissive) 네온 프레임을 확실히 복원하고, 화면 중앙 상단에 '🎯 원하는 무기를 사격하세요!' 안내 HUD를 띄워 카드를 쏘면 즉시 몬스터 웨이브가 개시되도록 정상화합니다.

## D03. 렌더링 및 메인 스레드 렉 최적화 (Main Thread Performance Optimization)
- **Chosen**: 센서 진단 실시간 연산 및 React 상태 갱신을 평상시 인게임에서 차단
- **Rationale**: 
  - 초당 60회 웹소켓 패킷이 올 때마다 Jitter RMS 롤링 연산과 60ms 주기 React State 갱신(`setDiagnostics`, `setSensorLiveMetrics`)이 실행되어 메인 스레드와 React 가상 DOM에 막대한 병목을 초래했습니다.
  - 해당 진단 연산과 React State 갱신은 '센서 진단 랩' 모달이 열려 있을 때만 동작하도록 격리하고, 평상시 인게임에서는 `useRef` 기반 0-오버헤드 방식으로 변경하여 60~120fps 부드러운 프레임을 복원합니다.

## D04. 게임 시작 시 스킬 오발 방지 (Skill Accel Threshold & Grace Period Guard)
- **Chosen**: 가속도 임계값 상향(2.2 → 4.8 m/s²) + 카운트다운/시작 직후 1.5초간 스냅 센서 잠금(Grace Period)
- **Rationale**: 
  - 스냅 감도 임계값(`SNAP_ACCEL_THRESHOLD_MPS2`)이 2.2 m/s²로 지나치게 낮아 카운트다운 0초 완료 시 발생하는 폰 햅틱 모터 진동(`[100, 50, 150]ms`) 및 폰을 겨누는 미세 동작만으로도 스킬이 즉시 격발되었습니다.
  - 임계값을 4.8 m/s²로 상향하여 모터 진동 오작동을 차단하고, 카운트다운 중 및 게임 시작 직후 1.5초간 안전 대기 시간(Grace Period)을 두어 시작하자마자 스킬 쿨타임이 날아가는 문제를 원천 차단합니다.
