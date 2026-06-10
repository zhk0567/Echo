# Creates or updates the Echo Diary desktop shortcut.
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Echo.lnk"
$launcherVbs = Join-Path $projectRoot "Echo-Diary.vbs"
$iconExe = Join-Path $projectRoot "release\win-unpacked\Echo Diary.exe"

if (-not (Test-Path $launcherVbs)) {
    Write-Error "Launcher not found: $launcherVbs"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherVbs
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Echo 日记 - 本地个人日记"

if (Test-Path $iconExe) {
    $shortcut.IconLocation = "$iconExe,0"
}

$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
Write-Host "Target: $launcherVbs"
