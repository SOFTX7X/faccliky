@echo off
title Faccliky API
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
:loop
node server.js
echo Servidor parou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
