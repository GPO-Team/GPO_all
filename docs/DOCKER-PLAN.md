# Final deployment stage

Approved design: four independent Linux containers (frontend, planning, route,
telemetry), with the gateway and graphical Webots on Windows. One foreground
launcher owns the processes it starts and stops Compose without deleting volumes.

- [x] Replace legacy combined bridge Compose service; isolated persistent mission volume, secret file, health checks, bounded logs.
- [x] Fix production frontend build inputs and verify actual image builds.
- [x] Add Windows launcher with prerequisite checks, generated persistent token, controller build, readiness, cleanup and duplicate-start protection.
- [x] Exercise container planning, persisted missions, restart, telemetry and real Webots completion/cancellation.
- [x] Document startup, shutdown, data migration and deployment limitations; run checks and push.

Implementation and review are performed personally, without subagents.

## Verification — 2026-09-16

- 99 test files / 254 tests passed; ESLint passed.
- Production images built locally with Docker Desktop Linux Engine.
- `node scripts/docker-smoke-test.mjs --no-build`: passed, including SIGKILL recovery and duplicate-launch refusal.
- `node scripts/docker-smoke-test.mjs --physics`: passed using real Windows Webots, including route completion and post-cancellation movement below 0.05 m.
- Graphical launcher startup and shutdown passed; production dashboard displayed camera and connected telemetry/route/solver with zero browser console errors/warnings.
- Linux CI including Docker integration passed: https://github.com/Vanchoys228/GPO_all/actions/runs/35049638788 (code commit 625a455).
- Test containers, simulator processes and disposable test volumes were cleaned up; production mission volumes were not removed.
