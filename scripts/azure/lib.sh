# Azure 스크립트 공용 함수 (source 전용). config.sh 를 먼저 source 해야 한다.
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[azure] $*" >&2; }
die() { echo "[azure] 오류: $1" >&2; exit "${2:-1}"; }

# DRY_RUN=1 이면 실행하지 않고 명령만 출력한다.
run() {
  if [ "${DRY_RUN}" = "1" ]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

SSH_OPTS=(-i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=15)

ssh_run() { ssh "${SSH_OPTS[@]}" "${AZ_ADMIN_USER}@${AZ_FQDN}" "$@"; }

# 켠 직후에는 SSH 가 아직 안 열려 있을 수 있어 최대 180초 기다린다.
wait_for_ssh() {
  local i
  for i in $(seq 1 36); do
    if ssh_run true 2>/dev/null; then return 0; fi
    sleep 5
  done
  die "180초 동안 SSH 에 접속하지 못했습니다. VM 상태와 22번 규칙(내 IP)을 확인하세요: vm.sh status, nsg-myip.sh" 4
}

# 현재 공인 IP. 형식이 이상하면 실패한다 (22번 규칙을 전체 개방으로 대체하지 않기 위함).
my_ip() {
  local ip
  ip="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  if ! echo "${ip}" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
    die "공인 IP 를 확인하지 못했습니다 (받은 값: '${ip}')." 2
  fi
  echo "${ip}"
}
