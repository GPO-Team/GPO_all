# Modular architecture implementation plan

Goal: separate domain calculations, application services and infrastructure without changing the supported local launch workflow.
Architecture: shared pure planning library; planning and mission application services; injected native/Webots/storage adapters; HTTP/WebSocket delivery and composition roots. Keep legacy entry points as compatibility facades. No OS or container changes. Execute personally, no subagents, no commits of unrelated existing changes.

- [x] 1. Extract pure planning modules to shared/planning with explicit .js imports; retain src export facades. Add Node import and dependency-boundary regression tests, run red then existing geometry/energy tests.
- [x] 2. Add scene validation and full route planning/replanning use cases to bridge/services/planning-service.cjs. HTTP accepts scene snapshots; UI uses server final result while keeping local preview. Tests: full energy failure, scene validation, endpoint response and cancellation.
- [x] 3. Introduce bridge/adapters/webots-file-adapter.cjs and mission repository. Mission service owns idempotent submission, snapshot and persisted status; transport owns no file layout. Tests: replay/restart, conflicting id, adapter failure and independent adapter substitution.
- [x] 4. Wire composition roots and client scene submission; add mission status/readiness interfaces, preserve legacy route and telemetry APIs. Execution status must come from matching controller feedback, never guessed from send success.
- [x] 5. Verify boundaries, integration with independent processes and UI build/send, lint/build/full JS suite. Run C tests/build if controller feedback contract changes. Document architecture, module interfaces, local commands and limitations.

Each step includes regression tests and manual diff review. Plan lives here because repository tests explicitly forbid temporary docs/superpowers artifacts.

Completed 2026-09-08. See MODULAR-ARCHITECTURE.md for interfaces and limitations. Verification: 90 JS files / 234 tests; lint and production build; 85 controller tests and Webots build; independent-services smoke; browser plan/send and synthetic accepted/running/completed feedback. No physical simulation claim.
