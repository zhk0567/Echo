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
$shortcut.Description = "Echo Diary - personal journal"

# Always use VBS launcher so source updates trigger rebuild before opening exe
if (Test-Path $launcherVbs) {
    $shortcut.TargetPath = $launcherVbs
    if (Test-Path $unpackedExe) {
        $shortcut.IconLocation = "$unpackedExe,0"
    }
    Write-Host "Shortcut targets launcher (auto-rebuild when code changes)." -ForegroundColor Green
} else {
    Write-Error "Echo-Diary.vbs not found in project root."
}

$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
Write-Host "Target: $($shortcut.TargetPath)"