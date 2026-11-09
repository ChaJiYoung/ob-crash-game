# Azure 배포 스크립트 공통 설정 (source 전용). bash 3.2(macOS 기본)에서도 동작해야 한다.
# 값을 바꾸려면 scripts/azure/config.local.sh (gitignored)에서 덮어쓴다.

# --- 이미지 (GHCR은 소문자 필수) ---
IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/chajiyoung}"
IMAGE_BACKEND_NAME="ob-crash-backend"
IMAGE_WEB_NAME="ob-crash-web"
IMAGE_BACKEND="${IMAGE_PREFIX}/${IMAGE_BACKEND_NAME}"
IMAGE_WEB="${IMAGE_PREFIX}/${IMAGE_WEB_NAME}"
GHCR_USER="${GHCR_USER:-ChaJiYoung}"

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
unset _cfg_dir
