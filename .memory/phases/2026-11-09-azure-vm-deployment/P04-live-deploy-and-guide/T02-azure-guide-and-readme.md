# Task: T02 Azure 배포 가이드와 README

## Status: pending

## Goal
초보자가 Azure 계정 확인부터 VM 생성, 첫 배포, 매일 켜고 끄기, 업데이트·롤백, 백업, 트러블슈팅까지 따라 할 수 있는 `docs/Azure_VM_배포_가이드.md`를 작성하고 README에 연결한다. 내용은 P04-T01 실배포 결과(실측 단가, 발견한 문제)를 반영한다. 오라클 가이드는 그대로 둔다.

## Decision Summary
- D12: 오라클 가이드는 `deploy/oracle/`로 이동·레거시 표시(P01-T01), Azure 가이드는 `docs/`에 신설. D04: 비용은 추정치임을 명시하고 가격 계산기 확인을 안내(T01 교정값 반영).
- `tests/docs-sync.test.ts`가 `docs/*.md`와 `README.md`의 금지 문구를 검사하므로 새 문서도 대상이다(오라클 D18과 동일).

## Implementation

### I01. Azure 배포 가이드
- Related Files:
  - `docs/Azure_VM_배포_가이드.md` :: 배포·운영 가이드; new
  - `deploy/oracle/오라클_클라우드_무료_배포_가이드.md` :: 구조 참고(P01-T01에서 이동됨), 상단 레거시 배너에 Azure 가이드 링크 추가; modify

#### Details
- **구성(제목 수준 순서)**:
  1. 개요와 아키텍처 그림(텍스트): 브라우저 ──https/wss──▶ Caddy(VM) ──▶ 정적 파일 / `/ws`·`/health` ▶ Node 서버, 데이터는 `/opt/ob-crash/data`.
  2. **비용 안내**: 24시간 가동 / 중지 시 월 추정(T01 교정값), 구성 항목(VM·고정 공용 IP·디스크), 이 구독은 신규 고객 무료 혜택 대상이 아님, `<RESOURCE_GROUP>`가 팀 공용 그룹임을 명시. 예산 알림은 포털에서 직접 설정하라는 안내(스크립트화하지 않음).
  3. 준비물 체크리스트: Azure CLI 로그인(`az login`, 구독 `<SUBSCRIPTION_NAME>`), Docker, `gh`, GitHub 로그인, 로컬에서 80/443이 필요 없음.
  4. 단계별 절차: ① `config.local.sh`로 DNS 레이블 확인/변경 ② `provision.sh --dry-run` → `--yes` ③ cloud-init 완료 확인 ④ `gh auth refresh -s write:packages` ⑤ `build-push.sh` 후 GHCR 패키지 **Public 전환**(스크린샷 대신 클릭 경로 텍스트) ⑥ `deploy.sh` ⑦ 스모크·실기기 확인.
  5. 운영 매뉴얼: 켜기/끄기(`vm.sh start|stop|status`, **반드시 stop=deallocate**, 포털의 "중지"도 deallocate 상태가 되어야 과금 중지), 자동 종료(KST 24:00)와 연장 방법, 업데이트 배포, 롤백(`deploy.sh --skip-build --tag`), 로그 확인, 백업/복원(`backup.sh`, 복원 절차: 서비스 중지 → `data/game.db` 교체 → `-wal`/`-shm` 삭제 → 시작), 내 IP가 바뀌었을 때 `nsg-myip.sh`.
  6. 보안 안내: SSH 키 전용, 22는 내 IP만, 검색 노출 차단(noindex)·접속 상한(오라클 D14~D17 승계), 이미지는 공개(코드가 이미 공개이고 비밀값은 이미지에 없음).
  7. 정리(삭제): `ob-crash-` 접두사·`project=ob-crash-game` 태그 리소스를 **이름으로 확인하며** 삭제하는 `az` 명령 예시와 "팀 리소스는 건드리지 말 것" 경고. 삭제 순서: VM → NIC → 디스크 → 공용 IP → NSG → VNet(자동 생성된 `ob-crash-vmVNET`).
  8. FAQ·트러블슈팅(T01에서 실제 겪은 항목 우선): GHCR `denied`(공개 전환), 인증서 발급 실패(80 포트·DNS), SSH 타임아웃(내 IP 변경), `Out of quota`/SKU 오류, 켜고 껐더니 접속 안 됨(`vm.sh status`), 접속자 많음 배너, 중지를 깜빡했을 때.
  9. 부록: GitHub Actions로 이미지 빌드를 옮기는 방법(워크플로우 개요만 — `GITHUB_TOKEN`으로 GHCR 로그인, `build-push.sh`와 같은 태그 규칙; VM 갱신은 `deploy.sh --skip-build`).
- 문서에 쓰는 모든 명령은 `scripts/azure/` 실제 옵션과 일치해야 한다(작성 후 `--help`/dry-run 출력과 대조).
- `docs-sync` 금지 문구가 문서에 들어가지 않도록 게임 규칙 설명은 넣지 않는다(배포 문서이므로 해당 없음).

### I02. README 갱신
- Related Files:
  - `README.md` :: 문서 표에 Azure 가이드 행 추가, 배포 섹션에 Azure 안내 추가; modify
  - `.memory/current.md` :: 계획 완료 반영; modify

#### Details
- README 문서 표(오라클 행 바로 아래)에 `| [**☁️ Azure VM 배포 가이드**](./docs/Azure_VM_배포_가이드.md) | Azure VM + 고정 IP + GHCR 이미지 + Caddy 자동 SSL, 켜고 끄는 운영 | 엔지니어·운영자 |` 추가.
- "Docker Compose 실행(운영/배포 환경)" 절에 Azure는 `scripts/azure/deploy.sh`로 배포한다는 한 단락과 가이드 링크 추가(오라클용 `docker compose up -d --build` 설명은 유지).
- 완료 후 `.memory/current.md`를 "계획 전체 완료"로 갱신하고 Next Step에 다음을 적는다: 팀 그룹의 비용 증가 공유, 월 실제 청구 확인, Actions 전환 여부.

## Acceptance Criteria
- [ ] 가이드의 모든 명령이 실제 스크립트 옵션과 일치한다.
- [ ] 가이드에 비용 추정이 "추정이며 가격 계산기로 확인"과 함께 들어 있다.
- [ ] 중지는 `deallocate`라는 점, GHCR 공개 전환, 팀 리소스를 건드리지 말라는 경고가 포함된다.
- [ ] README 표에서 가이드 링크가 열린다(파일 경로 일치).
- [ ] `npm test` 전체가 통과한다(`docs-sync` 포함).

## Validation
- `npx vitest run tests/docs-sync.test.ts` — 통과
- `npx tsc --noEmit && npm test` — 전체 통과
- `grep -c "deallocate" docs/Azure_VM_배포_가이드.md` — 1 이상
- 가이드의 링크·경로 존재 확인: `ls docs/Azure_VM_배포_가이드.md scripts/azure/`

## Commit Message
```text
docs(deploy): Azure VM 배포 가이드 작성 및 README 갱신

Plan: 2026-11-09-azure-vm-deployment
Phase: P04-live-deploy-and-guide
Task: T02-azure-guide-and-readme

- I01: 비용·준비물·단계별 배포·켜기/끄기·롤백·백업·삭제·FAQ·Actions 전환 부록
- I02: README 문서 표와 배포 절 갱신, current.md 완료 처리
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
