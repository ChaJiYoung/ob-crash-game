# Decisions: 3D Forward Vector Raycast Aiming and Gimbal Lock Elimination

- Date: 2026-11-02
- Status: Confirmed

## D01. 오일러 각도 기반 조준 폐기 및 순수 3D 총구 벡터(Forward Vector) 직접 추적
- **Chosen**: W3C `DeviceOrientation` 쿼터니언 변환 후 폰 윗부분(+Y 단위 벡터)을 회전시킨 3D 단위 방향 벡터 $\vec{F}_{current} = Q \cdot (0, 1, 0)$ 직접 추적
- **Rationale**: 기존 `GunGripTracker`는 `alpha`(방위각), `beta`(피치), `gamma`(롤)를 분리하여 더하거나 빼는 오일러 각도 방식으로 계산하여, 대각선 조준(예: 좌측 상단) 시 오일러 축들이 얽히거나 짐벌락(Gimbal Lock) 및 부호 급반전이 일어나 조준선이 엉뚱한 우측 상단으로 튀어버리는 문제가 있었습니다. 3차원 공간에서 폰 앞코가 실제로 가리키는 순수 단위 방향 벡터를 직접 추적하여 대각선 튐과 축 꼬임을 원천 제거합니다.

## D02. 중력 기준 가상 모니터 평면(World-Up Screen Plane) 투영 좌표계
- **Chosen**: 영점($Q_{zero}$) 시점의 총구 방향 $\vec{F}_0$와 월드 수직축(World Up = $(0, 0, 1)$ 또는 지구 중력 반대축)의 외적($\vec{F}_0 \times \vec{Up}_{world}$)으로 모니터 수평축 $\vec{Right}$를 구하고, $\vec{Right} \times \vec{F}_0$으로 모니터 수직축 $\vec{Up}$을 자동 생성하여 현재 총구 벡터 $\vec{F}_{current}$를 투영
- **Rationale**: 사용자가 스마트폰을 리모컨처럼 화면을 위로 보게 쥐든, 권총처럼 화면을 옆으로 세워 쥐든, 비스듬히 쥐든 상관없이 영점을 잡는 순간 사용자 앞의 실제 모니터 가로·세로 평면이 3D 공간에 정확히 정의됩니다. 따라서 실제 공간에서 폰 앞코를 오른쪽/위쪽으로 움직인 만큼 정직하고 부드럽게 화면의 조준선(`aimX, aimY`)이 이동합니다.

## D03. 직관적인 조준 각도 스케일링 및 가동 범위 유지
- **Chosen**: 투영된 총구 벡터의 각도 편차를 `atan2` 또는 내적($\vec{F}_{current} \cdot \vec{Right}$, $\vec{F}_{current} \cdot \vec{Up}$)으로 추출하여 설정된 가동 범위(`yawHalfRangeDeg`, `pitchHalfRangeDeg`, `sensitivityX`, `sensitivityY`)에 맞춰 `[-1.0, +1.0]`으로 정규화
- **Rationale**: 기존의 2단계 맞춤 가동 범위 측정 및 감도 조절 슬라이더, 스무딩 필터와 100% 호환되면서도 대각선 튐 현상만 말끔히 제거합니다.
