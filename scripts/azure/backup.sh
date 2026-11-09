#!/usr/bin/env bash
# SQLite 온라인 백업(WAL 안전)을 VM 에서 만들어 내 PC 로 내려받는다. game.db 파일을 그냥 복사하지 않는다.
# 사용: backup.sh [--out DIR] [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

OUT="${ROOT_DIR}/backups"
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 64 ;;
  esac
done

# 1. VM 이 꺼져 있으면 임의로 켜지 않는다.
if [ "${DRY_RUN}" != "1" ]; then
  state="$("${SCRIPT_DIR}/vm.sh" status | grep '^PowerState:' || true)"
  case "${state}" in
    *"VM running"*) ;;
    *) die "VM 이 실행 중이 아닙니다 (${state:-상태 확인 실패}). 먼저 scripts/azure/vm.sh start 를 실행하세요." 2 ;;
  esac
fi

STAMP="$(date +%Y%m%d%H%M%S)"
FILE="backup-${STAMP}.db"

# 2. 원격 온라인 백업: better-sqlite3 의 backup() API. (node -e 의 require 는 "type":"module" 프로젝트에서도 동작함을 확인)
JS="const D=require('better-sqlite3');const db=new D('data/game.db');db.backup('data/backup-'+process.argv[1]+'.db').then(()=>{db.close();console.log('ok')}).catch(e=>{console.error(e);process.exit(1)})"
remote "cd ${REMOTE_DIR} && docker compose exec -T backend node -e \"${JS}\" ${STAMP}"

# 3. 내려받기
run mkdir -p "${OUT}"
scp_from "${REMOTE_DIR}/data/${FILE}" "${OUT}/${FILE}"

# 4. 무결성 확인
if [ "${DRY_RUN}" != "1" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    result="$(sqlite3 "${OUT}/${FILE}" 'PRAGMA integrity_check')"
    [ "${result}" = "ok" ] || die "백업 파일 무결성 검사 실패: ${result}" 5
    log "무결성 검사 ok"
  else
    [ -s "${OUT}/${FILE}" ] || die "백업 파일이 비어 있습니다." 5
    log "sqlite3 가 없어 파일 크기만 확인했습니다."
  fi
  log "백업 저장: ${OUT}/${FILE}"
fi

# 5. 7일이 지난 원격 백업만 정리
remote "find ${REMOTE_DIR}/data -name 'backup-*.db' -mtime +7 -delete"
