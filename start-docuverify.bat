@echo off
REM DocuVerify - one-click dev startup
REM Opens: backend (:8000, all interfaces), auth service (:4000), Expo Go dev server.
REM Run fix-firewall.bat once as Administrator if the phone cannot connect.
setlocal
cd /d "%~dp0"

echo Starting DocuVerify... (3 windows)

REM Kill any stale instances first — two backends on :8000 (e.g. one on
REM 127.0.0.1 and one on 0.0.0.0) run side by side on Windows, and the
REM phone and the web app then talk to DIFFERENT job stores.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000,4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

start "DocuVerify - Backend :8000" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
start "DocuVerify - Auth :4000" cmd /k "cd /d %~dp0auth && npm run dev"
start "DocuVerify - Expo Go" cmd /k "cd /d %~dp0mobile && npx expo start"

echo.
echo Done. Scan the QR with Expo Go, then sign in with test@docu.com / password.
echo If the phone cannot connect, right-click fix-firewall.bat - Run as administrator.
pause