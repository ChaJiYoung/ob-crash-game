#!/usr/bin/env bash
# 로컬에서 linux/amd64 이미지를 빌드해 GHCR 에 올린다. VM 에서는 빌드하지 않는다.
# 사용: build-push.sh [--tag TAG] [--no-push] [--allow-dirty]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/config.sh"
cd "${SCRIPT_DIR}/../.."

TAG=""
NO_PUSH=0
ALLOW_DIRTY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --no-push) NO_PUSH=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 64 ;;
  esac
done

log() { echo "[build-push] $*" >&2; }
die() { echo "[build-push] 오류: $1" >&2; exit "${2:-1}"; }

[ -n "${TAG}" ] || TAG="$(git rev-parse --short HEAD)"

# 작업 트리가 더러우면 재현할 수 없는 이미지가 된다.
PUSH_LATEST=1
if [ -n "$(git status --porcelain)" ]; then
  [ "${ALLOW_DIRTY}" -eq 1 ] || die "커밋되지 않은 변경이 있습니다. 커밋하거나 --allow-dirty 를 붙이세요." 2
  case "${TAG}" in *-dirty) ;; *) TAG="${TAG}-dirty" ;; esac
  PUSH_LATEST=0
  log "작업 트리가 더럽습니다 → 태그 ${TAG}, latest 는 만들지 않습니다."
fi

docker info >/dev/null 2>&1 || die "Docker 데몬에 연결할 수 없습니다. Docker 를 실행하세요." 2

build_one() { # $1=이미지 전체 이름, $2=Dockerfile
  local image="$1" dockerfile="$2"
  local tags=(-t "${image}:${TAG}")
  [ "${PUSH_LATEST}" -eq 1 ] && tags+=(-t "${image}:latest")
  log "빌드: ${image}:${TAG} (linux/amd64, ${dockerfile})"
  docker build --platform linux/amd64 -f "${dockerfile}" "${tags[@]}" . >&2
  local arch
  arch="$(docker image inspect --format '{{.Architecture}}' "${image}:${TAG}")"
  [ "${arch}" = "amd64" ] || die "${image}:${TAG} 아키텍처가 ${arch} 입니다 (amd64 여야 함)." 2
}

build_one "${IMAGE_BACKEND}" Dockerfile.backend
build_one "${IMAGE_WEB}" Dockerfile.frontend

if [ "${NO_PUSH}" -eq 1 ]; then
  log "--no-push: 빌드만 하고 종료합니다. 태그: ${TAG}"
  echo "${TAG}"
  exit 0
fi

log "GHCR 로그인 (${GHCR_USER})"
if ! gh auth token 2>/dev/null | docker login ghcr.io -u "${GHCR_USER}" --password-stdin >/dev/null 2>&1; then
  die "GHCR 로그인에 실패했습니다. 터미널에서 '! gh auth refresh -s write:packages' 를 실행하고, 활성 계정이 ${GHCR_USER} 인지 확인하세요." 3
fi

push_one() { # $1=이미지 전체 이름
  local image="$1"
  log "push: ${image}:${TAG}"
  docker push "${image}:${TAG}" >&2
  if [ "${PUSH_LATEST}" -eq 1 ]; then
    log "push: ${image}:latest"
    docker push "${image}:latest" >&2
  fi
}
push_one "${IMAGE_BACKEND}"
push_one "${IMAGE_WEB}"

cat >&2 <<MSG

[build-push] 완료. 태그: ${TAG}
[build-push] 처음 올린 패키지는 기본이 비공개라 VM 이 pull 할 수 없습니다. 최초 1회만 GitHub 에서
  두 패키지(${IMAGE_BACKEND_NAME}, ${IMAGE_WEB_NAME})를 Public 으로 바꾸세요:
  GitHub → 프로필 → Packages → 패키지 → Package settings → Change visibility → Public
MSG
echo "${TAG}"
