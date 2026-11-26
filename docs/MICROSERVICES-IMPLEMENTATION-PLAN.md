# Microservices implementation plan

Goal: finish the five approved architecture stages, personally, without agents,
containers, OS changes or a new one-command launcher.

Architecture: planning, missions, telemetry and Webots gateway are independent
processes. Only the gateway uses the simulator exchange directory. Missions own
a private durable repository. Inter-service HTTP uses versioned envelopes,
bounded requests, stable command IDs and explicit transient failures.

## 1. Gateway and network ports
- [x] Add gateway HTTP server, composition root and entrypoint; existing file
  adapters become gateway implementation details.
- [x] Add bounded HTTP client with validation, timeouts and retry using the same ID.
- [x] Replace route/telemetry filesystem dependencies with network adapters.
- [x] Test version rejection, lost replies, replay and gateway restart.

## 2. Mission lifecycle
- [x] Repository listing and exclusive process ownership, private default directory.
- [x] Background reconciliation, retry prepared delivery after restart, retain
  last known state with explicit feedback freshness and connectivity.
- [x] One active mission; reject implicit replacement. Durable cancellation
  intent and controller acknowledgement before allowing a new mission.
- [x] Add controller cancellation contract and regression tests.

## 3. Client and diagnostics
- [x] Expose mission history/cancel API, UI cancellation and tracking restoration.
- [x] Independent service URLs, readiness and structured failure responses.
- [x] Keep existing bridge entrypoint compatible with the additional gateway.

## 4. Verification
- [x] Tests for lifecycle, boundaries, restart, unavailable gateway and idempotency.
- [x] Four-process smoke with separate mission/gateway directories and telemetry.
- [x] Full JS suite, lint/build, C tests and warning-free Webots compilation.
- [x] Actual isolated Webots execution if available; distinguish simulated
  feedback tests from physical simulator evidence.

## 5. Documentation
- [x] Update architecture/API contracts, startup instructions and limitations.
- [x] Review requirements against implementation; do not claim distributed HA
  or unlimited scaling for a single-robot service topology.

Completed and reviewed 2026-09-12. Verification: 93 JS test files / 243 tests,
lint and production build, four-process restart/failure/telemetry smoke, 85 unique
C test programs across the initial run and corrected remaining-test run.
Real Webots completed a route and confirmed cancellation; post-stop displacement
was 0.000065 m over one second. Browser plan/send, reload restoration and cancel
states were checked separately. See MODULAR-ARCHITECTURE.md for startup and scope.
