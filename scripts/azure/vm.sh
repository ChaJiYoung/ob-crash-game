#!/usr/bin/env bash
# VM 켜기/끄기/상태/접속.
# 사용: vm.sh <start|stop|status|ssh|autoshutdown> [--dry-run]
#   autoshutdown off        자동 종료를 끈다 (계속 켜 둘 때)
#   autoshutdown HH:MM      매일 이 시각(한국 시각, KST)에 자동 종료한다 (예: 23:30)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"
require_azure_config
SUBARG=(--subscription "${AZ_SUBSCRIPTION_ID}")

CMD="${1:-}"
[ -n "${CMD}" ] || { echo "사용: vm.sh <start|stop|status|ssh|autoshutdown> [--dry-run]" >&2; exit 64; }
shift || true
ARG=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "알 수 없는 옵션: $a" >&2; exit 64 ;;
    *) ARG="$a" ;;
  esac
done

case "${CMD}" in
  start)
    run "${AZ}" vm start "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}"
    if [ "${DRY_RUN}" != "1" ]; then
      wait_for_ssh
      log "VM 이 켜졌습니다: https://${AZ_FQDN}"
    fi
    ;;
  stop)
    # 'az vm stop' 은 쓰지 않는다: 할당이 유지되어 컴퓨트 요금이 계속 청구된다. deallocate 만 과금을 멈춘다.
    run "${AZ}" vm deallocate "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}"
    [ "${DRY_RUN}" = "1" ] || log "중지(deallocate) 요청 완료. 공용 IP·디스크 비용(월 약 \$6)은 계속 발생합니다."
    ;;
  status)
    state="$("${AZ}" vm get-instance-view "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --query "instanceView.statuses[?starts_with(code,'PowerState/')].displayStatus | [0]" -o tsv)"
    ip="$("${AZ}" network public-ip show "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_PIP_NAME}" --query ipAddress -o tsv)"
    echo "PowerState: ${state}"
    echo "FQDN: ${AZ_FQDN}"
    echo "IP: ${ip}"
    sched="$("${AZ}" resource show "${SUBARG[@]}" --api-version 2018-09-15 \
      --ids "/subscriptions/${AZ_SUBSCRIPTION_ID}/resourceGroups/${AZ_RESOURCE_GROUP}/providers/microsoft.devtestlab/schedules/shutdown-computevm-${AZ_VM_NAME}" \
      --query "join(' ', [properties.status, properties.dailyRecurrence.time])" -o tsv 2>/dev/null || true)"
    case "${sched}" in
      Enabled*) echo "AutoShutdown: ${sched#Enabled } UTC 에 매일 종료 (KST = UTC+9)" ;;
      Disabled*) echo "AutoShutdown: 꺼짐 (계속 켜 둠 — 과금 중이니 안 쓰면 vm.sh stop)" ;;
      *) echo "AutoShutdown: 꺼짐 (스케줄 없음 — 계속 켜 둠. 안 쓰면 vm.sh stop)" ;;
    esac
    ;;
  autoshutdown)
    case "${ARG}" in
      off)
        run "${AZ}" vm auto-shutdown "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --off
        [ "${DRY_RUN}" = "1" ] || log "자동 종료를 껐습니다. VM 이 계속 켜져 과금됩니다(월 약 \$14.6). 안 쓸 때는 vm.sh stop."
        ;;
      *)
        echo "${ARG}" | grep -Eq '^([01][0-9]|2[0-3]):[0-5][0-9]$' || { echo "사용: vm.sh autoshutdown <off|HH:MM(한국 시각)>" >&2; exit 64; }
        kst_h="${ARG%%:*}"; kst_m="${ARG##*:}"
        utc="$(printf '%02d%s' $(( (10#${kst_h} + 15) % 24 )) "${kst_m}")"   # KST -> UTC: -9시간 == +15시간 (mod 24)
        run "${AZ}" vm auto-shutdown "${SUBARG[@]}" -g "${AZ_RESOURCE_GROUP}" -n "${AZ_VM_NAME}" --time "${utc}"
        [ "${DRY_RUN}" = "1" ] || log "매일 한국 시각 ${ARG} (UTC ${utc}) 에 자동 종료합니다."
        ;;
    esac
    ;;
  ssh)
    exec ssh "${SSH_OPTS[@]}" "${AZ_ADMIN_USER}@${AZ_FQDN}"
    ;;
  *)
    echo "알 수 없는 명령: ${CMD}  (start|stop|status|ssh|autoshutdown)" >&2
    exit 64
    ;;
esac
