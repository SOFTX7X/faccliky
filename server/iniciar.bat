@echo off
title Faccliky API
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
if not exist .env node configurar.js
if not exist .env (
  echo Configuracao nao concluida.
  pause
  exit /b
)
:loop
node server.js
echo Servidor parou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
