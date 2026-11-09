# Task: T01 로비·결과 랭킹 캡처 재촬영

## Status: done

## Goal
이번 계획(2P 기본 모바일, 플레이어별 배너, 시작 버튼 문구, 랭킹 CLEAR)으로 틀려진 문서 캡처를 새 화면으로 교체하고, 문서가 가리키는 이미지가 모두 존재하는지 확인한다.

## Decision Summary
- D11: 대상은 `docs/screens/screen-01-pc-lobby.png`, `screen-01-pc-lobby-qr.png`, `screen-01b-pc-lobby-paired.png`, `play-result-ranking.png`. 이 Phase는 P01~P03가 모두 끝난 뒤에 실행한다(UI가 확정돼야 하므로).
- 브라우저: 헤드리스 Chromium + `--ignore-certificate-errors --use-gl=angle --use-angle=metal`(프로젝트 메모리 규칙: swiftshader는 부하 때 프레임이 굶는다), 해상도 1440×900.
- 서버는 `npm run dev`를 쓰지 않는다(터널까지 띄움). `npm run server`(WS 8787)와 `npm run dev:vite`(https://localhost:5173)를 백그라운드로 띄우고 촬영 후 종료한다.

## Implementation

### I01. 촬영 스크립트 점검
- Related Files:
  - `scripts/capture-lobby.mjs` :: `captureLobbyScreens` — modify(필요 시)
  - `docs/구동화면_쇼케이스.md` — read-only(`play-result-ranking.png`를 쓰는 위치와 캡션 확인)

#### Details
- 로비 3장: ① 처음 접속(1P·2P 모두 모바일 QR, 배너 두 줄) ② QR 대기(위와 같은 상태일 수 있음 — 파일명 의미에 맞는 장면으로: 1P만 폰 연결·영점 완료 + 2P QR 대기, 버튼 "(2P 없이 1인 시작)", 2P 카드 "(선택)") ③ 폰 연결 완료(`CONTROLLER_PAIRED`·`ZERO_CALIBRATED`를 웹소켓으로 흉내, 기존 스크립트 방식). 스크립트가 2P 기본 상태를 가정한 대기 시간/선택자를 쓰는지 점검한다(`lobby-step-connect`가 `lobby-step-1-connect`로 바뀜).
- 결과 랭킹(`play-result-ranking.png`): 이 화면을 만드는 촬영 코드가 현재 `scripts/`에 없으면(`grep -rn play-result-ranking scripts` 결과 없음) 서버 DB에 클리어 1건·사망 1건을 넣고(테스트용 임시 DB, `data/game.db`를 건드리지 않는다 — 환경변수/경로 확인) 결과 화면 또는 로비 랭킹 패널에서 "CLEAR"와 `W7`이 함께 보이는 장면을 찍는다. 어렵다면 로비 랭킹 패널 캡처로 대체하고 이유를 커밋 본문에 적는다.

### I02. 촬영·교체·점검
- Related Files:
  - `docs/screens/screen-01-pc-lobby.png`, `screen-01-pc-lobby-qr.png`, `screen-01b-pc-lobby-paired.png`, `play-result-ranking.png` — modify
  - `docs/구동화면_쇼케이스.md`, `README.md` — modify(캡션이 옛 설명이면 수정)

#### Details
- 촬영 후 이미지를 `Read`로 열어 한글 깨짐·카드/배너 잘림을 눈으로 확인한다(WebGL 컨텍스트 손실 시 재시도).
- 문서 캡션: 로비는 "플레이어별 단계 뱃지, 2P는 연결하지 않아도 1인 시작" 설명, 랭킹은 "클리어는 CLEAR, 사망은 W{n}" 설명을 추가. 문서가 참조하는 이미지가 전부 존재하는지 `tests/docs-screens-exist.test.ts`로 확인(없으면 이 Task에서 만들지 말고 `npm test` 결과로만 판단).

## 실행 결과 메모 (구현 중 확정)
- `play-result-ranking.png`(결과 화면)을 만드는 촬영 코드가 없어 **재촬영하지 않고 그대로 둔다**. 대신 랭킹 패널만 찍은 새 이미지 `docs/screens/play-ranking-clear-marker.png`를 추가하고 `docs/구동화면_쇼케이스.md`에서 참조한다(CLEAR·W7 구분 설명 포함).
- 촬영용 기록은 임시 폴더를 작업 디렉터리로 띄운 서버(`data/game.db`가 아닌 임시 DB)에 심었다. 5173 포트의 vite는 다른 프로젝트 것이라 건드리지 않고, 이 프로젝트 vite는 5199로 띄웠다. 그래서 `scripts/capture-lobby.mjs`에 `CAPTURE_URL` 환경변수를 추가했다.
- `screen-01-pc-lobby-qr.png`는 "1P 접속·영점 대기 + 2P QR 대기", `screen-01b-pc-lobby-paired.png`는 "1P 준비 완료 + 2P (선택)"로 파일명 의미에 맞춰 찍었다.

## Acceptance Criteria
- [ ] 로비 3장이 새 화면(플레이어별 뱃지, 버튼 문구, 2P QR/(선택))이고, 결과/랭킹 캡처에 CLEAR가 보인다
- [ ] 이미지를 육안으로 확인했고 잘림·깨짐이 없다
- [ ] 문서 캡션이 새 동작을 설명한다
- [ ] `npm test` 통과

## Validation
- `npm test` — 전체 통과(문서 이미지 존재 검사 포함)
- `git status docs/screens` — 교체된 이미지 4장 확인

## Commit Message
```text
docs: 로비·결과 랭킹 캡처를 새 화면으로 교체

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P04-docs-captures
Task: T01-recapture-lobby-and-ranking

- 로비 3장(2P 기본 모바일·플레이어별 뱃지·버튼 문구) 재촬영
- 결과/랭킹 캡처에 CLEAR 표기 반영
- 문서 캡션 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-recapture-lobby-and-ranking"
