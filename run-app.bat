@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.12 or newer, then try again.
  pause
  exit /b 1
)

if not exist "backend\env" (
  echo Missing backend\env. Copy backend\.env.example to backend\env and set MONGO_URI.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting API on port 3001...
  start "PC Build API" /D "%~dp0backend" cmd /k "node --env-file=env server.js"
) else (
  echo API is already running on port 3001.
)

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting website on port 5173...
  start "PC Build Web" /D "%~dp0" cmd /k "npm run dev -w frontend -- --host 127.0.0.1"
) else (
  echo Website is already running on port 5173.
)

echo Waiting for the website to start...
timeout /t 3 /nobreak >nul
echo Press any key to open the website...
pause >nul
start "" "http://127.0.0.1:5173"
echo.
echo The website is at http://127.0.0.1:5173
echo Leave the API and Web command windows open while you use it.

