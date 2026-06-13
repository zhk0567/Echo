# Ensures release\win-unpacked\Echo Diary.exe is up to date (silent, no console).
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

function Test-ReleaseOutdated {
    param([string]$ReleaseExe)
    if (-not (Test-Path $ReleaseExe)) { return $true }

    $releaseTime = (Get-Item $ReleaseExe).LastWriteTime
    $watchPaths = @('electron', 'src', 'index.html', 'package.json', 'vite.config.ts')

    foreach ($watchPath in $watchPaths) {
        if (-not (Test-Path $watchPath)) { continue }
        $item = Get-Item $watchPath
        if ($item.PSIsContainer) {
            $newest = Get-ChildItem $watchPath -Recurse -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
            if ($newest -and $newest.LastWriteTime -gt $releaseTime) {
                return $true
            }
        } elseif ($item.LastWriteTime -gt $releaseTime) {
            return $true
        }
    }

    return $false
}

$unpackedExe = Join-Path $projectRoot "release\win-unpacked\Echo Diary.exe"

if (-not (Test-Path $unpackedExe) -or (Test-ReleaseOutdated $unpackedExe)) {
    if (-not (Test-Path "node_modules")) {
        npm install
        if ($LASTEXITCODE -ne 0) { exit 1 }
    }
    npm run build:dir
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

exit 0
