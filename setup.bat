@echo off
echo ========================================
echo Setting up Mediclaim System...
echo ========================================

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if .env files exist
REM Backend .env should be configured manually

if not exist "frontend\.env" (
    echo Setting up frontend environment...
    copy "frontend\.env.example" "frontend\.env"
    echo NOTE: Please edit frontend/.env with your Supabase credentials
)

echo Building and starting services...
docker-compose up --build -d

echo ========================================
echo Setup Complete!
echo ========================================
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo Admin Panel: http://localhost:8000/admin
echo ========================================
echo Note: If this is your first time running, 
echo please configure the .env files with proper credentials
echo ========================================

pause