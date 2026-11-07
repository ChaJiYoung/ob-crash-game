# Task: T08 문서 갱신

## Status: pending

## Goal
플레이어가 읽는 문서와 인게임 가이드에 2인팟과 바뀐 1인 동작을 반영한다(D39). 낡은 문구가 다시 들어오지 않도록 문서 동기화 테스트에 금지 규칙을 더한다.

## Decision Summary
- 대상: `README.md`, `docs/비어 크러셔 요구사항 분석서.md`, `docs/비어 크러셔 상세설계서.md`, `docs/튜토리얼_훈련장_가이드.md`, `docs/무기_및_스킬_가이드.md`, 인게임 가이드 `src/pc/components/GuideModal.tsx`. `docs/*.html` 발표 자료와 `docs/screens/` 캡처는 이번 범위가 아니다.
- 수치는 문서에 적지 말고 규칙만 적는다(배율이 `playerCountRules`에서 플레이 테스트로 바뀌므로). 꼭 필요하면 "기본값"이라고 밝힌다.

## Implementation

### I01. 반영할 내용

- Related Files:
  - `README.md`, `docs/비어 크러셔 요구사항 분석서.md`, `docs/비어 크러셔 상세설계서.md`, `docs/튜토리얼_훈련장_가이드.md`, `docs/무기_및_스킬_가이드.md`; modify
  - `src/pc/components/GuideModal.tsx` :: 가이드 본문(조작·규칙 섹션); modify

#### Details
- **2인팟 사용법**(README, 요구사항 분석서, GuideModal): 로비 1P/2P 슬롯에서 📱 모바일(슬롯 QR) 또는 🖱 마우스(닉네임) 선택, 마우스는 한 명만, 모두 준비되면 시작(D06·D07). 한쪽만 연결하면 1인.
- **2인팟 규칙**(README, 요구사항 분석서, GuideModal): 목숨·웨이브·보스 공유, 무기·카드·점수 개인, 몬스터가 더 단단하고 많음, 보상 카드는 둘 다 고를 때까지 정지(시간 제한 없음, D34), 폰이 끊기면 30초 대기 후 "나감" 처리하고 혼자 계속·돌아오면 바로 복귀(D08·D20), 파워샷·와이드는 맞힌 사람만·아이스 프리즈는 팀(D17).
- **기록·랭킹**(README, 요구사항 분석서): 2인팟은 솔로 랭킹에 오르지 않고 팀 랭킹 탭에 팀 합계로, 프로필에 파트너별 팀 최고(D05·D18·D22).
- **바뀐 1인 동작**(README, 튜토리얼 가이드, 무기 가이드, GuideModal): 폰 패드를 누른 채 연사하면 첫 발은 강한 단발(D25), 마우스 우클릭 스킬도 시작 직후·카드 선택 중엔 안 나감(D25), 카드를 고른 직후 0.3초는 스킬이 나가지 않음(D27), 튜토리얼·샌드박스 명중 범위가 실전과 같음(D30).
- **설계 문서**(상세설계서): 입력 어댑터→플레이어 동작 처리부(D25), 인원수 규칙 표·모드 규칙 표·TutorialDirector(D24·D31), 서버 슬롯 프로토콜(P03-T01) 한 절씩.

### I02. 문서 동기화 테스트

- Related Files:
  - `tests/docs-sync.test.ts` :: `FORBIDDEN`; modify

#### Details
- 금지 문구 추가(각각 `why` 포함):
  - `/위로 휙! \/ 우클릭/` — 스킬 안내는 입력 방식별 하나(D09).
  - `/10초.*자동 선택|자동 선택.*10초/` — 선택 시간 제한 없음(D34).
  - `/튜토리얼.*(넉넉|넓은) (판정|명중)/` — 연습 판정이 실전과 같음(D30).
- 기존 `collect()`가 `README.md`, `docs/*.md`, `src/pc/components/*.tsx`를 읽으므로 대상 추가는 필요 없다.

## Acceptance Criteria
- [ ] README와 인게임 가이드만 읽고 2인팟을 연결해 시작할 수 있다.
- [ ] 바뀐 1인 동작이 문서와 일치한다.

## Validation
- `npx vitest run tests/docs-sync.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 인게임 가이드를 열어 2인팟 섹션 확인

## Commit Message
```text
docs: two-player co-op guide and updated solo controls

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T08-docs

- README, requirement/design docs and the in-game guide explain slots, coop rules and team ranking
- Document the phone hold first shot, mouse skill gates, the 0.3s pick lock and real-game tutorial hit zones
- docs-sync forbids the old combined skill hint and timed auto-pick wording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
