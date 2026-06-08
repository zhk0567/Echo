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

$unpackedExe = Join-Path $PSScriptRoot "release\win-unpacked\Echo Diary.exe"
$portableExe = Get-ChildItem "release" -Filter "Echo-Diary-*-portable.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (Test-Path $unpackedExe) {
    Write-Host "Launching Echo Diary..." -ForegroundColor Green
    Start-Process -FilePath $unpackedExe -WorkingDirectory $PSScriptRoot
} elseif ($portableExe) {
    Write-Host "Launching: $($portableExe.Name)" -ForegroundColor Green
    Start-Process -FilePath $portableExe.FullName -WorkingDirectory $PSScriptRoot
} else {
    Write-Host "Starting dev mode..." -ForegroundColor Green
    npm run dev
}
