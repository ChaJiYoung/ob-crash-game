# Phase: P01 오라클 Always Free VM 배포 구축 (oracle-deployment)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | `ConnectionGuard`(IP 판별·Origin·IP당/전체 상한) + `wsServer`/`index.ts` 연결 + PC·폰 SERVER_FULL 배너 + 테스트 | [T01](./T01-connection-guard-and-server-full-banner.md) |
| T02 | `done ✅` | Dockerfile(백엔드/프론트)·Caddyfile·docker-compose.yml·.env.example·.dockerignore·.gitignore + `scripts/deploy-smoke.mjs` 로컬 기동 검증 | [T02](./T02-docker-caddy-and-smoke-test.md) |
| T03 | `done ✅` | `docs/오라클_클라우드_무료_배포_가이드.md`(인스턴스·방화벽·DuckDNS 크론·Docker·검증·재시작·백업·FAQ·CI 부록) + README 문서 맵·실행 방법 갱신 | [T03](./T03-oracle-deployment-runbook.md) |

## Progress
- done: 3/3 (모든 task 완료)
