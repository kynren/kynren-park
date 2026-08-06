# Build an installable Android APK for on-device testing (no Expo account needed).
# Run in PowerShell from apps/mobile:   .\build-apk.ps1
# Requires JDK 17 + Android SDK (already installed here).
# Output: apps\mobile\android\app\build\outputs\apk\release\app-release.apk
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# API the app talks to on the phone (this PC's LAN IP; phone must be on same WiFi).
if (-not $env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL = "http://10.0.24.10:4010" }
Write-Host "Building with API = $env:EXPO_PUBLIC_API_URL" -ForegroundColor Cyan

# 1) Generate the native project if missing (already done once).
if (-not (Test-Path android)) { npx expo prebuild -p android --no-install }

# 2) Compile the release APK (debug-signed by Expo's template, so it installs).
Set-Location android
try { .\gradlew.bat --stop 2>$null } catch {}
if (Test-Path ".gradle") { Remove-Item -Recurse -Force ".gradle" -ErrorAction SilentlyContinue }

# Keep Gradle's caches OUT of the Documents folder. Defender / OneDrive / the
# Windows Search indexer lock files there mid-write and break Gradle's atomic
# "move temporary workspace" step. LOCALAPPDATA is not synced/indexed.
$projCache = Join-Path $env:LOCALAPPDATA "kynren-gradle\project-cache"
$env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA "kynren-gradle\home"
Write-Host "Gradle caches -> $env:LOCALAPPDATA\kynren-gradle" -ForegroundColor Cyan

.\gradlew.bat assembleRelease --console=plain --project-cache-dir "$projCache"

$apk = "app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apk) {
  Write-Host "`nAPK ready: apps\mobile\android\$apk" -ForegroundColor Green
  Write-Host "Copy it to your phone and open it (allow 'install unknown apps')."
} else {
  Write-Host "`nBuild finished but APK not found - check the Gradle output above." -ForegroundColor Yellow
}
