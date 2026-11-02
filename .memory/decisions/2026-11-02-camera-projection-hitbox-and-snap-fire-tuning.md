# Decisions: 3D Camera Projection Hitbox Synchronization and Snap Fire Tuning

- Date: 2026-11-02
- Status: Confirmed

## D01. Three.js 3D Camera Perspective Projection Hit Judgment (3D 카메라 원근 투영 기반 1:1 완벽 정밀 판정)
- **Chosen**: Three.js 카메라의 실제 뷰-투영 행렬(`Vector3.project(camera)`)을 판정에 직접 연동하여 화면상 조준선 NDC 좌표와 몬스터의 실제 화면 투영 좌표를 1:1로 직접 비교.
- **Rationale**:
  - 기존에는 `computeTargetAimCoords`가 카메라 위치`(0, 1.65, 2.2)`와 원근 왜곡을 무시한 단순 각도 나눗셈 공식을 사용하여, 화면 정중앙에 조준경을 맞춰도 엔진 내부에서 0.2~0.3 이상의 수치 오차가 발생해 억울한 `MISS` 판정이 발생했습니다.
  - Three.js 3D 카메라의 실제 투영 좌표를 사용하여 "화면에서 눈으로 본 몬스터 위치 = 판정 위치" 오차를 0.00으로 제거하고, 조준경 링 안에 몬스터 메쉬가 들어오면 100% 시원하게 명중되도록 보장합니다.

## D02. Snap Fire Acceleration Threshold Relaxation and Continuous Cocking (스냅 역치 2.2 m/s² 완화 및 연속 격발 지원)
- **Chosen**:
  - 스냅 발사 가속도 인식 역치를 기존 `4.8 m/s²`에서 `2.2 m/s²`로 대폭 완화하여 가벼운 손목 까딱임만으로 즉각 격발.
  - 화면 터치를 누르고 있는 동안에는 1회 발사 후 코킹이 강제 해제되던 버그를 제거(Continuous Cocking 유지)하고, 스냅 쿨다운을 `180ms`에서 `110ms`로 단축하여 손가락을 댄 채 손목을 가볍게 튕기면 "타닥타닥타닥" 즉시 연속 발사가 되도록 개선.
- **Rationale**:
  - 기존에는 발사 1회 직후 `isCocked`를 `false`로 강제 리셋하여, 손가락을 화면에 계속 대고 있어도 2번째 이후 스냅이 모조리 씹히며 "자꾸 조준만 하는" 현상이 발생했습니다.
  - 터치를 유지하는 동안 코킹을 지속하고 감도와 쿨다운을 경쾌하게 튜닝하여 손목에 무리 없이 즉각적이고 연속적인 사격 손맛을 구현합니다.
