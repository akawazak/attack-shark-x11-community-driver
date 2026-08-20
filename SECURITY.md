# Security Policy

## Supported versions

Security fixes are provided for the latest stable release. Upgrade to the newest patch before reporting a problem that may already be fixed.

## Report a vulnerability

Do not publish exploit details in a normal issue.

Use **Security → Report a vulnerability** in this GitHub repository when private vulnerability reporting is available. If it is unavailable, open a minimal issue asking the repository owner for a private contact channel without including sensitive details.

Include the affected version and operating system, the security impact, reproduction steps, and any proposed mitigation. Allow the maintainer reasonable time to investigate before public disclosure.

## Security design

- The renderer is sandboxed, has context isolation enabled, and has no Node.js integration.
- IPC calls are accepted only from the app's main frame and validate their arguments before touching USB or disk state.
- Navigation and external links are restricted to this repository over HTTPS.
- Device access is limited to the known vendor and product IDs and the expected Windows HID control collection.
- Mouse-memory writes are validated and serialized; multi-report operations cannot interleave.
- Settings and profiles are size-limited, schema-validated, and written atomically with user-only file permissions where supported.
- Linux udev access uses `0660` plus `uaccess`, not world-writable device permissions. An explicit dedicated-group fallback is available for login managers without working `uaccess` ACLs; it is never enabled silently.
- Dependencies and GitHub Actions are locked, audited, and verified on Windows and Linux.
- Release assets include SHA-256 checksums and GitHub build-provenance attestations.

## Signing status

The updater only checks official release metadata and does not silently execute downloaded binaries. Windows packages are signed only when the release workflow has a valid code-signing certificate configured; otherwise users must verify the published checksum. Do not treat an unsigned build as signed.

## Hardware safety

This is a reverse-engineered community driver. A shared receiver USB ID can represent multiple mouse models, so the app requires an explicit model choice. Only use a model/protocol combination shown as compatible and do not disconnect the mouse during an active Apply or reset operation.
