# Oktawka

A responsive desktop and phone music player with native browser audio playback. MIT licensed.

## Features

- Albums and artists search, album artwork, track lists, artist profiles, top tracks, and available discography.
- Click an artist in the player or an album to open their profile. Top tracks use Apple catalog ordering; global play counts are unavailable. Discography responses are limited to 200 releases.
- Select an album track to match and resolve audio in the background, then play inside Oktawka. AllDebrid resolves URLs; it is not an external player.
- Lossless first, with an explicit **Allow lossy fallback** checkbox and **Try lossy fallback** action after a failed lossless match.
- Artist/title checks handle track numbers, artist/album filename prefixes, Unicode, feature credits, codec tags, and remaster labels. Live/remix/acoustic mismatches remain rejected. Each quality phase checks at most three source releases and tries artist+track search when album files do not match.
- Source quality badge with measured FLAC/WAV bit depth and sample rate where readable. Remote checks request only the first 4 KB, cancel the reader afterward, and cache results. Blocked or unsupported headers remain unverified. Lossy fallback is labeled explicitly.
- Native playback, queue, seeking, volume, shuffle/repeat, Media Session controls, local file import, and direct HTTPS streams.
- Real-Debrid and AllDebrid API-key connections, plus device/PIN alternatives. Reconnection resumes the selected source. Optional tab-scoped persistence survives refreshes; keys are never stored in this repository or on Oktawka servers.
- **Black & Red** (default), **Black & Blue**, and **Original Green** themes. Use the ◐ button in the header; the choice is saved on your device.

## Source and quality limitations

Apple supplies catalog metadata, not full audio. Knaben supplies external release candidates; AllDebrid availability and account/host limits determine playback. A catalog match or a lossless filename is not proof of recording authenticity, source availability, or hardware output quality. Resolution ranking uses advertised labels; only supported header reads are reported as measured bit depth.

Lossless matching accepts FLAC/WAV/AIFF candidates. Lossy fallback additionally accepts MP3/AAC/M4A/OGG/OPUS containers. Compressed album images, CUE splitting, fingerprint/ISRC verification, and Dolby Atmos playback are not implemented. A wrong or uncertain song is not silently substituted. Pending selected sources are checked every five seconds for up to a minute while playback is actively requested; canceling stops future work but does not delete provider-side downloads already initiated.

See [SOURCE-RESEARCH.md](SOURCE-RESEARCH.md) for the provider review. Automated checks simulate provider responses. Live authenticated end-to-end playback and battery consumption have not been independently verified.

## Project layout

- `dist/`: authored HTML, CSS, and browser scripts (despite the directory name, these are source files).
- `worker/search.mjs`: fixed-upstream server search route; provider credentials are never forwarded to the indexer.
- `scripts/build-worker.mjs`: embeds UI assets and creates the Worker artifact.
- `tests/`: dependency-free Node checks for providers, matching, fallback, catalogs, artist profiles, themes, source headers, and packaging.
- `.openai/hosting.json`: existing private Site identity. It contains no API keys.

## Build and verify

Requires Node.js 20+; there are no package dependencies to install.

```bash
node scripts/build-worker.mjs
node tests/search-worker.mjs
node tests/debrid.cjs
node tests/addons.cjs
node tests/album-playback.cjs
node tests/catalog.cjs
node tests/player-artist.cjs
node tests/audio-quality.cjs
node tests/themes.cjs
node tests/artifact.mjs
```

Build output: `build/dist/server/index.js` and `build/.openai/hosting.json`. The output is ignored by Git and is reproducible from the tracked source. The Worker must use `redirect: 'manual'`; its runtime rejects `redirect: 'error'` before an upstream request is made.

Package for Sites using:

```bash
tar -czf /tmp/oktawka-deploy.tar.gz -C build .openai/hosting.json dist/server
```

Publish through the existing Sites project. Preserve its identity and private audience. A static-only server can display the UI but will not supply `/api/cloud-search`.

## Backups and secrets

Provider keys, browser sessions, personal saved libraries, imported audio, and build/runtime secrets are not included. Device-local albums, preferences, and themes remain in the browser. Do not commit `.env`, token files, browser exports containing keys, or account credentials.

### Direct live music without debrid

Home's Live Music Archive browser finds public live recordings and opens downloadable FLAC tracks directly in Oktawka. No API key is required. Studio-album matching remains the separate AllDebrid workflow. External release discovery is now behind **External sources** and makes no initial background indexer request. Archive metadata/search is routed through a fixed-host Worker endpoint; audio streams directly from Archive. Availability, source quality, and browser support vary; live Archive playback was not verified from the restricted build environment.

### Key-free FLAC radio and open albums

Home includes four Radio Paradise mixes via `/api/radio?station=main|mellow|rock|eclectic`. This is continuous curated radio, not on-demand matching of commercial album tracks. Audio is forwarded as a stream without re-encoding; no incoming cookies or authorization headers reach the station. Playback is on demand, with no idle polling. Quality probes use same-origin credentials for Oktawka routes and omit credentials for third-party audio URLs.

Archive's selector also offers Netlabels releases with explicit Creative Commons license metadata. Commercial catalog playback remains separate and is labeled as requiring its configured provider. Radio availability, browser FLAC support and mastering provenance cannot be inferred from the codec name. Tests: `node tests/radio.mjs`, `node tests/archive.mjs`.

### Expanded player, decoding and listening flow

- Now Playing opens on playback with large cover art, source-quality badges, transport, favorites, queue, share, sleep timer and optional imported LRC lyrics.
- Native decoding remains the default. Audio details offer a lazy-loaded, pinned `@wasm-audio-decoders/flac` 0.2.11 Web Worker decoder for streaming FLAC through 24-bit. It preserves source samples; conversion to Web Audio uses normalized Float32 PCM. The WASM path disables seeking, requires fetch/CORS access, buffers a few seconds rather than a whole file, aborts stale jobs, and sleeps while paused. Its underlying library has its own input/frame buffering. Upstream integrity errors are refused. Web Audio/device output can resample or downmix and is not promised to be bit-perfect. Decoder and icon notices plus corresponding source packages are served with the app.
- Optional Web Audio EQ provides 31 graphic bands, three parametric bands and preamp attenuation. It is off by default and explicitly changes audio samples. Native remote media needs CORS access when routed into Web Audio; enabling the EQ restarts the source. Disabling EQ bypasses the filter signal path but, once attached, the native element still uses Web Audio for this page session.
- Album track lists become an ordered queue. Track completion advances; opt-in related-artist continuation uses a fixed-host Deezer metadata route plus other artists in the same genre from device-local history. Metadata does not provide audio access; the existing resolver still determines playability. No unrelated radio recording is substituted for a requested song.
- Home orders recent listening, locally derived rotation playlists/revisited albums, collection heading, then the record shelf. Radio and open albums have separate navigation categories. History stores up to 80 deduplicated metadata entries without stream URLs/tokens; it is not a cross-device account library.
- CSV/JSON playlist metadata imports deduplicate artist/title pairs, up to 500 entries. Imported metadata does not grant access to audio. Spotify/Apple sign-in and live account synchronization are not configured.
- Google Material rounded icons are served locally. Themes now include Charcoal and White alongside the existing palettes.
- Dolby Atmos and Sony 360 decoding are not implemented. A source-channel badge can describe multichannel FLAC but does not assert multichannel device output. Samsung system Atmos processing is controlled in the phone's settings; the website cannot toggle or verify it.

Validation: `node tests/flac-decoder.cjs` compares known 16- and 24-bit fixtures to their original samples, including extrema and ±1 LSB. `node tests/audio-engine.cjs` covers routing, gain, optional EQ, WASM scheduling/normalization, pause and cancellation. `node tests/listening.cjs` verifies album sequencing, CSV parsing, cancellation and URL-free history. `node tests/related.mjs` checks bounded metadata discovery. Device listening, actual Web Worker/browser playback, visual QA and Samsung output processing have not been verified in this environment.

### Desktop expanded player and automatic lyrics

At desktop widths (900px+), Now Playing uses a wide two-column layout: artwork and controls on the left, a separate scrolling lyrics pane on the right. Smaller screens retain a stacked layout. Automatic read-only LRCLIB lookups use title, artist, album and duration; mismatching titles/artists, albums and durations are refused. Synced lyrics highlight the current line using existing playback events; plain text lyrics and instrumental/missing/error states are supported. No lyrics polling is used. Requests are cancelled on track changes, responses are cached in bounded tab memory, and lyric text is inserted as text, not HTML. Unidentified live radio does not claim song lyrics. Manual LRC import remains available. Track metadata is sent to LRCLIB; audio, provider keys and incoming identity headers are not forwarded. Live provider access and visual browser QA remain unverified here.

Tests: `node tests/lyrics-worker.mjs`, `node tests/lyrics.cjs`.
## Spotify library sync

Spotify is an optional, read-only metadata import in **Your library → Connect Spotify** and **Add music → Sync Spotify**. Configure the public `SPOTIFY_CLIENT_ID` runtime variable in Sites. Register the exact deployed HTTPS origin with a trailing slash as the Spotify app's Redirect URI. The browser uses Authorization Code with PKCE, verifies state and expiry, and requests only `playlist-read-private`, `playlist-read-collaborative`, and `user-library-read`. No Client Secret is used.

Users choose playlists and Liked Songs, then run **Sync selected** to refresh additions, removals, and order. Imports are stored per device in IndexedDB. Access and refresh tokens stay in memory unless the user explicitly chooses tab-scoped persistence. Disconnect clears the connection and retains imported metadata. Spotify supplies track lists; playback uses separately available audio sources. Spotify API access restrictions, allowed-user limits, and availability of followed playlists still apply.

Imports preserve playlist duplicates and order, skip local/non-music/unavailable items with a visible summary, and paginate requests. A collection is limited to 20,000 source items, with explicit truncation reporting. Track lists and long playback queues render in bounded pages. Failed or cancelled syncs retain the previous saved library; individual inaccessible playlists report errors without replacing their prior import.

## Source-search recovery

External source search retries a network failure or server error once, with an eight-second limit per attempt. It does not retry access denials or rate limits. A bounded cache avoids duplicate requests for 90 seconds and can reuse results from the last ten minutes during a brief outage in the same running Worker. Cached source candidates still require availability checks before playback. Source-search errors offer Retry without presenting lossy fallback as a fix for an unavailable indexer.

### Streaming quality and HiFi

Settings → Streaming quality offers Adaptive, Lossless only and Data Saver. A configured HTTPS HiFi API endpoint resolves exact catalog tracks before debrid; its operator must supply working Tidal playback credentials and allow browser CORS. No endpoint is preconfigured. Supports full unencrypted BTS FLAC/AAC files; segmented DASH is currently unsupported. Adaptive chooses at track start, not mid-song, and may use AAC. Fixed-format sources are unaffected. Actual bit-depth badges still require audio verification. Album dialogs remain open on playback. See SOURCE-RESEARCH.md for source findings and limits.

HiFi follow-up: Hi-res preferred requests HI_RES_LOSSLESS, falling back to direct CD FLAC when the response uses unsupported segmented DASH. Lossless modes never fall back to AAC. Queue responses are polled at 1–3 second intervals, at most 20 times, with per-request 12-second timeouts and best-effort server cancellation on cancellation/failure. Queue URLs must stay on the configured origin and identify the returned request. Service check verifies reachability/version only. Provider-reported bit depth appears separately in Audio details; verified badges still require decoded bytes. Account/rate-limit failures stop quality retries. No service or Tidal credentials are provisioned by these changes.

## Compact web preview — 30 October 2026

Home shows six recent tracks and up to six album cards, with Browse all opening search. Recommendations use a horizontal shelf. Mobile navigation has Home, Search, Library and Radio; Add music also opens the public album collection. Playback keeps album details open. Insets account for screen cutouts and the home indicator, with larger touch targets and a simpler mini-player. Existing native-first decoding remains unchanged; no new runtime dependencies or background polling were added.

Run `node scripts/check.mjs`, then `node scripts/build-worker.mjs` and `node tests/artifact.mjs`. GitHub Actions runs these checks on pushes and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md). The hosted preview is private; this update does not publish the GitHub repository publicly or create an APK. Device layout and battery improvements are not benchmarked.
