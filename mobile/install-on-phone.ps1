# Installs the newest published Scam Hunter APK on an Android phone connected by USB.
# Installing with adb (Android's developer tool) is not blocked by Play Protect the way a
# browser download of an app that asks for SMS access is.
#
#   powershell -ExecutionPolicy Bypass -File mobile\install-on-phone.ps1 -Adb D:\platform-tools\adb.exe
#
# Before running: on the phone turn on Developer options > USB debugging, plug it in and allow the computer.
param(
  [string]$Adb = "adb",
  [string]$ApiUrl = "http://localhost:8000",
  [string]$ApkUrl = ""
)

if (-not $ApkUrl) {
  try {
    $release = Invoke-RestMethod "$ApiUrl/api/app/android/"
    $ApkUrl = $release.apk_url
  } catch {
    Write-Host "Could not reach the backend at $ApiUrl. Start Django or pass -ApkUrl." -ForegroundColor Red
    exit 1
  }
}
if (-not $ApkUrl) {
  Write-Host "No APK has been published yet. Run build-android.ps1 first." -ForegroundColor Red
  exit 1
}

$apk = Join-Path $env:TEMP "scam-hunter.apk"
Write-Host "Downloading $ApkUrl ..."
$ProgressPreference = "SilentlyContinue"
Invoke-WebRequest $ApkUrl -OutFile $apk

Write-Host "Phones connected:"
& $Adb devices
# -r replaces an installed version and keeps its settings.
& $Adb install -r $apk
if ($LASTEXITCODE -eq 0) {
  Write-Host "Installed. Open Scam Hunter on the phone." -ForegroundColor Green
} else {
  Write-Host "Install failed. Check that USB debugging is on and that you allowed this computer on the phone." -ForegroundColor Red
}
Remove-Item $apk -ErrorAction SilentlyContinue
