#!/usr/bin/env bash
# 22번(SSH) 규칙의 허용 IP 를 내 현재 공인 IP 로 갱신한다. 규칙이 없으면 만들지 않고 알린다.
# 사용: nsg-myip.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "알 수 없는 옵션: $a" >&2; exit 64 ;;
  esac
done

if [ "${DRY_RUN}" = "1" ]; then
  IP="<MY_IP>"
else
  "${AZ}" network nsg rule show -g "${AZ_RESOURCE_GROUP}" --nsg-name "${AZ_NSG_NAME}" -n allow-ssh >/dev/null 2>&1 \
    || die "allow-ssh 규칙이 없습니다. provision.sh 로 먼저 만드세요 (여기서는 새로 만들지 않습니다)." 2
  IP="$(my_ip)"
fi

run "${AZ}" network nsg rule update -g "${AZ_RESOURCE_GROUP}" --nsg-name "${AZ_NSG_NAME}" \
  -n allow-ssh --source-address-prefixes "${IP}/32"
[ "${DRY_RUN}" = "1" ] || log "22번 포트 허용 IP 를 ${IP}/32 로 설정했습니다."
