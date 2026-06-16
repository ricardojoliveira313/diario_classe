@echo off
title Diario de Classe 2026
color 0A

echo.
echo  ================================================
echo   DIARIO DE CLASSE 2026 - Iniciando...
echo  ================================================
echo.

cd /d "%~dp0"

echo  [1/5] Instalando dependencias do backend...
cd backend
call npm install

echo.
echo  [2/5] Criando banco de dados...
call npx prisma db push

echo.
echo  [3/5] Instalando dependencias do frontend...
cd frontend
call npm install

echo.
echo  [4/5] Iniciando backend...
cd ..\backend
start "Backend" cmd /k "npm run dev"

echo.
echo  [5/5] Iniciando frontend...
cd ..\frontend
start "Frontend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:5174

echo.
echo  Sistema iniciado! Acesse: http://localhost:5174
pause
