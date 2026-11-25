@echo off
rem Double-click to check the level files, then rebuild "Grammar Guide Game.html" (and index.html) and open it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check.ps1"
echo.
echo ------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Open
echo.
pause
