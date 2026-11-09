# Azure 배포 스크립트 공통 설정 (source 전용). bash 3.2(macOS 기본)에서도 동작해야 한다.
# 값을 바꾸려면 scripts/azure/config.local.sh (gitignored)에서 덮어쓴다.

# --- 이미지 (GHCR은 소문자 필수) ---
IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/chajiyoung}"
IMAGE_BACKEND_NAME="ob-crash-backend"
IMAGE_WEB_NAME="ob-crash-web"
IMAGE_BACKEND="${IMAGE_PREFIX}/${IMAGE_BACKEND_NAME}"
IMAGE_WEB="${IMAGE_PREFIX}/${IMAGE_WEB_NAME}"
GHCR_USER="${GHCR_USER:-ChaJiYoung}"

# --- Azure ---
AZ="${AZ:-az}"
AZ_SUBSCRIPTION_NAME="<SUBSCRIPTION_NAME>"
AZ_RESOURCE_GROUP="<RESOURCE_GROUP>"            # 팀 공용 그룹: 우리 리소스는 ob-crash- 접두사 + project 태그로 구분
AZ_LOCATION="koreacentral"
AZ_VM_NAME="ob-crash-vm"
AZ_VM_SIZE="Standard_B2ats_v2"
AZ_VM_IMAGE="Canonical:ubuntu-24_04-lts:server:latest"
AZ_ADMIN_USER="azureuser"                   # cloud-init.yml 의 사용자 이름과 같아야 한다
AZ_OS_DISK_GB="30"
AZ_PIP_NAME="ob-crash-pip"
AZ_NSG_NAME="ob-crash-nsg"
AZ_DNS_LABEL="${AZ_DNS_LABEL:-<DNS_LABEL>}"
AZ_TAG="project=ob-crash-game"
AZ_AUTOSHUTDOWN_UTC="1500"                  # az vm auto-shutdown 은 UTC 기준: KST 24:00 = 15:00
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/ob-crash-azure}"

# --- VM 안의 경로 ---
REMOTE_DIR="/opt/ob-crash"

_cfg_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${_cfg_dir}/config.local.sh" ]; then
  # shellcheck disable=SC1091
  . "${_cfg_dir}/config.local.sh"
  # 로컬 설정이 IMAGE_PREFIX 를 바꿨다면 파생값도 다시 만든다.
  IMAGE_BACKEND="${IMAGE_PREFIX}/${IMAGE_BACKEND_NAME}"
  IMAGE_WEB="${IMAGE_PREFIX}/${IMAGE_WEB_NAME}"
fi
AZ_FQDN="${AZ_DNS_LABEL}.${AZ_LOCATION}.cloudapp.azure.com"
unset _cfg_dir
