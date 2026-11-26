#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to an Android SDK containing platform 35 and build-tools 35.0.0}"
tools="$ANDROID_SDK_ROOT/build-tools/35.0.0"
platform="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
node android/tools/prepare.mjs
rm -rf android/build/classes android/build/dex
mkdir -p android/build/classes android/build/dex
"$tools/aapt2" compile --dir android/res -o android/build/resources.zip
"$tools/aapt2" link -o android/build/base.apk -I "$platform" --manifest android/AndroidManifest.xml --min-sdk-version 26 --target-sdk-version 35 -A android/assets android/build/resources.zip
if command -v javac >/dev/null; then
  javac -source 8 -target 8 -classpath "$platform" -d android/build/classes android/src/app/oktawka/player/*.java
else
  java -jar "${ECJ_JAR:?Set ECJ_JAR when javac is unavailable}" -source 8 -target 8 -bootclasspath "$platform" -d android/build/classes android/src/app/oktawka/player/*.java
fi
"$tools/d8" --lib "$platform" --min-api 26 --output android/build/dex android/build/classes/app/oktawka/player/*.class
cp android/build/base.apk android/build/unsigned.apk
(cd android/build/dex && zip -q ../unsigned.apk classes.dex)
"$tools/zipalign" -f -p 4 android/build/unsigned.apk android/build/aligned.apk
if [[ -z "${OKTAWKA_KEYSTORE:-}" ]]; then
  keyfile="${OKTAWKA_DEV_KEYSTORE:-$HOME/.oktawka-signing/debug.keystore}"
  mkdir -p "$(dirname "$keyfile")"
  if [[ ! -f "$keyfile" ]]; then
    # A new key breaks updates over the installed review app; only create one on purpose.
    [[ "${OKTAWKA_NEW_DEV_KEY:-}" == 1 ]] || { echo "No signing key at $keyfile. Set OKTAWKA_KEYSTORE to the review keystore, or OKTAWKA_NEW_DEV_KEY=1 for a throwaway key (cannot update installed builds)." >&2; exit 1; }
    keytool -genkeypair -keystore "$keyfile" -storepass android -keypass android -alias androiddebugkey -dname 'CN=Oktawka Development' -keyalg RSA -keysize 2048 -validity 10000 >/dev/null 2>&1
    chmod 600 "$keyfile"
  fi
  "$tools/apksigner" sign --ks "$keyfile" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out android/build/Oktawka-1.1.0-review.apk android/build/aligned.apk
else
  "$tools/apksigner" sign --ks "$OKTAWKA_KEYSTORE" --out android/build/Oktawka-1.1.0-review.apk android/build/aligned.apk
fi
"$tools/apksigner" verify --verbose android/build/Oktawka-1.1.0-review.apk
"$tools/aapt2" dump badging android/build/Oktawka-1.1.0-review.apk | head -8
