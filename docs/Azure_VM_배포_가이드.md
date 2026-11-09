# ☁️ Azure VM 배포 가이드

> 비어 크러셔를 Azure 가상 머신(VM) 한 대에 올리고, **필요할 때만 켜서 쓰는** 운영 가이드입니다.
> 이미지는 내 PC에서 만들어 GHCR(GitHub 컨테이너 저장소)에 올리고, VM은 받아서 실행만 합니다.
> 이 문서의 모든 명령은 **저장소 루트**에서 실행합니다.

---

## 🏛️ 구성 한눈에 보기

```
폰/PC 브라우저 ──https / wss──▶ Caddy 컨테이너 ──┬─ 화면 파일 (dist)
                                                  └─ /ws, /health ──▶ Node 서버 컨테이너
                                                                          │
                                                          VM 디스크 /opt/ob-crash/data (SQLite)
```

| 항목 | 값 |
| :--- | :--- |
| 구독 / 리소스그룹 | `<SUBSCRIPTION_NAME>` / `<RESOURCE_GROUP>` (팀 공용 그룹) |
| 리전 / VM | Korea Central / `Standard_B2ats_v2` (2 vCPU, 1GB RAM), Ubuntu 24.04 |
| 주소 | `https://<DNS_LABEL>.koreacentral.cloudapp.azure.com` (Azure가 주는 무료 이름, 고정 IP) |
| 이미지 | `ghcr.io/chajiyoung/ob-crash-backend`, `ghcr.io/chajiyoung/ob-crash-web` (공개 패키지) |
| 리소스 이름 규칙 | 전부 `ob-crash-` 접두사 + 태그 `project=ob-crash-game` |

> [!WARNING]
> `<RESOURCE_GROUP>`는 **팀 전체가 쓰는 그룹**입니다. 이 가이드의 스크립트는 `ob-crash-` 리소스만 다룹니다.
> 다른 사람의 리소스를 수정·삭제하지 마세요. 삭제할 때는 반드시 아래 [정리하기](#-정리하기-리소스-삭제)의 목록 확인 명령부터 실행하세요.

---

## 💰 비용 (꼭 읽으세요)

이 구독은 신규 고객용 12개월 무료 혜택 대상이 **아닙니다.** 아래는 2026-11-09에 Azure 공개 가격 API로 확인한 Korea Central 단가(월 730시간 환산)입니다. 실제 청구액은 구독의 비용 분석에서 확인하세요.

| 항목 | 단가 | 월 환산 |
| :--- | :--- | :--- |
| VM `B2ats v2` (Linux) | $0.0117/시간 | 약 $8.54 |
| 고정 공용 IP (Standard) | $0.005/시간 | 약 $3.65 |
| OS 디스크 30GB (Standard SSD E4, 32GiB) | 월 $2.4 | 약 $2.4 |
| **24시간 켜 둘 때 합계** | | **약 $14.6** |
| **VM을 중지(deallocate)했을 때** | IP + 디스크만 | **약 $6.05** |

- **쓰지 않을 때는 반드시 중지하세요.** `scripts/azure/vm.sh stop`
- 깜빡해도 **매일 한국 시각 24:00에 자동 종료**됩니다(Azure 자동 종료 설정).
- 데이터 전송료와 디스크 "마운트" 항목(월 약 $0.35)은 위 합계에 포함하지 않았습니다.
- 예산 알림은 스크립트로 만들지 않았습니다. 비용 권한이 있는 분이 포털의 **비용 관리 → 예산**에서 직접 설정하세요.

---

## 📋 준비물 체크리스트

| 필요한 것 | 확인 방법 |
| :--- | :--- |
| Azure CLI 로그인, 구독 `<SUBSCRIPTION_NAME>` | `az account show --query name -o tsv` |
| Docker (내 PC) | `docker info` (x86_64면 에뮬레이션 없이 빌드됩니다) |
| GitHub CLI, 계정 `ChaJiYoung` 활성, `write:packages` 권한 | `gh auth status` |
| Node 24 (스모크 테스트용) | `node -v` |
| `ssh`, `scp`, `curl` | macOS 기본 설치 |

GHCR 쓰기 권한이 없다면 터미널에서 한 번만 실행합니다(브라우저 인증이 열립니다).

```bash
gh auth refresh -s write:packages
```

> 계정이 둘 이상이면 활성 계정이 `ChaJiYoung`인지 꼭 확인하세요.

---

## 🚀 처음 한 번: 배포 절차

### 1단계: 리소스 만들기

먼저 **계획만** 확인합니다. 아무것도 만들지 않습니다.

```bash
scripts/azure/provision.sh --dry-run   # az·네트워크 없이 명령만 출력
scripts/azure/provision.sh             # 실제 사전 점검(읽기 전용) 후 계획 출력
```

사전 점검이 하는 일: 구독 이름+ID 확인, 리소스그룹 존재, `ob-crash-*` 이름 충돌 여부, DNS 이름 사용 가능 여부, VM 크기 제한과 쿼터, 내 공인 IP 확인.
이상이 없으면 실제로 만듭니다(**이때부터 과금**).

```bash
scripts/azure/provision.sh --yes
```

만들어지는 것: VM, 고정 공용 IP(DNS 이름 포함), 전용 VNet/서브넷, NSG(방화벽), 자동 종료 스케줄.
방화벽은 **443(TCP/UDP)·80은 전체 허용, 22(SSH)는 내 IP/32만 허용**입니다. 80번은 HTTPS 인증서 발급과 리다이렉트에 필요합니다.

- SSH 키가 없으면 `~/.ssh/ob-crash-azure`(ed25519, 비밀번호 없음)를 새로 만듭니다.
- 중간에 실패하면 VM을 자동으로 중지(deallocate)하고 알려 줍니다. 원인을 고친 뒤 `provision.sh --resume --yes`로 이어갑니다.
- DNS 이름 `<DNS_LABEL>`가 이미 쓰이고 있다면 `scripts/azure/config.local.sh`(git이 추적하지 않음)에 `AZ_DNS_LABEL=원하는이름`을 적습니다.

### 2단계: VM 준비 확인

첫 부팅 설정(cloud-init)이 Docker, 2GB 스왑, `/opt/ob-crash` 폴더를 준비합니다. 완료까지 몇 분 걸립니다.

```bash
scripts/azure/vm.sh ssh
# VM 안에서
cloud-init status --wait     # status: done
docker compose version
exit
```

### 3단계: 이미지 만들어 올리기

```bash
scripts/azure/build-push.sh
```

내 PC에서 `linux/amd64`로 빌드해 `ob-crash-backend`, `ob-crash-web` 두 이미지를 커밋 해시 태그와 `latest`로 올립니다.
작업 트리에 커밋되지 않은 변경이 있으면 거부합니다(`--allow-dirty`를 주면 `-dirty` 태그로만 만들고 `latest`는 건드리지 않습니다).

### 4단계: 패키지를 Public으로 바꾸기 (처음 한 번)

GHCR의 새 패키지는 **기본이 비공개**라서 VM이 받을 수 없습니다. 패키지 2개 각각 바꿔 주세요.

1. GitHub에 `ChaJiYoung` 계정으로 로그인
2. https://github.com/users/ChaJiYoung/packages/container/ob-crash-web/settings
3. https://github.com/users/ChaJiYoung/packages/container/ob-crash-backend/settings
4. 각 페이지 맨 아래 **Danger Zone → Change package visibility → Public**

이미지에는 저장소에 이미 공개된 코드만 들어 있고 비밀값은 없습니다(`.dockerignore`와 멀티 스테이지 빌드로 확인).
공개됐는지 확인하는 방법: 아래가 `200`이면 공개입니다.

```bash
T=$(curl -s "https://ghcr.io/token?scope=repository:chajiyoung/ob-crash-web:pull" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $T" \
  -H "Accept: application/vnd.oci.image.index.v1+json" https://ghcr.io/v2/chajiyoung/ob-crash-web/manifests/latest
```

### 5단계: 배포

```bash
scripts/azure/deploy.sh --skip-build --tag <3단계에서 나온 태그>
```

처음부터 한 번에 하려면 `scripts/azure/deploy.sh` 한 줄이면 3단계(빌드·push)까지 포함합니다.
`deploy.sh`가 하는 일: VM 시작 → 첫 부팅 설정 완료 대기 → compose와 `.env` 전달 → `docker compose pull && up -d` → `/health` 대기(첫 배포는 최대 300초, 인증서 발급 때문) → 스모크 테스트 6개 항목.
끝에 `All smoke tests passed`가 나오면 성공입니다.

### 6단계: 실제로 해 보기

1. PC 브라우저로 `https://<DNS_LABEL>.koreacentral.cloudapp.azure.com` 접속 (자물쇠가 보여야 합니다)
2. 화면의 QR을 폰으로 스캔 → 자이로(동작 센서) 권한 허용
3. 무기 선택 → 조준·발사 → 한 판 마무리까지

---

## 🛠️ 운영 매뉴얼

### 켜고 끄기

```bash
scripts/azure/vm.sh start     # 켜기 (약 30초 후 접속 가능, 재배포 필요 없음)
scripts/azure/vm.sh status    # PowerState / 주소 / IP
scripts/azure/vm.sh stop      # 중지: 컴퓨트 과금 정지
scripts/azure/vm.sh ssh       # VM에 접속
```

- `stop`은 내부적으로 `az vm deallocate`를 씁니다. **`az vm stop`이나 VM 안에서 `poweroff`는 쓰지 마세요.** 할당이 유지되어 컴퓨트 요금이 계속 나옵니다. 포털에서도 상태가 `중지됨(할당 취소됨)`이어야 과금이 멈춘 것입니다.
- 켜면 컨테이너는 `restart: unless-stopped`로 자동으로 올라오고, IP·도메인·인증서·DB는 그대로입니다. (검증: 중지 후 시작 29초 만에 `/health` 응답)
- 매일 24:00(한국 시각)에 자동 종료됩니다. 꺼진 뒤에는 `vm.sh start`로 다시 켜면 됩니다. 자정을 넘겨 쓰는 행사라면 시각을 바꾸거나 끄세요. 바꾸려면 `scripts/azure/config.local.sh`에 `AZ_AUTOSHUTDOWN_UTC=HHMM`(UTC)을 적고 `az vm auto-shutdown`을 직접 실행하세요.

### 업데이트와 롤백

```bash
scripts/azure/deploy.sh                                  # 현재 커밋을 빌드·push·배포
scripts/azure/deploy.sh --skip-build --tag <이전 해시>    # 롤백 (이미 올라간 이미지로 되돌림)
```

배포가 끝나면 "이전 태그"와 롤백 명령이 출력됩니다. 배포에는 `latest`가 아니라 해시 태그를 써서 어떤 코드가 떠 있는지 `.env`의 `IMAGE_TAG`로 알 수 있습니다.

### 로그 확인

```bash
scripts/azure/vm.sh ssh
cd /opt/ob-crash
docker compose logs -f backend      # 게임 서버
docker compose logs -f web          # Caddy
docker compose ps
```

로그는 파일당 10MB, 최대 3개로 자동 순환됩니다.

### 백업과 복원

랭킹 기록은 VM 디스크의 SQLite(`/opt/ob-crash/data/game.db`)에 있습니다. 이 DB는 WAL 모드라 **파일을 그냥 복사하면 최신 기록이 빠질 수 있어서**, 온라인 백업 API로 백업합니다.

```bash
scripts/azure/backup.sh            # VM이 켜져 있어야 함. backups/backup-<시각>.db 로 내려받고 무결성 검사
```

- `backups/`는 git이 추적하지 않습니다. VM의 7일 지난 백업은 자동 정리됩니다.
- 배포 전후나 VM을 지우기 전에 한 번씩 실행하는 습관을 권합니다.

복원(기존 기록을 백업으로 교체):

```bash
scripts/azure/vm.sh ssh
cd /opt/ob-crash && docker compose stop backend
exit
scp -i ~/.ssh/ob-crash-azure backups/backup-<시각>.db azureuser@<DNS_LABEL>.koreacentral.cloudapp.azure.com:/opt/ob-crash/data/restore.db
scripts/azure/vm.sh ssh
cd /opt/ob-crash/data
sudo mv restore.db game.db && sudo rm -f game.db-wal game.db-shm
cd .. && docker compose start backend
```

### 내 IP가 바뀌었을 때 (SSH가 안 될 때)

```bash
scripts/azure/nsg-myip.sh          # 22번 허용 IP를 지금 내 공인 IP/32로 갱신
```

### 접속 상한 조정

기본값은 IP당 60, 전체 300연결입니다. 행사처럼 한 Wi-Fi에서 여러 판을 돌린다면 `scripts/azure/config.local.sh`에 적습니다.

```bash
EXTRA_ENV=$'WS_MAX_CONN_PER_IP=150\nWS_MAX_CONN_TOTAL=600'
```

다음 `deploy.sh` 때 VM의 `.env`에 반영됩니다.

---

## 🔒 보안 안내

- SSH는 **키 인증만** 가능하고 22번은 **내 IP에서만** 열립니다. 모든 IP에 여는 설정은 만들지 않습니다.
- 검색엔진 색인 차단(`noindex`)과 `robots.txt`가 적용돼 있습니다. 접속 자체를 막지는 않습니다. Let's Encrypt 인증서는 공개 기록(CT 로그)에 남아 주소 자체는 조회될 수 있습니다.
- 서버는 WebSocket 접속 상한, 메시지 크기 제한(64KB), Origin 검사(자기 주소가 아니면 거절)를 합니다. 점수 조작 방지는 범위 밖입니다.
- 이미지는 공개입니다. 비밀값을 이미지나 `.env`에 넣지 마세요. 지금 `.env`에는 도메인·이미지 태그만 있습니다.
- SSH 키(`~/.ssh/ob-crash-azure`)에 비밀번호가 없습니다. 노트북 공용 사용 환경이면 `ssh-keygen -p -f ~/.ssh/ob-crash-azure`로 설정하세요. (스크립트는 비대화형 SSH(`BatchMode`)라 비밀번호를 걸면 입력을 못 받아 접속에 실패합니다. 거는 경우 `ssh-add ~/.ssh/ob-crash-azure`로 `ssh-agent`에 먼저 등록하세요.)

---

## 🧹 정리하기 (리소스 삭제)

> 되돌릴 수 없습니다. 삭제 전에 `backup.sh`로 DB를 내려받으세요. 그룹이 팀 공용이므로 **목록을 눈으로 확인한 뒤** 지웁니다.
> 이 삭제 절차는 아직 실제로 실행해 본 적이 없습니다. 처음 실행할 때 출력을 꼭 확인하세요.

먼저 지울 대상을 확인합니다. 아래 목록에 `ob-crash-`로 시작하거나 `project=ob-crash-game` 태그가 붙은 것만 있어야 합니다.

```bash
az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game'].{name:name,type:type}" -o table
```

확인했다면 목록의 리소스 ID를 그대로 삭제합니다(VM을 먼저 지워야 NIC·디스크가 풀립니다).

```bash
az vm delete -g <RESOURCE_GROUP> -n ob-crash-vm --yes
az resource delete --ids $(az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game'].id" -o tsv)
```

두 번째 명령이 일부 리소스를 "다른 리소스가 사용 중"이라고 거절하면 같은 명령을 한 번 더 실행하세요(NIC → 디스크·IP → NSG → VNet 순서로 풀립니다). 자동 종료 스케줄(`shutdown-computevm-ob-crash-vm`)도 같은 태그가 붙어 함께 지워집니다.
GHCR 패키지는 GitHub의 Package settings에서 따로 지웁니다.

---

## ❓ 자주 겪는 문제

### `denied` / `unauthorized`로 이미지를 받지 못해요
GHCR 패키지가 비공개입니다. [4단계](#4단계-패키지를-public으로-바꾸기-처음-한-번)로 두 패키지를 Public으로 바꾸세요. `deploy.sh`가 같은 안내를 출력하고 종료 코드 3으로 끝납니다.

### `az vm create`에서 `'latin-1' codec can't encode character` 오류가 나요
`scripts/azure/cloud-init.yml`에 한글 같은 ASCII 이외 문자가 들어가면 생기는 오류입니다. 이 파일은 영어로만 작성하세요(테스트가 검사합니다). 이 오류는 리소스가 만들어지기 전에 나므로 아무것도 생기지 않습니다.

### `provision.sh`가 "구독이 다릅니다"라고 해요
`az account set --subscription <SUBSCRIPTION_ID>`로 구독을 바꾼 뒤 다시 실행하세요.

### SSH가 안 돼요 (`Connection timed out`)
대개 내 공인 IP가 바뀐 것입니다. `scripts/azure/nsg-myip.sh`를 실행하세요. VM이 꺼져 있지 않은지도 `vm.sh status`로 확인합니다.

### 첫 배포에서 `/health`가 120초 넘게 안 와요
첫 배포는 이미지 받기와 인증서 발급, 1GB 메모리 때문에 오래 걸립니다(최대 300초 대기). 그래도 실패하면 `deploy.sh`가 `web` 로그를 보여 줍니다. 80번 포트가 NSG에서 열려 있는지(`allow-http`), DNS 이름이 VM 공용 IP로 풀리는지(`dig +short <주소>`) 확인하세요.

### 화면에 "접속자가 많아요" 배너가 떠요
접속 상한에 걸린 것입니다. [접속 상한 조정](#접속-상한-조정)을 보세요.

### 요금이 생각보다 많이 나와요
- `vm.sh status`가 `VM deallocated`인지 확인하세요. `VM running`이면 컴퓨트 요금이 나가는 중입니다.
- 중지해도 공용 IP와 디스크 요금(월 약 $6)은 계속 나갑니다. 오래 안 쓸 거면 [정리하기](#-정리하기-리소스-삭제)로 지우세요.

---

## 📎 부록: GitHub Actions로 이미지 빌드 옮기기

지금은 내 PC에서 빌드합니다. 나중에 자동화하려면 빌드·push 단계만 Actions로 옮기면 됩니다. VM 갱신 단계(`deploy.sh --skip-build`)는 그대로입니다.

- 워크플로우에서 `GITHUB_TOKEN`으로 `ghcr.io`에 로그인하고, `scripts/azure/build-push.sh`와 **같은 태그 규칙**(커밋 짧은 해시 + `latest`)으로 두 이미지를 push합니다.
- 패키지에 이 저장소를 연결해 두어야 Actions가 쓰기 권한을 가집니다(Package settings → Manage Actions access).
- VM이 평소 꺼져 있으므로 "push하면 자동 배포"는 되지 않습니다. 켠 뒤 `deploy.sh --skip-build --tag <해시>`로 갱신하세요.

---

## 📚 관련 문서

- 오라클 클라우드 배포 가이드(레거시): [deploy/oracle/오라클_클라우드_무료_배포_가이드.md](../deploy/oracle/오라클_클라우드_무료_배포_가이드.md)
- 스크립트: `scripts/azure/` (`provision.sh`, `build-push.sh`, `deploy.sh`, `vm.sh`, `backup.sh`, `nsg-myip.sh`)
- 운영 compose: `deploy/azure/docker-compose.yml`
