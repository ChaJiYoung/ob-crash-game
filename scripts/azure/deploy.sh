#!/usr/bin/env bash
# 이미지 빌드·push → VM 시작 → compose 전달 → pull/up → 헬스 대기 → 스모크.
# 롤백: deploy.sh --skip-build --tag <이전 해시>
# 사용: deploy.sh [--tag TAG] [--skip-build] [--allow-dirty] [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

TAG=""
SKIP_BUILD=0
ALLOW_DIRTY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 64 ;;
  esac
done

DRY_FLAG=""
[ "${DRY_RUN}" = "1" ] && DRY_FLAG="--dry-run"

if [ "${SKIP_BUILD}" -eq 1 ]; then
  [ -n "${TAG}" ] || TAG="latest"
else
  [ -n "${TAG}" ] || TAG="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
fi

# 1. 빌드·push (VM 갱신에는 latest 가 아니라 이 해시 태그를 쓴다)
if [ "${SKIP_BUILD}" -eq 0 ]; then
  BUILD_ARGS=(--tag "${TAG}")
  [ "${ALLOW_DIRTY}" -eq 1 ] && BUILD_ARGS+=(--allow-dirty)
  if [ "${DRY_RUN}" = "1" ]; then
    echo "[dry-run] ${SCRIPT_DIR}/build-push.sh ${BUILD_ARGS[*]}"
  else
    # build-push.sh 는 마지막 줄에 최종 태그(-dirty 접미사 포함 가능)를 출력한다.
    TAG="$("${SCRIPT_DIR}/build-push.sh" "${BUILD_ARGS[@]}" | tail -n 1)"
  fi
fi
log "배포 태그: ${TAG}"

# 2. VM 시작 (이미 켜져 있어도 무해)
"${SCRIPT_DIR}/vm.sh" start ${DRY_FLAG}

# 3. 첫 부팅 설정(cloud-init)이 끝났는지 확인: 끝나기 전에는 /opt/ob-crash 가 없을 수 있다.
remote "cloud-init status --wait >/dev/null 2>&1 || true"

# 4. 이전 태그 (롤백 안내용)
PREV_TAG="(없음)"
if [ "${DRY_RUN}" != "1" ]; then
  PREV_TAG="$(remote "grep '^IMAGE_TAG=' ${REMOTE_DIR}/.env 2>/dev/null | cut -d= -f2" || true)"
  [ -n "${PREV_TAG}" ] || PREV_TAG="(없음)"
fi

# 5. compose 와 .env 전달 (.env 에는 비밀값이 없다)
scp_to "${ROOT_DIR}/deploy/azure/docker-compose.yml" "${REMOTE_DIR}/docker-compose.yml"
{
  printf 'DOMAIN=%s\nIMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' "${AZ_FQDN}" "${IMAGE_PREFIX}" "${TAG}"
  if [ -n "${EXTRA_ENV:-}" ]; then printf '%s\n' "${EXTRA_ENV}"; fi
} | remote "cat > ${REMOTE_DIR}/.env"

# 6. 이미지 받기 → 기동
if [ "${DRY_RUN}" = "1" ]; then
  remote "cd ${REMOTE_DIR} && docker compose pull"
else
  if ! PULL_OUT="$(remote "cd ${REMOTE_DIR} && docker compose pull 2>&1")"; then
    echo "${PULL_OUT}" >&2
    if echo "${PULL_OUT}" | grep -qiE 'denied|unauthorized'; then
      cat >&2 <<MSG
[azure] 이미지를 받지 못했습니다(denied/unauthorized). GHCR 패키지가 비공개일 가능성이 큽니다.
  GitHub → 프로필 → Packages → ${IMAGE_BACKEND_NAME}, ${IMAGE_WEB_NAME} 각각 Package settings → Change visibility → Public
MSG
      exit 3
    fi
    die "docker compose pull 이 실패했습니다." 6
  fi
fi
remote "cd ${REMOTE_DIR} && docker compose up -d"
remote "docker image prune -f >/dev/null"

# 7. 헬스 대기 (첫 배포에서는 Let's Encrypt 인증서 발급 때문에 늦을 수 있다)
if [ "${DRY_RUN}" = "1" ]; then
  echo "[dry-run] curl -fsS https://${AZ_FQDN}/health (최대 120초, 첫 배포는 300초, 5초 간격)"
else
  ok=0
  tries=24                                   # 24 x 5초 = 120초
  [ "${PREV_TAG}" = "(없음)" ] && tries=60   # 첫 배포: 이미지 pull + 인증서 발급 + 1GB RAM 이라 300초까지 기다린다
  for _ in $(seq 1 "${tries}"); do
    if curl -fsS --max-time 5 "https://${AZ_FQDN}/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 5
  done
  if [ "${ok}" -ne 1 ]; then
    log "/health 가 제때 응답하지 않았습니다. web 로그:"
    remote "cd ${REMOTE_DIR} && docker compose logs --tail 50 web" >&2 || true
    exit 4
  fi
fi

# 8. 스모크
if [ "${DRY_RUN}" = "1" ]; then
  echo "[dry-run] node ${ROOT_DIR}/scripts/deploy-smoke.mjs https://${AZ_FQDN}"
else
  node "${ROOT_DIR}/scripts/deploy-smoke.mjs" "https://${AZ_FQDN}" || { log "스모크 점검이 실패했습니다."; exit 5; }
fi

if [ "${DRY_RUN}" = "1" ]; then
  log "dry-run: 아무것도 실행하지 않았습니다."
  exit 0
fi
{
  echo
  echo "[azure] 배포 완료: https://${AZ_FQDN}   (태그 ${TAG}, 이전 태그 ${PREV_TAG})"
  if [ "${PREV_TAG}" != "(없음)" ]; then
    echo "  롤백: scripts/azure/deploy.sh --skip-build --tag ${PREV_TAG}"
  fi
  echo "  안 쓸 때는 과금을 멈추세요: scripts/azure/vm.sh stop   (자동 종료: 매일 한국 시각 24:00)"
} >&2
