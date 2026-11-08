# Decisions: edu-plan 스킬의 Task 묶음 기준 및 계층 경계 개선

- Date: 2026-11-08
- Status: Confirmed

## D01. Plan - Phase - Task - Implementation 4계층의 역할 및 경계 정립
- **Chosen**:
  - **Plan**: 전체 기능/프로젝트 목표.
  - **Phase**: 중간 검증 및 리뷰 마일스톤 (기존 히스토리 기조 유지: 중간 결과를 검증하고 다음 작업 전에 묶어서 리뷰할 가치가 있는 단위).
  - **Task**: 독립적으로 빌드·테스트가 통과하고 기능적 가치가 있는 최소 완결 단위 (커밋 및 순차 실행 단위).
  - **Implementation (I0x)**: Task 내부의 파일/심볼/단계별 세부 구현 및 부수 작업 단위.
- **Rationale**: Task만 무작정 묶으면 Phase와 Task의 경계가 무너지거나 청사진이 비대해져 검증과 커밋 단위의 이점을 잃게 됨. 4계층의 역할을 명확히 구분하여 Task는 '완결된 단일 책임 변경'을 맡고, 세부 파일 수정은 I0x로 흡수하도록 정립함.

## D02. Task Anti-patterns (단독 Task 생성 금지 및 I0x 필수 흡수)
- **Chosen**: 아래 항목들은 절대로 독립된 Task(T0x)로 분리하지 않고, 반드시 연관된 메인 Task의 `Implementation (I0x)` 단계로 통합한다:
  1. 단순 코드 삭제 (예: `window.__setStep` 등 디버그 훅 제거)
  2. 단순 CSS/스타일 경고 1줄 수정 (예: React `border` 축약 경고)
  3. 단순 상수/튜닝값 1~2개 수정 (예: 체력, 속도 숫자 변경)
  4. 문서/README/가이드 문구 동기화 (예: `docs-sync`)
  5. 호출부 없는 헬퍼 함수/클래스/타입 단독 추가 (호출부와 함께 1개 Task로 묶어야 함)
- **Rationale**: `edu-execute`는 Task마다 [구현 → 테스트 → Git 커밋 → phase.md 갱신 → current.md 갱신 → 학습 노트 작성] 사이클을 돌기 때문에, 수 줄짜리 단순 수정이 단독 Task로 생성되면 커밋 로그가 파편화되고 극심한 오버헤드가 발생함.

## D03. 다수의 경미한 QA/폴리싱 결함 번들링 기준
- **Chosen**: 성격/도메인별 번들링 (Bundle by Nature)
  - QA 이슈나 자잘한 수정 여러 개가 한꺼번에 발생할 경우, 자잘한 단위마다 Task를 쪼개지 않고 성격별로 묶어서 처리:
    - 예: UI/스타일 결함 3~4개 ➔ `T01 UI/레이아웃 결함 일괄 수정` 1개 Task (내부 `I01 border 스타일`, `I02 배지 위치`, `I03 십자선 오버레이`)
    - 로직/규칙 결함 ➔ `T02 게임플레이/판정 결함 수정` 1개 Task
- **Rationale**: 결함 추적성을 해치지 않으면서도 수 줄짜리 수정이 개별 Task로 파편화되는 것을 방지하고, 단일 커밋/테스트 단위로 깔끔하게 묶을 수 있음.

## D04. AI 자가 점검(Self-Check) 체크리스트 추가
- **Chosen**: `.agents/skills/edu-plan/SKILL.md`에 계획 생성 전 필수 점검 항목과 Anti-pattern 위반 시 자동 병합 규칙을 명시.
  - 계획 및 청사진 생성 전에 생성할 Task 목록을 자체 검토하여 Anti-pattern에 해당하는 Task가 있으면 즉시 상위/연관 메인 Task의 I0x로 합치도록 강제.
- **Rationale**: 원칙만 서술할 경우 AI가 자의적으로 사소한 차이를 들어 Task를 쪼갤 위험이 있으므로, 계획 작성 직전에 반드시 수행해야 할 셀프 체크리스트 형태로 지침을 배치함.

## D05. 반영 파일 범위
- **Chosen**: 워크스페이스 최상위 규칙 `AGENTS.md`는 기존 요약 형태를 유지하고, 변경 사항은 `.agents/skills/edu-plan/SKILL.md`에만 상세히 반영함.
- **Rationale**: 사용자의 요청에 따라 규칙 문서는 간결성을 유지하고 스킬 지침 파일에 구체적인 가이드와 체크리스트를 집중시킴.
