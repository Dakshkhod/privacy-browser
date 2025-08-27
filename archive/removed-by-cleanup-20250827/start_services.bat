@echo off
echo Starting Privacy Browser Services...
echo.

echo Starting Backend Server...
cd Backend
start "Backend Server" cmd /k "python start_secure.py"

echo.
echo Starting Frontend Server...
cd ..\Frontend
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Services are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this launcher...
pause >nul 