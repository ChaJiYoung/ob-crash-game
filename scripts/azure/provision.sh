#!/usr/bin/env bash
# <RESOURCE_GROUP> 리소스그룹에 VM·고정 공용 IP(DNS 이름)·NSG·자동 종료를 만든다.
# 기본은 점검 후 계획만 출력한다. 실제 생성은 --yes 를 붙였을 때만 한다.
# 사용: provision.sh [--dry-run] [--yes]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 64 ;;
  esac
done

if [ "${DRY_RUN}" = "1" ]; then
  MY_IP="<MY_IP>"   # dry-run 은 네트워크·az 를 호출하지 않는다
else
  # 1. 구독 가드: 잘못된 구독에 만드는 사고를 막는다.
  current_sub="$("${AZ}" account show --query name -o tsv)"
  [ "${current_sub}" = "${AZ_SUBSCRIPTION_NAME}" ] || die "현재 구독이 '${current_sub}' 입니다. '${AZ_SUBSCRIPTION_NAME}' 이어야 합니다 (az account set --subscription)." 2
  SUB_ID="$("${AZ}" account show --query id -o tsv)"

  # 2. 사전 점검 (모두 읽기 전용)
  "${AZ}" group show -n "${AZ_RESOURCE_GROUP}" >/dev/null 2>&1 || die "리소스그룹 '${AZ_RESOURCE_GROUP}' 이 없습니다. 이 스크립트는 그룹을 만들지 않습니다." 2

  if "${AZ}" vm show -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" >/dev/null 2>&1; then
    die "VM '${AZ_VM_NAME}' 이 이미 있습니다. 수정하지 않고 중단합니다." 2
  fi
  if "${AZ}" network public-ip show -g "${AZ_RESOURCE_GROUP}" -n "${AZ_PIP_NAME}" >/dev/null 2>&1; then
    die "공용 IP '${AZ_PIP_NAME}' 이 이미 있습니다. 수정하지 않고 중단합니다." 2
  fi
  if "${AZ}" network nsg show -g "${AZ_RESOURCE_GROUP}" -n "${AZ_NSG_NAME}" >/dev/null 2>&1; then
    die "NSG '${AZ_NSG_NAME}' 이 이미 있습니다. 수정하지 않고 중단합니다." 2
  fi

  available="$("${AZ}" rest --method get --url "https://management.azure.com/subscriptions/${SUB_ID}/providers/Microsoft.Network/locations/${AZ_LOCATION}/CheckDnsNameAvailability?domainNameLabel=${AZ_DNS_LABEL}&api-version=2023-09-01" --query available -o tsv)"
  [ "${available}" = "true" ] || die "DNS 이름 '${AZ_DNS_LABEL}' 을 쓸 수 없습니다. config.local.sh 에서 AZ_DNS_LABEL 을 바꾸세요." 2

  restrictions="$("${AZ}" vm list-skus -l "${AZ_LOCATION}" --size "${AZ_VM_SIZE}" --resource-type virtualMachines --query "[0].restrictions | length(@)" -o tsv 2>/dev/null || echo "?")"
  [ "${restrictions}" = "0" ] || die "${AZ_VM_SIZE} 를 ${AZ_LOCATION} 에서 쓸 수 없거나 확인하지 못했습니다 (restrictions=${restrictions})." 2

  # 쿼터는 이름이 달라질 수 있어 경고만 한다.
  quota="$("${AZ}" vm list-usage -l "${AZ_LOCATION}" --query "[?name.value=='standardBasv2Family'] | [0].[currentValue,limit]" -o tsv 2>/dev/null || true)"
  log "Basv2 vCPU 쿼터(현재 사용 / 한도): ${quota:-확인 못 함}"

  # 3. 내 공인 IP (22번 규칙용)
  MY_IP="$(my_ip)"
fi

# 4. 계획 출력
cat >&2 <<PLAN

[azure] ===== 만들 리소스 (${AZ_RESOURCE_GROUP}, ${AZ_LOCATION}) =====
  VM          ${AZ_VM_NAME}  ${AZ_VM_SIZE}  Ubuntu 24.04  OS 디스크 ${AZ_OS_DISK_GB}GB Standard SSD
  공용 IP     ${AZ_PIP_NAME}  Standard 고정, DNS 이름 ${AZ_FQDN}
  NSG         ${AZ_NSG_NAME}  443/tcp, 443/udp, 80/tcp = 전체 허용, 22/tcp = ${MY_IP}/32 만 허용
  자동 종료   매일 UTC ${AZ_AUTOSHUTDOWN_UTC} (한국 시각 24:00)
  태그        ${AZ_TAG}
  SSH 키      ${SSH_KEY_PATH} ($( [ -f "${SSH_KEY_PATH}" ] && echo "기존 키 사용" || echo "없으면 새로 생성: ed25519, 비밀번호 없음" ))
[azure] ===== 비용 (Korea Central 공개 단가 기준, 730시간/월 환산) =====
  24시간 가동 약 \$14.6/월, 중지(deallocate) 시 약 \$6.05/월 (공용 IP + 디스크는 계속 청구)
PLAN

if [ "${DRY_RUN}" != "1" ] && [ "${YES}" -ne 1 ]; then
  log "계획만 출력했습니다. 실제로 만들려면 --yes 를 붙여 다시 실행하세요."
  exit 0
fi

# 5. 실행 (여기부터 로컬 SSH 키 생성과 Azure 리소스 생성이 일어난다)
if [ ! -f "${SSH_KEY_PATH}" ]; then
  log "SSH 키를 새로 만듭니다: ${SSH_KEY_PATH}"
  run ssh-keygen -t ed25519 -N "" -f "${SSH_KEY_PATH}" -C ob-crash-azure
fi

run "${AZ}" vm create -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --location "${AZ_LOCATION}" \
  --size "${AZ_VM_SIZE}" --image "${AZ_VM_IMAGE}" --admin-username "${AZ_ADMIN_USER}" \
  --authentication-type ssh --ssh-key-values "${SSH_KEY_PATH}.pub" \
  --os-disk-size-gb "${AZ_OS_DISK_GB}" --storage-sku StandardSSD_LRS \
  --public-ip-address "${AZ_PIP_NAME}" --public-ip-sku Standard \
  --public-ip-address-allocation static --public-ip-address-dns-name "${AZ_DNS_LABEL}" \
  --nsg "${AZ_NSG_NAME}" --nsg-rule NONE \
  --custom-data "${SCRIPT_DIR}/cloud-init.yml" --tags "${AZ_TAG}" --output json

nsg_rule() { # $1=이름 $2=우선순위 $3=프로토콜 $4=포트 $5=원본
  run "${AZ}" network nsg rule create -g "${AZ_RESOURCE_GROUP}" --nsg-name "${AZ_NSG_NAME}" \
    -n "$1" --priority "$2" --access Allow --protocol "$3" --direction Inbound \
    --destination-port-ranges "$4" --source-address-prefixes "$5"
}
nsg_rule allow-https 100 Tcp 443 '*'
nsg_rule allow-quic 110 Udp 443 '*'
nsg_rule allow-http 120 Tcp 80 '*'     # Let's Encrypt HTTP-01 인증과 HTTPS 리다이렉트에 필요
nsg_rule allow-ssh 130 Tcp 22 "${MY_IP}/32"

run "${AZ}" vm auto-shutdown -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --time "${AZ_AUTOSHUTDOWN_UTC}"

if [ "${DRY_RUN}" = "1" ]; then
  log "dry-run: 아무것도 만들지 않았습니다."
else
  cat >&2 <<DONE

[azure] 완료. 주소: https://${AZ_FQDN}
  다음: vm.sh ssh 로 접속해 'cloud-init status --wait' 가 done 인지 확인 → build-push.sh → deploy.sh
DONE
fi
