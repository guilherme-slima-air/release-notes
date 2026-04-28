@echo off
setlocal

cd /d "%~dp0"
if errorlevel 1 (
  echo Nao foi possivel acessar a pasta do projeto.
  pause
  exit /b 1
)

if not exist "server.js" (
  echo Arquivo server.js nao encontrado em %cd%.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependencias nao encontradas. Executando npm install...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

start "" "http://localhost:3030"
node --experimental-sqlite server.js

endlocal
