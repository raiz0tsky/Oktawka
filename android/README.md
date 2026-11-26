# Oktawka Android 1.1 review

A small Android 8.0+ WebView application, bundling Oktawka's player, themes, library, artist profiles and source adapters. No website login is required. Internet access is the only manifest permission. File imports use Android's document picker without broad storage permission. API keys are entered in the app and never embedded in the APK. Android app data backup is disabled.

The bundled player uses a fixed HTTPS app origin. Native code serves packaged assets and performs only the fixed Archive/Knaben/LRCLIB/Deezer metadata requests needed by the shared JavaScript source adapters. It does not forward cookies or API keys. Audio streams directly to WebView. External HTTPS links open in the browser. No JavaScript native bridge is exposed. HTTP and mixed content are blocked.

## Build

Install JDK 17+, Node 20+, Android SDK platform 35 and build-tools 35.0.0, then run:

```sh
ANDROID_SDK_ROOT=/path/to/android-sdk ./android/build.sh
```

Output: `android/build/Oktawka-1.2.0.apk`. The default build uses a development signing certificate generated outside the repository at `$HOME/.oktawka-signing/debug.keystore (override with OKTAWKA_DEV_KEYSTORE)`; preserve it securely for compatible updates. It is not a Play Store production signing identity. For release signing, set `OKTAWKA_KEYSTORE` to your own keystore; apksigner prompts for its password. Never commit signing keys. VersionCode must increase for subsequent releases.

## Install

Download the APK to an Android 8+ phone, open it, and allow installation from the browser/file manager when Android asks. Keep Android System WebView up to date. This is a sideloaded development APK, not a Play Store release.

## Limits

No native foreground media service, Android Auto integration, guaranteed screen-off playback, offline downloads, or automatic APK updates. WebView/device support determines FLAC decoding and output quality. Android may suspend playback in the background. Source availability and commercial catalog restrictions are unchanged. App launches without a network connection, but streaming, catalog search and remote artwork need connectivity. Device playback and battery usage have not been tested here. Changing/reinstalling the APK can clear saved app data.

The current review bundles the updated phone UI, lyrics, icons, FLAC decoder and all browser scripts. Native window insets keep the WebView inside system bars, cutouts and keyboard bounds. Radio uses a fixed-host streaming route rather than buffering the whole audio. Spotify account configuration is intentionally empty in the APK; no personal OAuth ID is embedded. Real-device layout/audio testing is still required.
