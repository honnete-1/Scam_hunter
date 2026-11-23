# Builds the Android APK in Expo's cloud, then publishes its download link to the backend,
# so the website's download button and QR code always show the newest build.
#
#   powershell -ExecutionPolicy Bypass -File mobile\build-android.ps1
#
# Options: -ExpoHome <folder>  where your Expo login is saved, if not in your user folder
#          -TempDir <folder>   temporary files and npm cache somewhere else (e.g. when C: is full)
param(
  [string]$ExpoHome = "",
  [string]$TempDir = ""
)

$mobile = $PSScriptRoot
$root = Split-Path $mobile -Parent

if ($ExpoHome) {
  $env:USERPROFILE = $ExpoHome
  $env:HOME = $ExpoHome
}
if ($TempDir) {
  $env:TEMP = $TempDir
  $env:TMP = $TempDir
  $env:npm_config_cache = Join-Path $TempDir "npm-cache"
}

Set-Location $mobile
Write-Host "Building the Android APK in Expo's cloud. This usually takes 10 to 20 minutes..."
# --json prints the finished build (with its APK link) on the output; progress goes to the screen.
$output = npx eas-cli@latest build --platform android --profile preview --non-interactive --json
if ($LASTEXITCODE -ne 0) {
  Write-Host "The build failed. Open the build link shown above to see why." -ForegroundColor Red
  exit 1
}

$build = @(($output -join "`n") | ConvertFrom-Json)[0]
$apkUrl = $build.artifacts.applicationArchiveUrl
if (-not $apkUrl) {
  Write-Host "The build finished, but Expo returned no APK link." -ForegroundColor Red
  exit 1
}

& (Join-Path $root ".venv\Scripts\python.exe") (Join-Path $root "manage.py") publish_android_build --url $apkUrl --app-version $build.appVersion --build-id $build.id
Write-Host "Done. The website now offers version $($build.appVersion): $apkUrl" -ForegroundColor Green
