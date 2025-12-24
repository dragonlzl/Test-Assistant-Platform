@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "PY_LAUNCHER=py -3"
%PY_LAUNCHER% -c "import sys" >nul 2>&1
if errorlevel 1 (
  set "PY_LAUNCHER=python"
  %PY_LAUNCHER% -c "import sys" >nul 2>&1
  if errorlevel 1 (
    echo Python 3 not found. Please install Python 3 and retry.
    exit /b 1
  )
)

if not exist ".venv" (
  %PY_LAUNCHER% -m venv .venv
  if errorlevel 1 exit /b 1
)

set "VENV_PY=.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
  echo Virtualenv missing at %VENV_PY%.
  exit /b 1
)

"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

if "%APP_DB_FILE%"=="" set "APP_DB_FILE=app.db"
if "%API_HOST%"=="" set "API_HOST=0.0.0.0"
if "%API_PORT%"=="" set "API_PORT=8080"
if "%RELOAD%"=="" set "RELOAD=1"

set "RELOAD_FLAG="
if "%RELOAD%"=="1" set "RELOAD_FLAG=--reload"

echo Starting API on http://%API_HOST%:%API_PORT% (DB: %APP_DB_FILE%)
"%VENV_PY%" -m uvicorn backend.main:app --host %API_HOST% --port %API_PORT% %RELOAD_FLAG%
