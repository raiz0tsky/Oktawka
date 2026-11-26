# Acceptance status

Last updated 2026-11-26. ✅ verified (evidence given) · ❌ failed · ⏳ not tested / unfinished.
"Unit" means a Node test with mocked network/DOM — it proves logic, not real-world playback.
"Browser" means headless Chromium against the packaged Worker build (`build/dist/server/index.js`) on a 390×844 phone viewport unless noted.

## Automated checks

✅ `node scripts/check.mjs` — exit 0 (re-run after the 2026-11-26 design fixes). Now runs **all** 21 test files (before, CI ran 9 of them and skipped debrid, catalog, addons, archive, radio, search, related, themes, android).
✅ `node scripts/build-worker.mjs && node tests/artifact.mjs` — PASS.
✅ `bash android/build.sh` — APK builds with SDK 35 / build-tools 35.0.0 / javac; `aapt2 dump badging` shows the new service permissions. Signed with a throwaway key only (see Delivery).

## Feature preservation

| Feature | Status | Evidence / gap |
| --- | --- | --- |
| Real-Debrid connect (device auth), invalid key, disconnect | ⏳ | Unit only (`debrid.cjs`). No real account used. |
| AllDebrid connect (PIN / key), invalid key, disconnect | ⏳ | Unit only. |
| Provider workflows | ⏳ | Code: AllDebrid = automatic album-track matching + source workflow; Real-Debrid = source/link workflow only. Not run live. |
| FLAC 16/24-bit decode | ✅ unit | `flac-decoder.cjs` decodes known 16- and 24-bit samples bit-exact. No real-file playback test yet. |
| Quality badges | ✅ | Unit (`audio-quality.cjs`); browser: live radio shows "FLAC · bits unverified" (not falsely verified). |
| Lyrics (LRCLIB) | ✅ route | Browser build: `/api/lyrics?artist=Radiohead&title=Creep` returned synced lyrics. UI-with-playing-track not tested. |
| Related music | ✅ route | `/api/related?artist=Radiohead` returned tracks. Queue-end continuation: unit only. |
| Album/artist search, profiles, saved albums | ⏳ | Album popup opens with 14 tracks (browser). Search/profile/save: unit only. |
| Album continuation, popup stays open | ⏳ | Unit (`listening.cjs`, `album-playback.cjs`). Needs a real source. |
| Queue, favorites, history, playlists import | ⏳ | Unit only. |
| Themes | ⏳ | Unit (`themes.cjs`). Each theme not visually checked. README lists "moss"; requested "grey" not confirmed. |
| HiFi (optional) | ⏳ | Unit (`streaming.cjs`). No endpoint available. |
| Local files | ✅ browser | 16-bit/44.1 kHz WAV imported and played (`paused=false`); badge read "LOSSLESS · 16-BIT · 44.1 kHz" from the real header. FLAC local file not tested. |
| Radio | ✅ | Browser: Main mix playing, `paused=false`, `currentTime≈7.6 s` after 8 s. Screenshot committed. |
| Internet Archive / open recordings | ⏳ | Unit (`archive.mjs`). |

## Android

| Item | Status | Evidence / gap |
| --- | --- | --- |
| APK startup, bundled assets | ⏳ | `tests/android.mjs` PASS (all HTML-referenced assets bundled); APK has 31 assets. Not launched — no device/emulator (no KVM here). |
| Status bar / cutout / nav bar insets | ⏳ | Code pads container for systemBars+cutout+ime on API 30+. Unverified on device. |
| Gesture vs three-button nav, landscape, small screen, large text | ⏳ | Not tested. |
| Keyboard | ⏳ | `adjustResize` + ime inset. Unverified. |
| Back closes dialogs, then navigates, then backgrounds app | ✅ browser / ⏳ device | New `window.OktawkaBack`; browser: closes album popup → true; Radio→Home → true. Java calls it via `evaluateJavascript`. Before: Back always exited (no WebView history). |
| Background / screen-off playback | ⏳ | **New** `PlaybackService` (mediaPlayback foreground service) started on play, stopped on foreground pause / app destroy. Not tested on a device. No lock-screen controls yet. |
| Audio focus / interruptions | ⏳ | Relies on WebView's own focus handling. Untested. |
| Rotation / dark-mode change keeps playback | ⏳ | `configChanges` widened so the Activity (and WebView audio) is not recreated. Untested. |

## Windows app

⏳ Not started. No Windows package exists in the repository. Needs a decision on wrapper (e.g. WebView2/Tauri vs Electron) and a Windows machine or VM to test the packaged build.

## Playback edge cases

⏳ Provider login/expiry, timeouts, retry, stale-request cancellation, wrong-recording refusal, lossy labeling: unit tests pass for each; none run against real providers.
⏳ Pause/seek/next/prev/shuffle/repeat on a real track: only radio play was exercised.
✅ No credentials in committed files: `tests/android.mjs` / `spotify.cjs` assert no embedded IDs; screenshots contain no keys. Full secret scan not repeated.

## Design review (browser, phone + desktop)

- ✅ No horizontal overflow at 390 px or 1440 px; no console errors on load.
- ✅ Fixed: idle mini-player Play no longer looks like a ready track (grey until a track is loaded; still opens the file picker). Browser: background `rgb(41,41,41)` when idle.
- ✅ Fixed: phone "Saved albums / Browse all" sit on one row under the title, both 44 px tall (measured top 359 px, height 44 px each).
- ✅ Fixed: all four bottom-nav labels are 11 px (Library was 9 px).
- ✅ Fixed: quality badge hugs its text (110 px for "FLAC · bits unverified", was full width).
- ✅ Fixed: album popup marks the playing row (accent title + ring, `aria-current`). Browser: local `One More Time.wav` playing → that row marked. Matching is by title only.
- Not changed: on Radio, page text scrolls through the gap between mini-player and nav bar (normal for a floating player).
- ⏳ Controls under 32 px: 4 on phone, 16 on desktop. Not yet reviewed one by one. Each theme not visually checked.

## Removed

- Spoken track introductions (browser speech before each track) — removed on request.

## Secret / personal data scan (2026-11-26)

- ✅ Current files: no API keys, tokens, passwords, private keys or personal deployment URLs (regex scan for Bearer/apikey/token/52-char RD tokens/AWS/GitHub/Google keys/emails).
- ✅ Committed review APK (unzipped): none of the above, no deployment URLs.
- ✅ Full git history text: no debrid keys, tokens or passwords found.
- ✅ Public repository starts from one clean commit (Option A): no old deployment URLs, hosting project ID or personal author metadata. The old private repository keeps the full history.
- ⏳ Browser/phone local storage and production secrets: not inspected (not in the repo).

## Delivery

⏳ Desktop preview: run `node scripts/build-worker.mjs`, then serve `build/dist/server/index.js` (see CONTRIBUTING). Not hosted publicly.
❌ Signed Android review APK for update: **blocked**. The original review key (cert SHA-256 `fd9aca5a…3e0e1d56`) is not in this environment. A build signed with any other key cannot install over the current review app. `build.sh` now refuses to silently create a new key.
⏳ Windows package: not started.
