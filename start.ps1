$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Echo Diary - starting..." -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

$entryFiles = Get-ChildItem "entries" -Filter "*.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}\.json$' }
if (-not (Test-Path "entries") -or ($entryFiles | Measure-Object).Count -eq 0) {
    Write-Host "Migrating diary data..." -ForegroundColor Yellow
    npm run migrate
}

$env:ECHO_APP_ROOT = $PSScriptRoot

function Stop-OtherEchoProcesses {
    $names = @('Echo Diary')
    foreach ($name in $names) {
        Get-Process -Name $name -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -like 'Echo-Diary-*' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*$PSScriptRoot*" -and (
                $_.Name -eq 'electron.exe' -or
                ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*vite*')
            )
        } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

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

function Build-Release {
    Write-Host "检测到源码已更新，正在重新打包（约 1–2 分钟）..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "打包失败" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "打包完成" -ForegroundColor Green
}

Stop-OtherEchoProcesses
Start-Sleep -Milliseconds 800

$unpackedExe = Join-Path $PSScriptRoot "release\win-unpacked\Echo Diary.exe"
$portableExe = Get-ChildItem "release" -Filter "Echo-Diary-*-portable.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$releaseTarget = if (Test-Path $unpackedExe) { $unpackedExe } elseif ($portableExe) { $portableExe.FullName } else { $null }
$needsBuild = -not $releaseTarget -or (Test-ReleaseOutdated $releaseTarget)

if ($needsBuild -and $env:ECHO_START_VISIBLE -ne '1') {
    $env:ECHO_START_VISIBLE = '1'
    Start-Process powershell.exe -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath
    ) -WindowStyle Normal
    exit 0
}

if (Test-Path $unpackedExe) {
    if (Test-ReleaseOutdated $unpackedExe) {
        Build-Release
    }
    Write-Host "Launching Echo Diary..." -ForegroundColor Green
    Start-Process -FilePath $unpackedExe -WorkingDirectory $PSScriptRoot
} elseif ($portableExe) {
    if (Test-ReleaseOutdated $portableExe.FullName) {
        Build-Release
        $portableExe = Get-ChildItem "release" -Filter "Echo-Diary-*-portable.exe" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
    }
    Write-Host "Launching: $($portableExe.Name)" -ForegroundColor Green
    Start-Process -FilePath $portableExe.FullName -WorkingDirectory $PSScriptRoot
} else {
    Write-Host "未找到打包版本，正在构建..." -ForegroundColor Yellow
    Build-Release
    if (Test-Path $unpackedExe) {
        Start-Process -FilePath $unpackedExe -WorkingDirectory $PSScriptRoot
    } elseif ($portableExe = Get-ChildItem "release" -Filter "Echo-Diary-*-portable.exe" -ErrorAction SilentlyContinue | Select-Object -First 1) {
        Start-Process -FilePath $portableExe.FullName -WorkingDirectory $PSScriptRoot
    } else {
        Write-Host "Starting dev mode..." -ForegroundColor Green
        npm run dev
    }
}
