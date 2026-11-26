# W3D viewer and forward-facing camera

Approved by user: replace the external MJPEG view with the official Webots R2025a
W3D viewer, keep Docker CPU/GPU support and dashboard clock controls, fix the robot
camera looking skyward. Work personally, without agents.

- [x] Vendor release-matched viewer JS/WASM/assets into frontend; no runtime CDN dependency.
- [x] Isolate upstream global state in a same-origin iframe. Validate postMessage source,
  origin and allowed speed commands. Confirm modes from the actual simulator socket.
- [x] Preserve reconnect/cleanup semantics without replaying missions or clock commands.
- [x] Launch Webots with --stream=w3d --no-rendering and scene updates at 30 FPS.
- [x] Regression test camera forward/up axes, remove erroneous Y rotation, inspect real JPEG.
- [x] Adapt transport tests, full-container smoke and benchmark to W3D.
- [x] Verify browser rendering/textures, speed controls, close/reopen, CPU/GPU, missions,
  and performance with the browser actually connected. Update operating documentation.

The camera sensor stays in Webots; external scene rendering moves to browser WebGL2.
No physics timestep or motion model changes. Do not claim browser FPS from server
scene-update counts: measure these separately.

Verification (2026-09-18): 268 tests, lint, Docker frontend build; full CPU fallback
and GPU smoke tests passed. Browser external asset requests: none. Speed selection,
close/reopen and forced socket disconnect/recovery verified. Camera JPEG shows
the floor ahead and a level horizon. Measured performance is recorded in
[SIMULATION-PERFORMANCE.md](SIMULATION-PERFORMANCE.md).

Integration details discovered in verification:
- Negotiate `w3d;broadcast` to disable the server's initial zero-second timeout.
- Remove the pinned W3dScene model-load pause hook; do not instantiate Toolbar.
- Buffer ordered scene deltas until parsing completes, preserving initial poses.
- Change the iframe query on reconnect: a fragment change does not reload it.
- Include WREN postprocessing images and current-world textures in the asset manifest.
