# Current Context

## Active Plan
[미지원 폰 차단 + 센서 테스트장 숨기기 + 피버·탄창·조준 수정](./plans/2026-11-08-unsupported-phone-block.md)

## Active Phase
[P01 센서 테스트장 숨기기 + 센서 랩 모달 흔들림 수정](./phases/2026-11-08-unsupported-phone-block/P01-hide-lab-and-fix-flicker/phase.md)

## Active Task
[T01 센서 테스트장 숨기기 + 센서 랩 모달 흔들림 수정](./phases/2026-11-08-unsupported-phone-block/P01-hide-lab-and-fix-flicker/T01-sensor-lab-url-only.md)

## Status
- 계획 `2026-11-08-unsupported-phone-block`에 피버·탄창·조준 수정(P03)을 합쳐 수립 완료. 실행 순서: P01(T01) → P02(T01~T04) → P03(T01~T03) → P04(T01). 병렬 금지, 한 Task씩 커밋.
- 이전 계획 [플레이 테스트 피드백](./plans/2026-11-08-playtest-feedback.md) 전체 완료.
- 주의: 실기기 검증(P04)은 `npm run dev`가 아니라 운영 빌드(`npm run build && npm run preview`)로 해야 한다. 개발 모드는 폰 판별을 건너뛴다.

## Next Step (IMPORTANT)
P01-T01 청사진을 읽고 `src/pc/components/QRPairingModal.tsx`의 테스트장 버튼 제거부터 구현 시작
