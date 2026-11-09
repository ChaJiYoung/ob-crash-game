# Decisions: Azure VM 배포 (오라클 계획의 Azure 이전)

- Date: 2026-11-09
- Status: Confirmed
- 선행 결정: `feature/deployment` 브랜치의 `2026-11-08-oracle-vm-deployment.md` (D01~D19). 아래에서 폐기·변경한 항목 외에는 그대로 유효하다. 특히 D03(Docker), D04(Caddy 라우팅), D05(`./data` 바인드 마운트), D09(빈 DB 시작), D10(`node:24-bookworm-slim`), D11(SQLite 온라인 백업), D12~D13(로그 순환·압축), D14~D17(접속 상한·Origin 검사·SERVER_FULL 배너·noindex), D19(tsx 유지)를 승계한다.

## D01. 배포 대상 서비스 — Azure VM 1대 (프론트+백엔드 동거)
- **Chosen**: Azure Virtual Machine(Linux) 1대에 Docker Compose + Caddy로 프론트와 백엔드를 함께 운영한다. Static Web Apps·Container Apps·App Service는 채택하지 않는다.
- **Rationale**:
  - 방 상태가 서버 메모리에 있어 인스턴스를 1개로 고정해야 한다.
  - SQLite WAL(`journal_mode = WAL`)은 Azure Files(SMB) 같은 네트워크 저장소에서 잠금이 불안정하다. VM 로컬 디스크는 문제없다.
  - SWA는 정적 파일만 호스팅하고 WebSocket 서버를 올릴 수 없어 백엔드가 어차피 별도로 필요하다. 프론트를 SWA로 분리해도 총비용은 줄지 않고 `VITE_WS_URL`·CORS·Origin 설정만 늘어난다.
  - 오라클 작업물(`docker-compose.yml`, `Caddyfile`, 접속 상한 코드, 스모크 테스트)을 거의 그대로 재사용한다.
- **Why not oracle**: 사용자가 오라클 가입이 번거롭고 설정 단계가 Azure보다 많다고 판단함.

## D02. 구독·리소스그룹·리전
- **Chosen**: 구독 `<SUBSCRIPTION_NAME>`, 기존 리소스그룹 `<RESOURCE_GROUP>`, 리전 `koreacentral`. 사용자는 구독 Owner.
- **Rationale**: 사용자가 기존 그룹 사용을 선택. 그룹 안에 다른 팀원들의 SWA·Cosmos·Container Apps 등이 섞여 있으므로 우리 리소스는 다음 규칙으로 구분한다.
  - 리소스 이름 접두사 `ob-crash-`
  - 태그 `project=ob-crash-game`
  - 삭제·수정 스크립트는 이 태그/접두사가 붙은 리소스만 대상으로 한다.
- **확인 사항**: 그룹의 `id-grill-us-coop-cost-guard-prod` 관리 ID는 스토리지 `stgrillcoopprodb7af`의 `CoopState` 테이블 쓰기 권한만 가지고 있어 우리 VM에 영향이 없다. 기존 예산(`budget-grill-us-coop-stg` 20,000, `-prod` 150,000 월)은 코옵 프로젝트용이다.

## D03. VM 사양·OS·디스크 (일부 자동 확정)
- **Chosen**: `Standard_B2ats_v2` (x64, 2 vCPU, 1GB RAM), Ubuntu 24.04 LTS, OS 디스크 30GB Standard SSD, 스왑 2GB(런타임 안전망).
- **Rationale**: 로컬 PC가 x86_64라 이미지를 에뮬레이션 없이 `linux/amd64`로 빌드할 수 있다. 빌드는 VM에서 하지 않으므로(D05) 1GB로 런타임에 충분하다. B2pts v2(Arm64)는 로컬이 x86이라 에뮬레이션이 필요해 제외.
- **실행 시 확인할 위험**: 해당 리전·구독에서 이 SKU의 가용성·쿼터를 `az vm list-skus`로 먼저 확인한다. 불가하면 `Standard_B1s` 등 대안을 사용자에게 제안한다.

## D04. 비용 방침 — 필요할 때만 켜기 (VM 중지 운영)
- **Chosen**: 사용자는 신규 Azure 고객이 아니므로 12개월 무료 혜택이 없다(처음 가정 폐기). 유료를 감수하고, VM은 필요할 때만 켜고 쓰지 않으면 `deallocate`로 중지한다.
- **비용(2026-11-09 Azure 공개 가격 API로 Korea Central 단가 확인, 730시간/월 환산)**: B2ats v2 Linux $0.0117/h ≈ $8.54, Standard 고정 공용 IP $0.005/h ≈ $3.65, Standard SSD E4(32GiB) $2.4/월 → 24시간 가동 시 월 약 $14.6, 중지 시 월 약 $6.05(IP + 디스크). 디스크 "Mount" 항목 $0.351/월이 붙을 수 있어 최대 약 $0.35 가산. 데이터 전송량은 별도.
- **Rationale**: 그룹의 기존 월 지출(추정 $40~60) 대비 24시간 가동은 눈에 띄는 증가다. 이 게임은 플레이테스트·데모 위주 사용이므로 중지 운영이 맞다.
- **운영 도구**: `scripts/azure/vm.sh start|stop|status`.

## D05. 빌드·이미지 전달 — 로컬 빌드 + GHCR(공개)
- **Chosen**: VM에서 빌드하지 않는다. 로컬(Docker 29, buildx)에서 `linux/amd64`로 빌드해 GHCR(`ghcr.io/chajiyoung/…`)에 push하고, VM은 `docker pull`만 한다. 패키지는 공개로 설정한다.
- **Rationale**: 1GB RAM에서 `vite build`와 `better-sqlite3` 설치는 메모리 부족 위험(오라클 D01 근거). 저장소 `ChaJiYoung/ob-crash-game`이 PUBLIC이라 이미지에 새로 노출되는 정보가 없고, 공개 패키지는 VM에 인증이 필요 없다. 오라클 D06(VM에서 `git clone` 후 빌드)은 폐기한다.
- **주의**: 로컬에서 처음 push한 GHCR 패키지는 기본이 비공개이므로 GitHub 패키지 설정에서 **한 번 공개로 전환**해야 한다. 가이드에 명시한다.
- **이미지 구성**: 백엔드(`Dockerfile.backend`)와 웹(`Dockerfile.frontend`, Caddy+`dist`) 2개. 태그는 git 커밋 해시와 `latest`를 함께 붙여 롤백이 가능하게 한다.
- **compose 변경**: `docker-compose.yml`은 `image:` 참조로 바꾸고, 로컬 개발·스모크 테스트용 `build:`는 override 파일로 분리한다.

## D06. 배포 절차 — 로컬 배포 스크립트, 이후 Actions 전환 가능하게 설계
- **Chosen**: `scripts/azure/deploy.sh` 한 줄로 빌드 → GHCR push → VM 시작(꺼져 있으면) → SSH로 `docker compose pull && up -d` → `deploy-smoke.mjs`로 도메인 점검. GitHub Actions 자동화는 이번 범위 밖이며, 가이드 부록에 전환 방법만 짧게 적는다.
- **전환 용이성을 위한 구조 원칙**:
  1. "빌드·push" 단계와 "VM 갱신" 단계를 분리해 각각 호출 가능하게 한다.
  2. 이미지 이름·태그 규칙은 스크립트 한 곳(변수)에서만 정의한다.
  3. compose는 `image:`만 참조한다 (D05).
- **Rationale**: 혼자 작업하는 프로젝트라 한 줄로 끝나는 방식이 단계가 적다. 빌드 결과물(GHCR 이미지)이 같아서 나중에 Actions가 빌드 단계를 대신하기 쉽다. VM이 꺼져 있는 시간이 많아 완전 자동 배포는 불가능하다.

## D07. 인프라 생성 방식 — `az` CLI 스크립트
- **Chosen**: `scripts/azure/`에 `az` CLI 스크립트(리소스 생성, 방화벽 규칙, SSH 키, 자동 종료 설정 등)를 커밋한다. Bicep·포털 클릭 가이드는 채택하지 않는다.
- **Rationale**: 사용자가 이미 `az`에 로그인되어 있고 Owner이며, 스크립트로 재현성이 확보된다. 초급자에게 Bicep은 학습 부담이 크다.
- **실행 정책**: 실제 과금이 시작되는 리소스 생성은 **스크립트 실행 직전에 사용자 확인을 한 번 더 받는다.**

## D08. 도메인·IP — Azure 제공 DNS 이름 + 고정 공용 IP
- **Chosen**: 공용 IP(Standard SKU, 고정)에 DNS 이름 레이블을 붙여 `<이름>.koreacentral.cloudapp.azure.com`을 사용한다. Caddy가 이 주소로 Let's Encrypt 인증서를 받는다. DuckDNS는 쓰지 않는다.
- **Rationale**: 폰 자이로 센서는 HTTPS가 필수. 외부 서비스가 필요 없고, 고정 IP라 VM을 껐다 켜도 주소가 안 바뀌어 오라클 D07의 DuckDNS 갱신 크론이 필요 없다.
- **공용 IP는 필수**: 들어오는 접속(폰·PC)과 나가는 접속(`docker pull`, 인증서 발급) 모두 필요하며, 없애면 NAT Gateway(월 $30 안팎)가 더 든다. Standard SKU는 항상 고정이며 월 약 $3.7(추정).
- **컴포즈 연동**: `DOMAIN`은 위 FQDN, `ALLOWED_ORIGIN=https://<FQDN>`(오라클 D14). DNS 레이블은 `ob-crash` 접두사 + 충돌 방지 접미사로 정하되 실행 시 사용 가능 여부를 확인한다.

## D09. 네트워크·관리 접속 — SSH 키 + 22번은 내 IP만
- **Chosen**: SSH 키 인증만 허용(비밀번호 로그인 없음). NSG: 80/443(+443/udp)은 전체 허용, 22는 사용자의 현재 공인 IP에만 허용. IP가 바뀔 때를 위해 `scripts/azure/`에 "내 IP로 22 규칙 갱신" 명령을 둔다.
- **Rationale**: 로그 확인·문제 해결이 쉽고 익숙한 방식. 전체 개방(0.0.0.0/0)은 무차별 대입 공격이 상시로 들어오므로 제외. `az vm run-command` 방식은 느리고 대화형 디버깅이 불편해 제외.

## D10. 데이터·백업 — SQLite 유지 + 로컬 백업 스크립트
- **Chosen**: DB는 SQLite를 유지하고 VM 로컬 디스크의 `./data` 바인드 마운트(오라클 D05)를 쓴다. 백업은 `scripts/azure/backup.sh` 한 줄로 SQLite 온라인 백업(오라클 D11, WAL 때문에 파일 복사 금지)을 만들고 `scp`로 사용자 PC에 내려받는다.
- **Rationale**: DB 파일이 128KB 수준이고 서버 DB 코드(`server/db/`, `PlayRecordStore.ts`, `PlayerStore.ts`)는 `better-sqlite3`의 동기 API에 기대고 있어, 다른 DB로 옮기면 async 전파·테스트 재작성(`tests/` 5개 파일)이 필요하다. 방 상태가 메모리라 서버를 늘릴 수도 없어 관리형 DB의 이득이 작다.
- **Out of scope**: Cosmos DB·Azure SQL·PostgreSQL 이전. "서버를 늘려야 할 때" 또는 "기록 유실이 허용되지 않는 서비스가 될 때" 별도 작업으로 다룬다.
- **Azure SQL 재검토 결과 (2026-11-09, 사용자가 SQLite 유지 재확인)**: 무료 제공(DB당 월 100,000 vCore초·32GB)은 있으나 기존 고객 적용 여부와 자동 일시정지 시 첫 접속 지연이 미확인이다. 또한 `schema.ts`의 SQLite 문법(`AUTOINCREMENT`, `PRAGMA user_version`, 부분 인덱스)을 T-SQL로 번역하고, `PlayRecordStore`·`PlayerStore`의 동기 `prepare/get/all/run`·`db.transaction`(25곳 안팎)을 비동기로 바꾸며 `tests/` 5개 파일의 `:memory:` 기반도 재설계해야 한다. 이전이 필요해지면 먼저 두 Store를 인터페이스 뒤로 숨기는 선행 리팩터링을 한 뒤 별도 계획으로 진행한다.

## D11. 비용 안전장치 — 자동 종료
- **Chosen**: VM 자동 종료를 매일 한국 시각 24:00으로 설정한다(`az vm auto-shutdown`, 추가 비용 없음). 필요 시 스크립트로 예외 연장한다.
- **Rationale**: "필요할 때만 켜는" 운영(D04)의 약점인 끄기를 깜빡하는 경우를 막는다. 방은 모든 소켓이 끊기면 삭제되는 구조라 종료로 잃는 서비스 상태가 없다.
- **포함하지 않은 것**: 예산 알림(Azure Budget). 비용 조회가 요청 제한에 걸려 사용자 권한으로 만들 수 있는지 확인하지 못했다. 가이드에 "포털에서 예산 알림 설정" 안내만 넣고, 스크립트화는 하지 않는다.

## D12. 브랜치·문서 구성
- **Chosen**: `feature/azure-deployment`(현재 `main`과 동일)에 `feature/deployment` 전체를 가져온다(merge). WebGL 컨텍스트 손실 대응 커밋(`ad24cc4`, `f98809a`, `57218f9`)도 함께 들어온다. 오라클 전용 파일(루트 `docker-compose.yml`, `.env.example`, 오라클 가이드)은 `deploy/oracle/`로 이동하고 레거시 배너를 단다(사용자 결정). Docker·Caddy 공유 파일(`Dockerfile.*`, `Caddyfile`, `.dockerignore`)은 Azure 이미지 빌드도 쓰므로 루트에 둔다. Azure 가이드는 `docs/`에 새로 작성한다.
- **Rationale**: 병합은 2026-11-09 fast-forward로 완료(충돌 없음, tsc 0 오류, vitest 113 파일 899 테스트 통과). WebGL 대응은 사용자가 필요해서 만든 작업이다. 배포 PR에 함께 들어가는 점을 계획에 명시한다.

## 승계·폐기 요약 (오라클 결정 대비)
| 오라클 결정 | Azure에서 |
| :--- | :--- |
| D01 VM 사양(ARM A1) | 폐기 → D03 |
| D02 DuckDNS | 폐기 → D08 |
| D03~D05 Docker·Caddy·`./data` | 승계 |
| D06 VM에서 빌드 | 폐기 → D05·D06 |
| D07 유휴 회수·DuckDNS 크론 | 폐기 (Azure엔 유휴 회수 없음, 고정 IP) |
| D09~D13, D15~D19 | 승계 |
| D14 접속 상한·Origin 검사 | 승계 (`ALLOWED_ORIGIN`은 Azure FQDN) |

## D13. 운영 방식 변경 — 일단 계속 켜 둠 (2026-11-09, 사용자 결정)
- **Chosen**: 자동 종료(D11)를 끄고 VM을 계속 켜 둔다(`vm.sh autoshutdown off`). 시각 지정 자동 시작/종료 운영(Azure Automation, launchd)은 도입하지 않는다. 필요해지면 다시 정한다.
- **Rationale**: 사용자가 "일단 계속 켜놓자"를 선택. 월 약 $14.6(중지 시 $6.05)을 감수한다. Azure에는 VM을 정해진 시각에 켜 주는 기본 기능이 없어 자동 시작이 필요하면 별도 구성이 필요하다.
- **도구**: `vm.sh autoshutdown <off|HH:MM(KST)>` 추가, `vm.sh status`가 자동 종료 상태를 표시.
- **참고(안전)**: 같은 날 `az` 기본 구독이 다른 계정(타 조직 구독)으로 바뀐 것을 발견. 모든 Azure 스크립트가 `--subscription`으로 구독을 고정하고 시작 시 구독 이름+ID를 검증하므로 영향 없음.
