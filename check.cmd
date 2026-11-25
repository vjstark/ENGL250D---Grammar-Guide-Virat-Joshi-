@echo off
rem Double-click to check every level file for mistakes (uses Microsoft Word for spelling and grammar if it is installed).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check.ps1"
echo.
pause
