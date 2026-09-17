@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local\start-client-preview.ps1"
if errorlevel 1 pause
