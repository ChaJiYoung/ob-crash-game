# Task: T01 문서 캡처 재촬영과 참조 점검

## Status: pending

## Goal
이번 변경으로 틀려진 문서 캡처(로비, 가이드 5탭, 튜토리얼, 샷건 스킬)를 새 화면으로 다시 찍어 `docs/screens/`에 교체하고, 문서가 가리키는 이미지가 모두 존재하는지 검사하는 테스트를 둔다(D15).

## Decision Summary
- 대상: 로비(`screen-01-pc-lobby.png`, `screen-01-pc-lobby-qr.png`, `screen-01b-pc-lobby-paired.png`), 가이드(`screen-07-guide-modal-controls.png`, `screen-07a-guide-weapons.png`, `screen-08-guide-modal-monsters.png`, `screen-09-guide-modal-cards-controls.png`, `screen-09b-guide-modal-items.png`, `screen-09-guide-modal-items.png`), 튜토리얼(`screen-10`~`screen-13*`), 스킬(`screen-17-skill-plunger-storm.png`), 샷건 전투(`play-wave1-shotgun-combat.png`).
- **새 이미지 추가**: 튜토리얼 3라운드 `screen-11b-tutorial-skill-shotgun.png`, `screen-11b-tutorial-skill-revolver.png`, `screen-11b-tutorial-skill-gatling.png`, 샷건 스킬 폭발 `screen-17b-skill-plunger-blast.png`. 새 파일은 그 문서(`docs/튜토리얼_훈련장_가이드.md`, `docs/무기_및_스킬_가이드.md`)에서 참조한다.
- **재촬영하지 않는 것**: 몬스터·아이템 스튜디오 이미지(`monster-*.png`, `item-*.png`). 이번 변경과 무관하다. 가이드가 쓰는 10장은 P05-T02에서 `public/guide/`로 복사된다.
- **스크립트 삭제(사용자 결정)**: 존재하지 않는 `docs/monster-studio.html`을 여는 `scripts/capture-all.mjs`, `scripts/capture-boss-and-shell.mjs`를 삭제한다(I01). 코드·테스트·현재 문서에서 참조하는 곳이 없고(과거 계획 문서에만 이름이 남음) git 이력에 남는다.
- 브라우저는 헤드리스 Chromium + **`--use-gl=angle --use-angle=metal`**(맥에서 swiftshader는 부하 때 프레임이 굶는다 — 프로젝트 메모리 규칙), `--ignore-certificate-errors`(자체 서명 HTTPS).

## Implementation

### I01. 서버 기동과 촬영 스크립트 보정
- Related Files:
  - `scripts/capture-tutorial.mjs` :: 가이드 탭 열기(18~56행)·튜토리얼 단계(60~112행) — modify (탭 버튼 선택자·3단계 라운드)
  - `scripts/capture-weapons-and-skills.mjs` :: 샷건 스킬 구간(80~107행) — modify (폭발 장면 추가)
  - `.memory/references/scripts/capture-lobby.mjs`, `capture-first-screen.mjs` — read-only(로비 촬영 참고, 필요 시 `scripts/`로 복사해 사용)
#### Details
- 서버: **`npm run dev`를 쓰지 않는다**(Cloudflare 터널까지 띄운다). 두 개를 백그라운드로: `npm run server`(WS 8787)와 `npm run dev:vite`(https://localhost:5173). 촬영 후 종료한다.
- 가이드 탭 버튼의 텍스트(`📚`/`👾` 아이콘 포함 문자열)가 새 구조에서도 같은지 `grep -n "setActiveTab" src/pc/components/GuideModal.tsx`로 확인하고, 스크립트의 선택자(`page.click('text=...')`)가 맞는지 점검한다. 가이드 모달은 카드화돼 접힘이 많으므로 **무기 탭은 샷건 카드의 "자세히 보기"를 한 번 펼친 화면**을 `screen-07a-guide-weapons.png`로 찍는다(펼침 전 카드 화면이 `screen-07-guide-modal-controls.png`로 쓰이면 파일명 의미가 어긋나므로, 기존 파일명이 가리키는 내용(예: controls)이 새 탭 구성에 없으면 그 파일은 문서에서 참조를 지우고 삭제하지 말고 목록에 적어 둔다).
- 튜토리얼: 3단계가 3라운드가 됐으므로 `capture-tutorial.mjs`의 3단계 구간을 라운드별로 나눠 각 라운드 안내문이 보이는 상태를 `screen-11b-tutorial-skill-<weapon>.png` 세 장으로 찍는다. 라운드 전환은 화면 클릭 대신 `window.__engine`(기본 노출)로 `triggerWeaponSkill(performance.now())`를 호출해 진행한다(기존 스크립트가 쓰는 방식을 따른다). 샷건 라운드는 폭발까지 기다린 뒤(`stun` 시간 + 약 0.7초) 다음 라운드로 넘어간다.
- 샷건 스킬 폭발: `capture-weapons-and-skills.mjs`의 샷건 스킬 구간에서 몬스터가 4마리 이상 보이는 상태로 스킬을 쓰고 ① 박힌 직후(`screen-17-skill-plunger-storm.png`) ② 폭발 순간(`screen-17b-skill-plunger-blast.png`, 기절 종료 시각 직후 `engine.update`가 터뜨리는 프레임, 약 `skillStunMs + 100ms`)을 찍는다.

- **스크립트 삭제**: `git rm scripts/capture-all.mjs scripts/capture-boss-and-shell.mjs`. 삭제 전 `grep -rn "capture-all\|capture-boss-and-shell" src tests docs README.md package.json scripts`로 현재 참조가 없는지 다시 확인한다(과거 `.memory/` 계획 문서의 언급은 이력이므로 고치지 않는다). 참고: `capture-all.mjs`는 몬스터·아이템 스튜디오 외에 인게임 `screen-04-pc-gameplay.png`도 찍었지만, 문서(README, docs/*.md)가 이 파일을 참조하지 않는다(확인함). 앞으로 이 장면이 필요하면 `capture-weapons-and-skills.mjs` 같은 남은 스크립트에서 찍는다.

### I02. 촬영·교체
- Related Files:
  - `docs/screens/*.png` — modify/new (위 목록)
#### Details
- 촬영 해상도 1440×900(기존과 동일). 로비 3장: 처음 접속(1P 모바일 기본·QR·"지금 할 일" 배너), `…-qr.png`(QR 대기 상태), `…-paired.png`(폰 연결 완료 — 폰 연결은 실제 폰이 없으므로 기존처럼 웹소켓으로 `CONTROLLER_PAIRED`·`ZERO_CALIBRATED`를 흉내 내는 스크립트(`.memory/references/scripts/capture-lobby.mjs`)를 참고하고, 어려우면 페어링 상태 이미지 1장은 기존 것을 유지하고 그 이유를 커밋 본문에 적는다).
- 촬영 후 각 이미지를 열어(`Read` 도구로 이미지 확인) 한글이 깨지지 않았고 카드·배너가 잘리지 않았는지 눈으로 확인한다. 실패한 장면(WebGL 컨텍스트 손실 등)은 재시도한다.
- 이미지 용량: 새 PNG 한 장이 1.5MB를 넘으면 해상도는 그대로 두고 `pngquant`가 있으면 압축하고 없으면 그대로 둔다(저장소 크기 확인용으로 `du -sh docs/screens` 전후를 커밋 본문에 적는다).

### I03. 문서 참조 점검과 테스트
- Related Files:
  - `README.md`, `docs/구동화면_쇼케이스.md`, `docs/무기_및_스킬_가이드.md`, `docs/튜토리얼_훈련장_가이드.md` — modify (새 이미지 참조·캡션)
  - `tests/docs-screens-exist.test.ts` — new
#### Details
- 새 이미지를 해당 문서의 알맞은 위치(튜토리얼 가이드 3단계 소절, 무기 가이드 4장 ① 샷건 스킬 소절)에 `![캡션](./screens/…)`로 추가하고, 참조가 끊긴(삭제·이름 변경된) 이미지가 없는지 확인한다. 캡션은 새 동작을 설명한다(예: "샷건 스킬: 박힌 뚫어뻥이 기절 후 폭발").
- `tests/docs-screens-exist.test.ts`: `README.md`와 `docs/*.md`에서 `![...](.../screens/...png)` 패턴을 정규식으로 모두 찾아 **각 파일이 실제로 존재**하는지 검사한다(경로는 문서 위치 기준 상대 경로를 해석: README는 `./docs/screens/…`, `docs/*.md`는 `./screens/…`). 실패 메시지에 어떤 문서의 어떤 경로가 없는지 나오게 한다.
- **함정**: 한글 파일명은 없으므로 문제없지만, 문서의 경로 표기가 `./docs/screens/x.png`(README)와 `./screens/x.png`(docs)로 다르다. 도우미에서 기준 디렉터리를 문서별로 다르게 해석해야 한다.

## Acceptance Criteria
- [ ] 로비·가이드 5탭·튜토리얼·샷건 스킬 캡처가 새 화면(1P 모바일 기본, 카드화 가이드, 3라운드 안내, 박힘·폭발)으로 교체됐다.
- [ ] 새 이미지(튜토리얼 라운드 3장, 폭발 1장)가 해당 문서에서 참조된다.
- [ ] 문서가 참조하는 모든 이미지 파일이 존재한다(테스트 통과).
- [ ] 이미지를 육안으로 확인했고 잘림·깨짐이 없다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/docs-screens-exist.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `git status docs/screens` — 변경·추가된 이미지 목록 확인

## Commit Message
```text
docs: 로비·가이드·튜토리얼·샷건 스킬 캡처를 새 화면으로 교체

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P07-docs-captures
Task: T01-recapture-docs-screens

- I01 촬영 스크립트 보정(가이드 탭, 튜토리얼 3라운드, 샷건 폭발 장면), 존재하지 않는 스튜디오를 여는 스크립트 2개 삭제
- I02 docs/screens 재촬영·교체, 튜토리얼 라운드 3장·폭발 1장 추가
- I03 문서 참조 갱신과 이미지 존재 검사 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
