#!/usr/bin/env bash
# Build an installable Android APK for on-device testing (no Expo account needed).
# Run this in a NORMAL terminal on the dev machine (Git Bash / PowerShell-with-bash),
# NOT inside the Claude Code sandbox — the sandbox blocks Gradle's loopback sockets.
#
# Requires: JDK 17 + Android SDK (already installed on this machine).
# Output: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
set -e
cd "$(dirname "$0")"

# API the app will talk to on the phone. Use this PC's LAN IP so a phone on the
# same WiFi can reach the local API on :4010. Change if your IP differs.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://10.0.24.10:4010}"
echo "Building with API = $EXPO_PUBLIC_API_URL"

# 1) Generate the native Android project if it isn't there yet.
if [ ! -d android ]; then
  npx expo prebuild -p android --no-install
fi

# 2) Compile the release APK (debug-signed by Expo's template, so it installs).
cd android
./gradlew assembleRelease --console=plain

APK="app/build/outputs/apk/release/app-release.apk"
echo ""
echo "✅ APK ready: apps/mobile/android/$APK"
echo "   Copy it to your phone and open it (allow 'install unknown apps')."
