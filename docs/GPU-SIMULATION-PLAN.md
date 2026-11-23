# CPU/GPU simulation and speed controls

Approved scope: CPU-only installations remain supported; GPU rendering is optional;
CPU continues running physics/controller in both modes. Target >=1x on the development
machine, measured rather than promised on arbitrary hardware. No physics timestep changes.

## Implementation

- [x] Probe WSLg OpenGL in an isolated container (actual renderer, not CUDA availability).
- [x] Add mesa-utils and a renderer launcher: cpu uses Xvfb/software Mesa;
  gpu requires working hardware GL; auto falls back to CPU with a visible log.
- [x] Add an optional WSLg Compose overlay. Default Compose requires no GPU/devices.
  Explain Docker Desktop-specific host paths and configurable alternatives.
- [x] Extend the existing simulation transport service with real-time/fast commands,
  server-confirmed state, timeout/errors, disconnect reset and no automatic mode replay.
  Add failing protocol tests first; then implement and run them.
- [x] Add compact accessible dashboard speed buttons and pending/error feedback.
- [x] Measure CPU and GPU with identical world/cameras and normal/fast modes.
  Verify mission completion and image streaming, test fallback, run tests/lint/build.
- [x] Document launch commands, performance evidence and any remaining limitations.

## Acceptance

CPU startup needs no graphics hardware. Requested GPU must not silently use llvmpipe.
Closing/reconnecting the view must not pause or reset a mission. Both modes preserve
camera images and navigation. Mode changes come from server acknowledgements.
Performance metric: delta simulationTime / elapsed monotonic wall time after warm-up.
