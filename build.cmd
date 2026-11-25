@echo off
rem Double-click to rebuild "Grammar Guide Game.html" from the levels folder and open it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Open
echo.
pause
