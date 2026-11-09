# Phase: P04 실배포 검증과 가이드

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 실제 Azure 프로비저닝→첫 배포→스모크→실기기 확인→중지/재시작→백업 검증 (사용자 확인 게이트 포함) | [T01](./T01-live-deploy-verification.md) |
| T02 | `done ✅` | Azure 배포 가이드 작성과 README 갱신 (T01 결과 반영) | [T02](./T02-azure-guide-and-readme.md) |

## Progress
- done: 2/2 (complete)

## 실배포 결과 (T01, 2026-11-09)
| 항목 | 결과 | 비고 |
| :--- | :--- | :--- |
| 사전 검토 | Opus 5.5 에이전트 검토 완료(BLOCKER 0, MEDIUM 4·LOW 5) → 전부 반영 | a371186. runbook `rb-coop-playtest-guard`는 명세로 지정한 13자원만 정리 → 영향 없음 |
| 프로비저닝 | 성공. 리소스 7개 모두 `project=ob-crash-game` 태그, 22번은 내 IP/32 | 1차 시도는 cloud-init.yml 한글 주석 때문에 `az vm create` 인코딩 오류(latin-1)로 실패, 리소스 생성 0건 → ASCII로 수정(dda8380) |
| cloud-init | `done`, Docker 29.1.3, Compose 2.40.3, 스왑 2G, docker 그룹 OK | 패키지명 `docker.io`·`docker-compose-v2` 확인됨 |
| GHCR | push 성공 후 사용자가 두 패키지를 Public으로 전환, 익명 manifest HTTP 200 | 최초 push 직후 익명 조회는 403(비공개) |
| 첫 배포 | 성공, 스모크 6/6 OK(인증서 검증 켠 채) | Let's Encrypt(CN=YE2), 2027-02-07 만료, HTTP→HTTPS 308 |
| 리소스 사용 | 837MB 중 약 370MB 사용, 스왑 112MB | 컨테이너 backend 92MB, web 63MB |
| 롤백 리허설 | `--skip-build --tag latest` ↔ `dda8380` 양방향 성공, 이전 태그 안내 정확 | |
| 백업 | `backup.sh` 성공, 컨테이너 안 `node -e`의 `require` 동작, `integrity_check` ok | `-shm`/`-wal` 보조 파일 정리 로직 추가 |
| 중지/재시작 | `vm.sh stop` → `VM deallocated`(IP <VM_PUBLIC_IP> 유지) → `start` 후 **29초**에 `/health` 200, 재배포 없이 컨테이너 자동 복구, `game.db`·인증서 유지 | |
| 실기기(폰) | 접속·QR·자이로·무기 선택·발사까지 사용자 확인 | **한 판 완료와 랭킹 저장은 미확인** |
| 자동 종료 | 스케줄 `Enabled`, 15:00 UTC 설정 확인 | 실제 24:00 KST 종료 동작은 아직 미확인 |
| 최종 상태 | VM `deallocated`로 마무리 | 월 약 $6.05(IP+디스크) |

## 식별 값 분리와 이력 정리 (2026-11-09, 사용자 지적)
- 공개 저장소에 구독 ID·구독 이름·리소스그룹·DNS 레이블(구독 ID 앞 6자리 파생)·VM IP가 커밋돼 있어 `scripts/azure/config.local.sh`(gitignored)로 분리하고, 문서·테스트는 자리표시자로 교체. `config.local.sh.example` 추가, 값이 비면 `require_azure_config`가 안내 후 종료.
- push 전이던 Azure 커밋 10개의 이력에서도 `git filter-branch`로 값을 자리표시자로 치환하고 백업 브랜치·`refs/original`·reflog를 제거. 모든 커밋의 트리·diff·메시지·파일명 검사 결과 0건(남은 건 공개 `origin/main`에도 있던 작성자 이메일뿐).
- 부수 효과: 커밋 해시가 바뀌어 첫 배포 태그 `dda8380`은 어떤 커밋과도 대응하지 않음 → 새 해시 `2243203`으로 재배포(빌드·push·스모크 6/6), 분리한 설정으로 end-to-end 동작 확인. GHCR의 `dda8380` 이미지는 남아 있음.
- 재발 방지: `tests/azure-scripts.test.ts`가 추적 파일(.memory 포함)에서 로컬 설정의 실제 값과 GUID를 검색해 있으면 실패시킴.
