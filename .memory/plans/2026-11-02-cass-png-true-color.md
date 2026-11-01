# Plan: 카스 병맥주 공식 PNG 트루 컬러 1:1 복원 (Cass PNG True Color)

## Goal
3D 물리 조명(강도 1.8의 KeyLight, 2.0의 TopGoldLight, 1.35x 톤매핑 노출) 중첩으로 인해 과포화(Overexposed)되어 샛노랗고 쨍해진 카스 병맥주 타겟을, 외부 광원의 간섭을 받지 않는 `THREE.MeshBasicMaterial`로 전환하여 사용자가 제공한 벨루가 공식 원본 PNG 본래의 맑고 자연스러운 트루 컬러(True Color) 1:1 출력을 달성한다.
동시에 피격 플래시, 스쿼시 바운스, 결빙 틴트, 3타 격파 시 은색 뚜껑 솟구침 + 16개 유리 파편 비산 + 24개 맥주 분수 물리 파티클 연출을 100% 온전히 유지하고, 몬스터 스튜디오 및 공식 스크린샷을 전면 갱신한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | TargetModels3D 및 몬스터 스튜디오 MeshBasicMaterial 전환, 도감 스크린샷 갱신 및 검증 | [P01](../phases/2026-11-02-cass-png-true-color/P01-cass-png-true-color/phase.md) |
