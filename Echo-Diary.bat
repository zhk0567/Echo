@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "ECHO_APP_ROOT=%~dp0"
set "ECHO_APP_ROOT=%ECHO_APP_ROOT:~0,-1%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
    echo.
    echo Failed to start Echo Diary.
    pause
)
