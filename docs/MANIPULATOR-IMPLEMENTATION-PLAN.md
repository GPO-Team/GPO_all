# Webots physical manipulation implementation plan

> Execute with superpowers:subagent-driven-development. User approved the review architecture and implementation on 2026-10-07.

**Goal:** Replace object teleportation with measured arm motion, physical gripping, transport and supported release.

**Architecture:** Retain existing C++ device adapters and mission service. Introduce tested FK/IK and time-based joint trajectories; use contact/effort and object/TCP motion to confirm gripping. Preserve the 15 cm box with a narrow physical gripping handle. Centralize motion ownership in the controller loop and expose measurements and recoverable faults.

**Tech stack:** Webots R2025a C++20, React, Node/Vitest.

## Task 1: Kinematics and joint execution

- [x] Add controller_manipulator_kinematics.h/.cpp and behavioral FK/IK tests using actual Youbot axes and offsets, limits and finite checks.
- [x] Extend controller_manipulator_service and tests with custom target trajectories and finite measurements. Verify failed tests before implementation.
- [x] Add source to controller_sources.txt; keep unit tests compatible with MSVC.

## Task 2: Physical scene and adapters

- [x] Add local YoubotManipulation.proto derived from pinned official model, with tool/finger contact slots; update world and Docker packaging.
- [x] Preserve original box and add a narrow graspable handle with matching collision geometry.
- [x] Add device effort/contact measurements and object pose/velocity access. Remove object translation writes from runtime execution.

## Task 3: Mission execution

- [x] Replace fixed arm targets with IK waypoints, guarded approach/close/test-lift/place/open/retreat stages.
- [x] Confirm grip using contact and relative object/TCP pose; confirm release using support and stable destination pose.
- [x] Gate navigation by transfer ownership and keep faults holding the robot resource.
- [x] Reset/reconfigure every stage including resume; retain measured diagnostics in telemetry.

## Task 4: Backend and UI

- [x] Fix recovery status transitions and repeated recovery request IDs with regression tests.
- [x] Apply motion profile on transfer, plan safe navigation legs, reject missing destination coordinates.
- [x] Add resume client and UI, diagnostic telemetry and explicit held/error labels.

## Task 5: Acceptance

- [x] Run targeted regressions then lint, npm test, build, C++ controller tests and production controller build.
- [x] Run isolated real Webots transfer with logs of joints, TCP, object height and final pose; tune physical model using observed results.
- [x] Review spec compliance and code quality; record limits and exact verified behavior in documentation.

No automatic commits or changes to unrelated work. Changes are made in the shared working tree so the result is immediately reviewable.
