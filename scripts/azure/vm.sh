#!/usr/bin/env bash
# VM 켜기/끄기/상태/접속.
# 사용: vm.sh <start|stop|status|ssh> [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

CMD="${1:-}"
[ -n "${CMD}" ] || { echo "사용: vm.sh <start|stop|status|ssh> [--dry-run]" >&2; exit 64; }
shift || true
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "알 수 없는 옵션: $a" >&2; exit 64 ;;
  esac
done

case "${CMD}" in
  start)
    run "${AZ}" vm start -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}"
    if [ "${DRY_RUN}" != "1" ]; then
      wait_for_ssh
      log "VM 이 켜졌습니다: https://${AZ_FQDN}"
    fi
    ;;
  stop)
    # 'az vm stop' 은 쓰지 않는다: 할당이 유지되어 컴퓨트 요금이 계속 청구된다. deallocate 만 과금을 멈춘다.
    run "${AZ}" vm deallocate -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}"
    [ "${DRY_RUN}" = "1" ] || log "중지(deallocate) 요청 완료. 공용 IP·디스크 비용(월 약 \$6)은 계속 발생합니다."
    ;;
  status)
    state="$("${AZ}" vm get-instance-view -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --query "instanceView.statuses[?starts_with(code,'PowerState/')].displayStatus | [0]" -o tsv)"
    ip="$("${AZ}" network public-ip show -g "${AZ_RESOURCE_GROUP}" -n "${AZ_PIP_NAME}" --query ipAddress -o tsv)"
    echo "PowerState: ${state}"
    echo "FQDN: ${AZ_FQDN}"
    echo "IP: ${ip}"
    ;;
  ssh)
    exec ssh "${SSH_OPTS[@]}" "${AZ_ADMIN_USER}@${AZ_FQDN}"
    ;;
  *)
    echo "알 수 없는 명령: ${CMD}  (start|stop|status|ssh)" >&2
    exit 64
    ;;
esac
