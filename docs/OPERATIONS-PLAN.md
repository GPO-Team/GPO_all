# Service operations implementation plan

Approved scope: prepare independent services for operation before Docker.

- [x] Add offline repository export/import with exclusive ownership, checksum validation and restore into a new directory. Keep mission and gateway backups paired; simulator files require a separate stopped-Webots copy.
- [x] Support GATEWAY_TOKEN_FILE, reject ambiguous configuration, keep credentials out of source control.
- [x] Bound shutdown time, preserve failure status and verify signal behavior.
- [x] Add bounded file logging with token redaction and document stdout/stderr log retention, backup/restore, deployment placement and recovery limitations.
- [x] Run unit tests, lint, service smoke and Linux CI.

Implementation is performed personally without agents. Tests precede behavior changes. Docker and the full-project launcher remain a later stage.

Verification: 250 tests passed locally; lint and service smoke passed. Ubuntu CI run 34702263989 succeeded, including native builds/tests, frontend build and graceful service termination.
