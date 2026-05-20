@echo off
setlocal

echo.
echo  MarketSounding Dev Servers
echo  ==========================
echo  Backend  -^> http://localhost:3001
echo  Frontend -^> http://localhost:3000
echo.
echo  Press Ctrl+C in either window to stop that server.
echo  Close this window to stop both.
echo.

:: Kill anything already on port 3001 (stale backend)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%p /F >nul 2>&1
)

:: Start backend in a new window
start "MarketSounding Backend (port 3001)" cmd /k "cd /d %~dp0backend && npm run dev"

:: Give the backend 2 seconds to start before launching the browser
timeout /t 2 /nobreak >nul

:: Start frontend in a new window
start "MarketSounding Frontend (port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Open browser after giving Next.js ~5 seconds to compile
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo  Both servers started. This window can be closed.
echo.
pause
