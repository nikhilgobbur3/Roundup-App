@echo off
title RoundUp - Expo Go Dev Server
cd /d "%~dp0"
echo ============================================
echo   RoundUp Expo Go Dev Server
echo ============================================
echo.
echo  Keep this window OPEN while using Expo Go.
echo  Scan the QR code below on your phone (Expo Go).
echo  Phone and laptop must be on the same Wi-Fi.
echo.
echo  Tip: when Expo Go says "Something went wrong",
echo  tap Reload or rescan this window's QR.
echo.
call npx expo start --lan
echo.
echo  Expo server closed.
pause
