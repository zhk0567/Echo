$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Echo 日记 - 启动中..." -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "错误：未检测到 Node.js，请先安装 Node.js (https://nodejs.org)" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "首次运行，正在安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
}

if (-not (Test-Path "entries") -or ((Get-ChildItem "entries" -Filter "*.json" -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0)) {
    Write-Host "正在迁移日记数据..." -ForegroundColor Yellow
    npm run migrate
}

$portableExe = Get-ChildItem "release" -Filter "Echo-Diary-*-portable.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portableExe) {
    Write-Host "启动已打包版本: $($portableExe.Name)" -ForegroundColor Green
    Start-Process -FilePath $portableExe.FullName -WorkingDirectory $PSScriptRoot
} else {
    Write-Host "启动开发模式..." -ForegroundColor Green
    npm run dev
}
