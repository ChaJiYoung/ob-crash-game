# Decisions: Screen Stutter and Aim Performance Optimization

- Date: 2026-11-02
- Status: Confirmed

## D01. Three.js 생명주기 격리 및 WebGL 캔버스 파괴 루프 차단
- **Chosen**: 완전한 렌더 루프 분리 및 콜백 Ref 패턴 적용
- **Rationale**: 기존 `GameCanvas3D`의 `useEffect` 의존성 배열에 `onAimChange`, `onShoot`이 포함되어 마우스/센서 이동마다 Three.js 씬, 카메라, WebGLRenderer 전체가 파괴(dispose)되고 재생성되어 극심한 스터터링과 몬스터 업데이트 단절을 유발했습니다. 상위 컴포넌트의 콜백을 `useRef`로 참조하고 Three.js 캔버스 마운트를 1회성으로 격리하여 60fps 렌더 루프를 안전하게 유지합니다.

## D02. HDRI 2K 환경 텍스처 싱글톤 캐싱
- **Chosen**: 모듈/전역 싱글톤 Promise 기반 1회 로딩 및 캐시
- **Rationale**: `buildBreweryStage3D` 실행 시마다 2K 크기의 `pub_interior_2k.hdr`을 반복해서 비동기 요청하여 배경 깜빡임과 GPU/메모리 부하를 일으켰습니다. 모듈 수준에서 HDRI 텍스처를 1회만 로드하고 재사용하도록 캐싱하여 배경 깜빡임을 제거하고 로딩 속도를 최적화합니다.

## D03. 조준 좌표(Aim) 및 조준선(Crosshair) 렌더링 최적화
- **Chosen**: React State 분리 및 직접 DOM/Ref 기반 고속 갱신
- **Rationale**: 마우스 이동 및 WebSocket `SENSOR_RELAY` 패킷 수신 시마다 `setAimX/setAimY`를 호출하여 상위 `PCGamePage`와 모든 하위 UI(HUD, 모달 등)가 초당 60~120회 불필요하게 가상 DOM 리렌더링을 겪었습니다. 조준 좌표를 `ref`로 관리하고 조준선 DOM(`CrosshairOverlay`)의 `transform`을 직접 업데이트하여 React 렌더링 부하를 0으로 줄이고 반응 지연을 완전히 제거합니다.

## D04. 몬스터 접근 및 애니메이션 루프 정상화
- **Chosen**: Three.js 단일 `requestAnimationFrame` 렌더 루프 유지
- **Rationale**: 캔버스 파괴 루프가 차단됨에 따라 `dtSec`가 정상적으로 누적되며, `engine.update()`를 통해 몬스터가 플레이어 방향으로 끊김 없이 다가오고 피격 플래시 및 회전 애니메이션이 매끄럽게 동작하게 됩니다.

## D05. 모바일 터치패드 단발 즉시 사격 및 이벤트 즉시 송신 (Zero-Delay Shot Flush)
- **Chosen**: 터치패드 `PointerDown` 시 즉시 단발 사격 트리거 + 16ms 인터벌을 기다리지 않고 WebSocket 패킷 즉시 전송
- **Rationale**: 기존에는 단발 사격이 손목 스냅(`acceleration.x >= 12.0 m/s^2`)으로만 가능해 사격 시 조준점이 흔들렸으며, 발사 신호도 16ms 주기에 묶여 지연이 발생했습니다. 터치 즉시 단발 발사(홀드 시 연사, 더블탭 시 피버 유지) 및 즉각적인 패킷 플러시를 통해 반응 속도와 명중률을 극대화합니다.

## D06. 자이로 센서 손떨림 방지(Smoothing) 및 PC 프레임 보간(Lerp)
- **Chosen**: 모바일 자이로 스무딩 필터 + PC 렌더 루프 내 60~120fps 목표 조준점 보간
- **Rationale**: 원시 자이로 센서의 미세한 손떨림과 Wi-Fi 패킷 도착 간격의 불규칙성(Jitter)으로 인해 조준선이 떨리거나 끊겨 보였습니다. 센서 스무딩과 PC 측 프레임 보간을 결합해 마우스 못지않게 매끄러운 조준 이동을 구현합니다.

## D07. `GunGripPad` 콜백 Ref 격리 및 연사 끊김 방지
- **Chosen**: `GunGripPad` 내 `UnifiedTouchPadController` 생명주기에서 콜백을 `useRef`로 분리 및 PC 측 연사 타이머 안전 해제
- **Rationale**: `GameCanvas3D`와 동일하게 인라인 콜백 참조 변경으로 `useEffect`가 재실행되며 `pad.dispose()`가 호출되어 홀드 연사가 풀리는 버그를 차단하고, 컨트롤러 연결 해제 시 PC 측 연사 인터벌도 안전하게 정리합니다.

## D08. PC-모바일 피버 준비(Fever Ready) 실시간 상태 동기화 및 진동 알림
- **Chosen**: `FEVER_STATUS_SYNC` / `FEVER_STATUS_RELAY` WebSocket 메시지 추가 및 모바일 햅틱 피드백 연동
- **Rationale**: PC에서 피버 게이지가 100% 도달하거나 소모되어 `isFeverReady` 상태가 변경될 때 서버를 통해 모바일 컨트롤러로 실시간 중계합니다. 이를 통해 모바일 `GunGripPad`의 황금빛 피버 배너(`isFeverReady`)가 즉시 활성화되고 손끝 진동 알림이 울려 모니터만 보면서도 피버 타이밍을 직관적으로 인지할 수 있습니다.

