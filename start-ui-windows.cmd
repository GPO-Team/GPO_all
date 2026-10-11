@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.19 or newer, then run this file again.
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || major === 22 && minor >= 19 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 22.19 or newer is required. Please update Node.js and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm, then run this file again.
  pause
  exit /b 1
)

if not exist "package-lock.json" (
  echo package-lock.json was not found in this project folder.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing project dependencies with npm ci...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the messages above and your internet connection.
    pause
    exit /b 1
  )
)

echo Starting the GPO interface...
call npm run dev
if errorlevel 1 pause
