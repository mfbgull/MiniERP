@echo off
echo ====================================
echo Starting Mini ERP System...
echo ====================================
echo.

echo [1/2] Starting Backend Server...
cd server
start "Mini ERP Backend" cmd /k "npm start"
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend...
cd ..\client
start "Mini ERP Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo ====================================
echo Mini ERP Started Successfully!
echo ====================================
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo ====================================
echo.
echo Press any key to exit...
pause > nul
