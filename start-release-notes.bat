@echo off
setlocal

cd /d "%~dp0release-notes"
if errorlevel 1 (
  echo Nao foi possivel acessar a pasta release-notes.
  pause
  exit /b 1
)

if not exist "server.js" (
  echo Arquivo server.js nao encontrado em %cd%.
  pause
  exit /b 1
)

start "" "http://localhost:3030"
node --experimental-sqlite server.js

endlocal
