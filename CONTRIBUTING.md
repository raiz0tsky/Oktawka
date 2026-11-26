# Working on Oktawka

Use Node.js 22 or newer. No npm installation is needed for the web build.

```sh
node scripts/check.mjs
node scripts/build-worker.mjs
node tests/artifact.mjs
```

Authored browser files are in `dist/`; `worker/` contains server routes. Generated deployment output is in ignored `build/`. The Cloudflare-compatible Worker entry is `build/dist/server/index.js`. Deploy on a host supporting Worker fetch handlers. Plain static hosting alone cannot serve `/api/*` routes.

Keep provider keys, OAuth tokens, `.env` files, signing keys and listening data out of Git. Third-party code licenses and source packages live in `third-party/` and the linked notices. Streaming service accounts are separate from this player.

Review UI at 320, 390, 768 and 1440 CSS pixels, portrait and landscape. Check search, album popup playback, queue, lyrics, keyboard navigation, zoom and theme contrast. Test top/bottom safe areas on a real phone; browser previews do not establish Android WebView status-bar behavior.

The Android wrapper now bundles the current UI for review. A release APK needs updated bundled assets, native window-inset checks, real-device playback checks and a private release signing key. Do not commit a signing key.

Hosting: `.openai/hosting.json` is ignored and stays local. New clones build with the empty example manifest. Configure your own hosting identity when deploying. The private review deployment may include a locally built APK download; CI without the Android build omits that optional asset.
