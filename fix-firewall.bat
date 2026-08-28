@echo off
REM Run this ONCE as Administrator to let your phone reach the backend + Metro.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="DocuVerify Backend 8000" >nul 2>&1
netsh advfirewall firewall add rule name="DocuVerify Backend 8000" dir=in action=allow protocol=TCP localport=8000 profile=any

netsh advfirewall firewall delete rule name="DocuVerify Metro" >nul 2>&1
netsh advfirewall firewall add rule name="DocuVerify Metro" dir=in action=allow protocol=TCP localport=8081,8082,19000,19001,19002 profile=any

echo.
echo Done: port 8000 (backend) and the Expo/Metro ports are now allowed inbound.
pause