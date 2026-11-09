# Task: T02 가이드 나머지 탭 카드화와 문서 동기화

## Status: done

## Goal
몬스터·카드·아이템·협동 탭도 T01의 `GuideCard`로 바꿔 모든 탭이 "아이콘 + 한 줄 요약 + 수치 칩 + 접기" 형태가 되게 하고, `GuideModal.tsx`는 탭 라우터만 남긴다. README·문서의 가이드 설명을 새 구조에 맞춘다(D11).

## Decision Summary
- 탭 구조·`GuideModalProps`는 그대로. 각 탭은 `src/pc/components/guide/<Name>Tab.tsx`로 분리한다. 기존 정보는 지우지 않고 **접히는 상세**로 옮긴다(정보 손실 금지).
- 몬스터: 카드 위에는 `role`(한 줄 요약)과 칩(체력 `TARGET_SPECS[k].maxHp`, 속도 `speedText`)만, `description`·`tip`·이미지는 접힘. 아이템: 한 줄 효과(`ITEM_BUFF_SPECS[k].description`)·지속 시간 칩, 상세와 `tip`은 접힘. 보상 카드: 카드마다 `REWARD_CARD_SPECS[k].descriptionKo`가 한 줄, 선택 규칙 긴 설명은 접힘.
- 소스 문자열 검사 테스트는 T01의 `readGuideSource()`로 이미 합쳐 읽는다. 문자열(`GAME_TUNING.boss.summonCountByStep`, `GAME_TUNING.boss.minionDrop.minRadiusM`, `GAME_TUNING.score.timeBonus.maxPerWave`, `GAME_TUNING.score.timeBonus.zeroAtParMult`, `GAME_TUNING.boss.encounterStartRatio`, `MID_CARD_TEXT`, `GAME_TUNING.fever.killDelta`)이 **그대로 소스에 남아야** 한다. 옮길 때 식을 바꾸지 말고 그대로 복사한다.

## Implementation

### I01. 탭 분리와 카드화
- Related Files:
  - `src/pc/components/guide/MonstersTab.tsx` :: `MonstersTab`, `MONSTER_DETAILS`(51~104행에서 이동) — new
  - `src/pc/components/guide/CardsTab.tsx` :: `CardsTab`, `MID_CARD_TEXT`(7~10행에서 이동) — new
  - `src/pc/components/guide/ItemsTab.tsx` :: `ItemsTab`, `ITEM_DETAILS`(105~143행에서 이동) — new
  - `src/pc/components/guide/CoopTab.tsx` :: `CoopTab` — new
  - `src/pc/components/GuideModal.tsx` :: 탭 5개 블록을 `<MonstersTab />` 등 호출로 교체 — modify
  - `src/pc/components/guide/GuideCard.tsx` — T01 산출물 재사용(필요 시 소폭 보강)
#### Details
- **Signatures & Types**: 각 탭 컴포넌트는 props 없는 `React.FC`.
- **Execution Flow / Logic**:
  1. `MonstersTab`: 위쪽 "전장 특수 기믹 & 체력바 시스템" 배너는 `<details>`로 접고(제목 "✨ 전장 특수 기믹 & 체력바 시스템", 본문은 기존 그대로 — 황금 캔 점수·`GAME_TUNING.goldenCan` 값 식 유지) 그 아래 몬스터 그리드를 `GuideCard`로 바꾼다. 카드: `icon`은 `imageSrc`가 있으면 64px `<img>`, 없으면 `TARGET_SPECS[k].displayName`의 첫 글자 대신 일반 아이콘(`👾`), `title = TARGET_SPECS[k].displayName`, `oneLiner = detail.role`, `accentColor = TARGET_SPECS[k].brandColorHex`, `chips = [{체력: `${maxHp}HP`}, {속도: detail.speedText}]`, 상세에 `description`·`tip`·보스 관련 기존 문구. 보스(`boss`)의 기존 문구(`summonCountByStep`·`minionDrop` 식 포함)는 상세 안에 **식 그대로** 옮긴다.
  2. `CardsTab`: "킬 게이지 보상 카드" 설명 블록(`MID_CARD_TEXT`·`GAME_TUNING.waves` 식 포함)은 맨 위 `<details>`로 접고, 9종 카드는 2열 `GuideCard`(`icon = cspec.icon`, `title = nameKo`, `badge = badgeText`, `oneLiner = descriptionKo`, `accentColor = colorHex`)로 만든다. 카드 목록 밑의 조작법 섹션(탭 이름이 "보상 카드 & 조작법"이었던 부분)은 그대로 이동하되 긴 문단은 접는다.
  3. `ItemsTab`: `ITEM_DETAILS` 항목을 `GuideCard`로(`oneLiner = spec.description`, `chips`에 지속 시간 `${durationMs/1000}초`(0이면 '즉시'), `accentColor = spec.auraColorHex`, 상세에 기존 `tip`·이미지).
  4. `CoopTab`: 두 블록("2인팟 로비 연결 & 슬롯 시스템", 협동 전투 규칙)을 각각 `GuideCard`(한 줄 요약 + 접힌 상세)로. 한 줄 요약 예: "1P·2P 각자 폰 또는 마우스로 참여, 한 명만 연결하면 1인 플레이", "목숨·웨이브·보스는 공유, 점수·성장은 개인".
  5. `GuideModal.tsx`에는 탭 버튼, 헤더, `activeTab` 상태, 5개 탭 호출, 닫기 버튼만 남고 `MONSTER_DETAILS`·`ITEM_DETAILS`·`MID_CARD_TEXT`는 이동한다. 헤더 부제(예: "3종 무기 & 스냅 액티브 스킬, 몬스터 5종 + 보스 3회(7웨이브), 9종 사격 선택 카드")는 현재 값과 어긋나지 않는지 확인한다(`GAME_TUNING.waves`에서 계산).
- **함정**: ① 가이드 이미지(`imageSrc`)가 지금은 `/docs/screens/...`를 가리킨다. 이 경로는 Vite **개발 서버**가 프로젝트 루트를 서빙해서 `npm run dev`에서만 보이고, 배포 빌드(`dist/`)에는 `docs/`가 없어 **배포본 가이드에서 이미지가 깨진다**(`dist`에 `assets`·`hdri`·`textures`만 있음 확인). I03에서 가이드가 쓰는 이미지 10장만 `public/guide/`로 복사하고 경로를 바꾼다(사용자 결정). 이미지 로드 실패 시에도 카드가 깨지지 않도록 `<img>`는 `onError`로 숨기고 아이콘(이모지)을 대신 보이게 한다. ② 높이가 큰 카드 그리드가 모달(`maxHeight: 92vh`) 안에서 스크롤되므로 각 탭 루트는 기존처럼 `display: flex; flexDirection: column; gap: 20px`를 유지한다. ③ 탭 전환 시 접힌 상태는 초기화돼도 된다(`<details>`는 언마운트 시 닫힘으로 돌아간다).

### I03. 가이드 이미지를 `public/guide/`로 복사 (배포본 이미지 깨짐 수정)
- Related Files:
  - `public/guide/` :: 이미지 10장 — new (`docs/screens/`에서 **복사**, 원본은 그대로 둔다)
  - `src/pc/components/guide/MonstersTab.tsx` :: `MONSTER_DETAILS[*].imageSrc` — modify
  - `src/pc/components/guide/ItemsTab.tsx` :: `ITEM_DETAILS[*].imageSrc` — modify
  - `tests/guide-images.test.ts` — new
#### Details
- 복사 대상(가이드가 실제로 참조하는 10장, 합계 약 5.6MB. `monster-05-draft-mug.png`·`monster-06b-boss-king.png`·`*-lineup-all.png`는 가이드가 쓰지 않으므로 복사하지 않는다):
  `monster-01-pilgood.png`, `monster-02-caslight.png`, `monster-03-obi.png`, `monster-04-hanmac.png`, `monster-05-cass-bottle.png`, `monster-06-boss-dispenser.png`, `item-01-power-shot.png`, `item-02-wide-scope.png`, `item-03-ice-freeze.png`, `item-04-bar-repair.png`.
  ```bash
  mkdir -p public/guide && for f in monster-01-pilgood monster-02-caslight monster-03-obi monster-04-hanmac monster-05-cass-bottle monster-06-boss-dispenser item-01-power-shot item-02-wide-scope item-03-ice-freeze item-04-bar-repair; do cp docs/screens/$f.png public/guide/$f.png; done
  ```
- 각 `imageSrc`를 `'/docs/screens/<name>.png'`에서 `'/guide/<name>.png'`로 바꾼다. Vite는 `public/` 파일을 개발·배포 모두 루트(`/guide/...`)에서 서빙하고, `vite build`가 `dist/guide/`로 복사한다(기존 `public/textures`·`public/hdri`가 같은 방식).
- `tests/guide-images.test.ts`: `MONSTER_DETAILS`·`ITEM_DETAILS`의 모든 `imageSrc`가 `/guide/`로 시작하고 `public` 아래에 실제 파일이 존재하는지(`fs.existsSync(path.join('public', imageSrc))`) 검사한다. 두 상수를 export해야 하므로 `MonstersTab.tsx`·`ItemsTab.tsx`에서 `export const MONSTER_DETAILS`·`ITEM_DETAILS`로 내보낸다.
- **함정**: ① `docs/screens/` 원본은 문서(README, docs/*.md)가 계속 참조하므로 **이동이 아니라 복사**다. P07에서 원본이 재촬영되더라도 가이드 이미지는 몬스터·아이템 스튜디오 이미지라 재촬영 대상이 아니다(둘이 같은 내용이어서 어긋나지 않는다). ② `.dockerignore`가 `public`을 제외하지 않는지 확인한다(`cat .dockerignore`) — 제외돼 있으면 배포 이미지에 안 들어간다. ③ `Dockerfile.frontend`는 `COPY . .` 후 빌드하므로 `public/guide`가 있으면 `dist/guide`로 간다. 빌드 확인은 `npm run build && ls dist/guide`로 한다.

### I02. 테스트와 문서 동기화
- Related Files:
  - `tests/guide-cards.test.tsx` — modify(T01 파일에 케이스 추가)
  - `tests/docs-sync.test.ts` — 전체 실행 후 필요 시 modify
  - `README.md`, `docs/구동화면_쇼케이스.md` — 가이드 모달 설명 문장 modify
#### Details
- 케이스: ① `MonstersTab`: `TARGET_SPECS`의 모든 몬스터 이름이 렌더되고 각 카드에 `체력` 칩이 `maxHp`와 일치, 접힌 `details` 안에 `tip`; ② `CardsTab`: 9종 카드 `nameKo` 모두 있고 `MID_CARD_TEXT`('4·6웨이브')가 상세 안에 있다; ③ `ItemsTab`: 아이템 4종의 한 줄 효과(`description`)가 접힘 밖에 있다; ④ `CoopTab`: 한 줄 요약 두 개; ⑤ `GuideModal`을 `isOpen`으로 렌더하면 기본 탭(무기)의 카드가 보이고 닫기 버튼이 있으며, `isOpen=false`이면 빈 렌더(`''`).
- `README.md`·`docs/구동화면_쇼케이스.md`에서 "가이드 모달"을 설명하는 문장을 `grep -n "가이드 모달"`로 찾아 "카드(아이콘·한 줄 요약·수치 칩), 상세는 '자세히 보기'" 구조로 한 문장씩 고친다(문서 전체를 새로 쓰지 않는다). `docs-sync`가 문서 문구를 검사하는 부분은 전체 테스트로 확인한다.

## Acceptance Criteria
- [ ] 다섯 탭이 모두 카드(아이콘·한 줄 요약·칩, 접힌 상세)로 보이고 기존 정보는 상세에서 확인된다.
- [ ] `GuideModal.tsx`는 탭 라우터만 남았고(`MONSTER_DETAILS` 등은 탭 파일로 이동), 소스 문자열 검사 테스트가 계속 통과한다.
- [ ] 튜닝 값 식이 이동 전과 같고, 가이드 이미지 10장이 `public/guide/`에 있으며 `npm run build` 뒤 `dist/guide/`에 들어 있다(배포본에서 이미지가 보인다).
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/guide-cards.test.tsx tests/docs-sync.test.ts tests/pc-modals-and-pairing.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run build && ls dist/guide` — 이미지 10장 확인
- (수동) `npm run dev` → 가이드 모달의 5개 탭을 모두 열어 카드와 펼침이 깨지지 않는지, 좁은 창(폭 800px)에서도 가로 스크롤이 없는지 확인

## Commit Message
```text
feat(guide): 몬스터·카드·아이템·협동 탭 카드화

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P05-guide
Task: T02-guide-cards-rest-and-docs

- I01 탭 4개를 guide/ 컴포넌트로 분리해 GuideCard로 표시, GuideModal은 탭 라우터
- I02 카드 테스트 추가, README·쇼케이스 문서의 가이드 설명 갱신
- I03 가이드 이미지 10장을 public/guide로 복사하고 경로 변경(배포본 이미지 깨짐 수정)
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T02-guide-cards-rest-and-docs"
