# Creates or updates the Echo Diary desktop shortcut (GUI launch, no console).
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Echo.lnk"
$launcherVbs = Join-Path $projectRoot "Echo-Diary.vbs"
$unpackedExe = Join-Path $projectRoot "release\win-unpacked\Echo Diary.exe"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.WorkingDirectory = $projectRoot
# ASCII only — Chinese in .lnk Comments breaks tooltip encoding on some Windows locales
$shortcut.Description = "Echo Diary - personal journal"

if (Test-Path $unpackedExe) {
    $shortcut.TargetPath = $unpackedExe
    $shortcut.IconLocation = "$unpackedExe,0"
    Write-Host "Shortcut targets packaged app (no console)." -ForegroundColor Green
} elseif (Test-Path $launcherVbs) {
    $shortcut.TargetPath = $launcherVbs
    $iconExe = $unpackedExe
    if (Test-Path $iconExe) {
        $shortcut.IconLocation = "$iconExe,0"
    }
    Write-Host "Shortcut targets silent VBS launcher." -ForegroundColor Green
} else {
    Write-Error "No launcher found. Run npm run build first, or ensure Echo-Diary.vbs exists."
}

$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
Write-Host "Target: $($shortcut.TargetPath)"
