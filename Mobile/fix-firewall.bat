@echo off
title RoundUp - Fix Expo Firewall (Run once)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    echo When the UAC prompt appears, click YES.
    echo.
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
echo Adding firewall rule: Expo Metro (port 8081)...
netsh advfirewall firewall add rule name="Expo Metro 8081" dir=in action=allow protocol=TCP localport=8081 profile=any
echo.
echo Done. You can close this window.
echo Now double-click start-expo.bat and scan its QR in Expo Go.
pause
