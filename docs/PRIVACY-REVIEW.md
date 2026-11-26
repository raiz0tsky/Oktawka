# Source and APK privacy review

Review scope: tracked source, historical Git blobs and the contents of the built Android review APK. Pattern checks covered recognizable access tokens/private keys and known personal references; credential-like literals were reviewed as test fixtures. No actual provider API keys were identified by these checks. Pattern scanning is not proof that arbitrary credentials cannot exist.

Changes made:

- Removed personal hosted-preview addresses and profile references from current documentation and request headers.
- Removed the hosting project identifier from Git tracking. Existing deployment configuration remains in an ignored local file. New clones use `.openai/hosting.example.json` for a generic build.
- Kept signing keys, `.env` files and account token files outside tracked source and the APK.
- The Android package identifier (`app.oktawka.player`) is the app's namespace, not a personal account ID. Third-party project URLs and codec license notices remain for attribution.

This public repository started from a fresh, clean source snapshot (26 November 2026). It does not carry the older private development history, which had non-secret deployment references and author metadata. That history stays in a separate private repository.

This review does not inspect browser storage, phone app data, connected account secrets or production environment-variable values. Keys you previously entered into a browser remain on that device according to your persistence choice; they are not bundled in the APK.

## Public preparation — 4 November 2026

Rechecked all 261 reachable historical Git blobs and the packaged review APK for recognizable GitHub tokens, AWS access-key IDs, Google API keys and PEM private keys; no matches were found. No tracked environment files, hosting identity manifests or signing keys were found. This limited pattern check does not establish that arbitrary secrets are absent. Automated web checks, the Worker build and packaged artifact checks passed. Real-device and authenticated provider testing remain pending.

## Fresh public repository — 26 November 2026

Scanned the source tree, the full private history and the review APK with regular expressions. The patterns covered Bearer tokens, apikey/token parameters, 52-character Real-Debrid-style tokens, AWS, GitHub and Google keys, PEM private keys, email addresses and known personal deployment hosts. No provider keys, tokens, passwords or logins turned up. The public repository was then created from a clean snapshot, so the private history's personal references are not part of it.
