@echo off
setlocal EnableDelayedExpansion
title XO Inventory

echo.
echo  ================================================
echo   XO Inventory - Starting up
echo  ================================================
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if !errorlevel! neq 0 (
        echo  ERROR: Python not found.
        echo  Install from https://www.python.org/downloads/
        echo  Make sure to check "Add Python to PATH" during install.
        pause & exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

:: Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js not found.
    echo  Install from https://nodejs.org ^(LTS version^)
    pause & exit /b 1
)

echo  Checking Python dependencies...
%PYTHON% -m pip install -q fastapi uvicorn httpx websockets python-dotenv 2>nul
if %errorlevel% neq 0 (
    %PYTHON% -m pip install fastapi uvicorn httpx websockets python-dotenv --user
)

echo  Building frontend...
cd /d "%~dp0frontend"
call npm install --silent
call npm run build
if %errorlevel% neq 0 (
    echo  ERROR: Frontend build failed.
    pause & exit /b 1
)

echo.
echo  ================================================
echo   Open  ^-^>  http://localhost:7755
echo   Stop  ^-^>  Ctrl+C
echo  ================================================
echo.

cd /d "%~dp0backend"
%PYTHON% -m uvicorn api.main:app --host 0.0.0.0 --port 7755

pause
