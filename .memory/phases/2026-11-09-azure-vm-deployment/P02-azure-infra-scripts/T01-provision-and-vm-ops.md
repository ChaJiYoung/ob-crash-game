# Task: T01 Azure 프로비저닝·VM 운영 스크립트

## Status: done

## Goal
`scripts/azure/provision.sh`가 `<RESOURCE_GROUP>` 리소스그룹에 VM·고정 공용 IP(DNS 이름)·NSG·자동 종료를 만드는 `az` 명령 묶음을 **기본은 계획만 출력**하고 `--yes`가 있을 때만 실행하도록 한다. `vm.sh`로 VM을 켜고(`start`)·과금을 멈추고(`stop`=deallocate)·상태를 보고(`status`)·접속(`ssh`)하며, `nsg-myip.sh`로 22번 규칙을 현재 내 IP로 갱신한다. 이 Task에서는 **Azure 리소스를 실제로 만들지 않는다**(dry-run과 문법·구조 테스트로만 검증).

## Decision Summary
- D02: 구독 `<SUBSCRIPTION_NAME>`, RG `<RESOURCE_GROUP>`(팀 리소스와 공유) → 접두사 `ob-crash-`와 태그 `project=ob-crash-game`으로 구분, 이름이 이미 있으면 **수정하지 않고 중단**.
- D03: `Standard_B2ats_v2`, Ubuntu 24.04, 30GB Standard SSD, 스왑 2GB(cloud-init).
- D04/D11: 중지는 `az vm deallocate`, 자동 종료 KST 24:00 = UTC 15:00.
- D07/D08/D09: `az` 스크립트, Standard 고정 공용 IP + `<label>.koreacentral.cloudapp.azure.com`, SSH 키 전용·22는 내 IP만.

## Implementation

### I01. Azure 변수와 공용 함수
- Related Files:
  - `scripts/azure/config.sh` :: Azure 변수 추가; modify
  - `scripts/azure/lib.sh` :: 로그·dry-run·ssh 헬퍼; new

#### Details
- **config.sh에 추가할 변수** (모두 `${VAR:-기본값}` 형태로 덮어쓰기 가능):
  ```bash
  AZ="${AZ:-az}"
  AZ_SUBSCRIPTION_NAME="<SUBSCRIPTION_NAME>"
  AZ_RESOURCE_GROUP="<RESOURCE_GROUP>"
  AZ_LOCATION="koreacentral"
  AZ_VM_NAME="ob-crash-vm"
  AZ_VM_SIZE="Standard_B2ats_v2"
  AZ_VM_IMAGE="Canonical:ubuntu-24_04-lts:server:latest"
  AZ_ADMIN_USER="azureuser"
  AZ_OS_DISK_GB="30"
  AZ_PIP_NAME="ob-crash-pip"
  AZ_NSG_NAME="ob-crash-nsg"
  AZ_DNS_LABEL="<DNS_LABEL>"      # 구독 ID 앞 6자리로 충돌 가능성 낮춤. 가용성은 provision.sh가 검사
  AZ_TAG="project=ob-crash-game"
  AZ_AUTOSHUTDOWN_UTC="1500"          # KST 24:00
  SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/ob-crash-azure}"
  AZ_FQDN="${AZ_DNS_LABEL}.${AZ_LOCATION}.cloudapp.azure.com"
  ```
- **lib.sh 함수**(source 전용):
  ```bash
  log()  # 파란/일반 텍스트로 "[azure] ..." 출력 (stderr)
  die()  # 메시지 + exit 코드 (기본 1)
  run()  # DRY_RUN=1이면 "[dry-run] $*" 를 stdout에 출력하고 실행하지 않음, 아니면 "$@" 실행
  ssh_opts()   # -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=15
  ssh_run()    # ssh $(ssh_opts) "$AZ_ADMIN_USER@$AZ_FQDN" "$@"
  wait_for_ssh() # 최대 180초 동안 5초 간격으로 `ssh_run true` 재시도, 실패 시 die
  ```
- **함정**: `run()`은 인자를 쪼개지 말고 `"$@"`로 실행해야 공백이 있는 값(태그·cloud-init 경로)이 깨지지 않는다. dry-run 출력은 사람이 읽기 위한 것이므로 `printf '%q '`로 인용한다.

### I02. cloud-init 설정
- Related Files:
  - `scripts/azure/cloud-init.yml` :: 첫 부팅 시 Docker·스왑·디렉터리 준비; new

#### Details
- `#cloud-config` 형식. 내용:
  ```yaml
  #cloud-config
  package_update: true
  packages: [docker.io, docker-compose-v2, ca-certificates, curl]
  runcmd:
    - [ bash, -c, "fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab" ]
    - [ systemctl, enable, --now, docker ]
    - [ usermod, -aG, docker, azureuser ]
    - [ bash, -c, "mkdir -p /opt/ob-crash/data && chown -R azureuser:azureuser /opt/ob-crash" ]
  ```
- Ubuntu 24.04(noble)의 `docker.io`와 `docker-compose-v2`(플러그인 `docker compose`)를 쓴다. 외부 저장소·스크립트 다운로드가 없어 단계가 적다. **패키지 이름과 `docker compose version` 동작은 P04 실배포에서 최초 확인**하며, 어긋나면 이 파일을 고친다.
- 관리자 사용자 이름은 `AZ_ADMIN_USER`와 같아야 한다(`azureuser`). 값이 바뀌면 이 파일의 두 곳도 함께 바꾼다는 주석을 남긴다.
- 컨테이너는 root로 `/opt/ob-crash/data`에 쓰므로 소유자 설정은 호스트에서 scp/백업 편의를 위한 것이다.

### I03. 프로비저닝 스크립트
- Related Files:
  - `scripts/azure/provision.sh` :: 리소스 생성; new (chmod +x)

#### Details
- **Signatures**: `provision.sh [--dry-run] [--yes]`. `--dry-run`은 `DRY_RUN=1`로 설정하고 **네트워크·`az` 호출을 하지 않는다**(읽기 전용 점검 단계도 건너뛰고 내 IP는 `<MY_IP>`로 표시).
- **Execution Flow** (`set -euo pipefail`, `source config.sh lib.sh`):
  1. (dry-run 제외) 구독 가드: `az account show --query name -o tsv`가 `AZ_SUBSCRIPTION_NAME`과 다르면 exit 2. 같으면 `az account set --subscription`.
  2. (dry-run 제외) 사전 점검, 모두 읽기 전용:
     - RG 존재: `az group show -n $AZ_RESOURCE_GROUP`, 없으면 exit 2(이 스크립트는 RG를 만들지 않는다).
     - 이미 존재하는 리소스(`az vm show`, `az network public-ip show`, `az network nsg show`)가 있으면 **수정하지 않고 exit 2**, 어떤 리소스인지와 태그 출력.
     - DNS 이름 가용성: `az rest --method get --url "https://management.azure.com/subscriptions/<sub>/providers/Microsoft.Network/locations/$AZ_LOCATION/CheckDnsNameAvailability?domainNameLabel=$AZ_DNS_LABEL&api-version=2023-09-01" --query available`, `false`면 exit 2(레이블 변경 안내).
     - SKU 제한: `az vm list-skus -l $AZ_LOCATION --size $AZ_VM_SIZE --resource-type virtualMachines --query "[0].restrictions"`가 비어 있지 않으면 exit 2.
     - 쿼터 경고: `az vm list-usage -l $AZ_LOCATION`에서 Basv2 계열(`standardBasv2Family`) 한도가 2 vCPU 미만 남았으면 경고만 출력(실패 처리하지 않음; 이름이 다를 수 있음).
  3. SSH 키: `$SSH_KEY_PATH`가 없으면 `ssh-keygen -t ed25519 -N "" -f "$SSH_KEY_PATH" -C ob-crash-azure`(파일 권한 600 확인). 이미 있으면 재사용.
  4. 계획 출력: 만들 리소스 목록과 월 비용 추정(24시간 약 $14~16, 중지 시 약 $6, 가격 계산기로 재확인 권장 문구), 자동 종료 시각, 열릴 포트.
  5. `--yes`가 없고 dry-run도 아니면 "실행하려면 `--yes`를 붙이세요" 출력 후 exit 0(대화형 프롬프트는 쓰지 않는다 — 결과가 결정적이어야 함).
  6. 실행(`run`으로 감싼 순서대로):
     ```bash
     az vm create -g $AZ_RESOURCE_GROUP -n $AZ_VM_NAME --location $AZ_LOCATION \
       --size $AZ_VM_SIZE --image $AZ_VM_IMAGE --admin-username $AZ_ADMIN_USER \
       --authentication-type ssh --ssh-key-values "${SSH_KEY_PATH}.pub" \
       --os-disk-size-gb $AZ_OS_DISK_GB --storage-sku StandardSSD_LRS \
       --public-ip-address $AZ_PIP_NAME --public-ip-sku Standard \
       --public-ip-address-allocation static --public-ip-address-dns-name $AZ_DNS_LABEL \
       --nsg $AZ_NSG_NAME --nsg-rule NONE \
       --custom-data scripts/azure/cloud-init.yml --tags $AZ_TAG --output json
     az network nsg rule create -g .. --nsg-name $AZ_NSG_NAME -n allow-https --priority 100 --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 443 --source-address-prefixes '*'
     # allow-quic (Udp 443, 110), allow-http (Tcp 80, 120) — 80은 Let's Encrypt HTTP-01 인증과 HTTPS 리다이렉트에 필요
     # allow-ssh (Tcp 22, 130, source <MY_IP>/32)
     az vm auto-shutdown -g .. -n $AZ_VM_NAME --time $AZ_AUTOSHUTDOWN_UTC
     ```
     내 IP는 `curl -fsS https://api.ipify.org`로 얻고 `^[0-9]+(\.[0-9]+){3}$` 정규식으로 검증, 실패하면 22 규칙을 만들지 않고 중단(전체 개방으로 대체하지 않는다).
  7. 완료 후 안내: FQDN, 공용 IP, 다음 단계(`ssh`로 접속해 `cloud-init status --wait` 확인, `build-push.sh`, `deploy.sh`).
- **함정**:
  - `--nsg-rule NONE`을 빼면 `az vm create`가 22번을 **전체 개방**으로 자동 생성한다. 반드시 지정하고 별도 규칙으로 만든다.
  - `az vm create --tags`는 VM뿐 아니라 함께 생성되는 NIC·디스크·IP에도 적용되지만 NSG 규칙은 태그 대상이 아니다. 리소스 삭제 시 태그로 찾도록 가이드에 명시한다.
  - 타임존: `az vm auto-shutdown --time`은 **UTC** 기준이다. KST 24:00 = `1500`.

### I04. VM 운영·내 IP 스크립트
- Related Files:
  - `scripts/azure/vm.sh` :: start/stop/status/ssh; new (chmod +x)
  - `scripts/azure/nsg-myip.sh` :: 22 규칙 갱신; new (chmod +x)

#### Details
- **`vm.sh <start|stop|status|ssh> [--dry-run]`**
  - `start`: `az vm start -g -n`; 이어서 `wait_for_ssh` (dry-run이면 생략).
  - `stop`: **`az vm deallocate -g -n`** (컴퓨트 과금 중지). `az vm stop`은 절대 쓰지 않는다 — 할당이 유지돼 컴퓨트 요금이 계속 청구된다. 실행 전 "공용 IP·디스크 비용(월 약 $6)은 계속 발생" 안내.
  - `status`: `az vm get-instance-view -g -n --query "instanceView.statuses[?starts_with(code,'PowerState/')].displayStatus | [0]" -o tsv`와 FQDN, 공용 IP(`az network public-ip show --query ipAddress`) 출력.
  - `ssh`: `exec ssh $(ssh_opts) "$AZ_ADMIN_USER@$AZ_FQDN"`.
  - 인자 없음/알 수 없는 명령 → usage 출력, exit 64.
- **`nsg-myip.sh [--dry-run]`**: 내 현재 공인 IP를 구해(I03과 같은 검증) `az network nsg rule update -g -nsg-name $AZ_NSG_NAME -n allow-ssh --source-address-prefixes <IP>/32`. 규칙이 없으면 오류 메시지만 내고 만들지 않는다.

### I05. 스크립트 테스트
- Related Files:
  - `tests/azure-scripts.test.ts` :: dry-run 출력·구조 검증; new
  - `tests/azure-deploy-files.test.ts` :: bash -n 대상 목록(P01 I04)이 새 스크립트도 포함; read-only

#### Details
- `spawnSync('bash', ['scripts/azure/provision.sh', '--dry-run'], { env: { ...process.env, AZ: 'az' } })` 결과:
  - exit 0, stdout에 `az vm create`, `--public-ip-sku Standard`, `--public-ip-address-allocation static`, `--nsg-rule NONE`, `project=ob-crash-game`, `--custom-data`, `auto-shutdown`, `--time 1500`이 모두 포함.
  - NSG 규칙 4개(`allow-https`, `allow-quic`, `allow-http`, `allow-ssh`)가 모두 출력되고 `allow-ssh`의 source는 `<MY_IP>/32`이며 `*`가 아니다.
  - dry-run 중 `az`가 실제로 호출되지 않음: `PATH`를 빈 디렉터리 + `bash` 경로만 두고 실행해도 exit 0(= az 없이도 통과).
- `DRY_RUN=1 bash scripts/azure/vm.sh stop` 출력에 `az vm deallocate`가 있고 `az vm stop`은 없다.
- `bash scripts/azure/vm.sh`(인자 없음)는 exit 64.
- `cloud-init.yml` 문자열 검사: 첫 줄 `#cloud-config`, `docker.io`, `docker-compose-v2`, `fallocate -l 2G`, `systemctl`·`enable`·`--now`·`docker`, `/opt/ob-crash/data` 포함.
- `config.sh`: `AZ_FQDN`이 `<DNS_LABEL>.koreacentral.cloudapp.azure.com`, `AZ_AUTOSHUTDOWN_UTC=1500`.

## Acceptance Criteria
- [ ] `provision.sh --dry-run`이 `az`·네트워크 없이 완전한 명령 계획을 출력하고 exit 0이다.
- [ ] `--yes` 없이 `provision.sh`(비 dry-run)를 실행해도 어떤 리소스도 만들지 않는다(구독 가드·사전 점검 후 안내만).
- [ ] 22번 포트가 전체 개방으로 만들어질 경로가 없다(`--nsg-rule NONE` + `<IP>/32`).
- [ ] `vm.sh stop`은 deallocate만 사용한다.
- [ ] 이 Task 실행 중 Azure에 리소스가 생성되지 않았다(`az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game']"` 결과가 비어 있음).

## Validation
- `npx vitest run tests/azure-scripts.test.ts tests/azure-deploy-files.test.ts` — 통과
- `bash scripts/azure/provision.sh --dry-run` — 출력 육안 확인(명령·포트·비용 문구)
- `az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game'].name" -o tsv` — 빈 출력
- `npx tsc --noEmit && npm test` — 전체 통과

## Commit Message
```text
feat(deploy): Azure VM 프로비저닝·운영 스크립트와 cloud-init

Plan: 2026-11-09-azure-vm-deployment
Phase: P02-azure-infra-scripts
Task: T01-provision-and-vm-ops

- I01: Azure 변수(config.sh)와 dry-run·ssh 공용 함수(lib.sh)
- I02: cloud-init(Docker, 스왑 2GB, /opt/ob-crash)
- I03: provision.sh(구독 가드, 사전 점검, --yes 전에는 계획만, NSG, 자동 종료)
- I04: vm.sh(start/stop=deallocate/status/ssh)와 nsg-myip.sh
- I05: dry-run 출력·cloud-init·config 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
