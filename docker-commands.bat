@echo off
echo ========================================
echo Mediclaim System - Docker Commands
echo ========================================
echo.
echo 1. Start services (development)
echo    docker-compose up -d
echo.
echo 2. Stop services
echo    docker-compose down
echo.
echo 3. View logs
echo    docker-compose logs -f
echo.
echo 4. Rebuild and restart
echo    docker-compose up --build -d
echo.
echo 5. Production mode
echo    docker-compose -f docker-compose.prod.yml up -d
echo.
echo 6. Clean up (remove all containers and volumes)
echo    docker-compose down -v --remove-orphans
echo    docker system prune -af
echo.
echo 7. Access backend shell
echo    docker exec -it mediclaim-backend bash
echo.
echo 8. Access frontend shell  
echo    docker exec -it mediclaim-frontend sh
echo.
echo 9. View container status
echo    docker ps
echo.
echo ========================================

:menu
echo.
set /p choice="Enter command number (1-9) or 'q' to quit: "

if "%choice%"=="1" (
    docker-compose up -d
    goto menu
)
if "%choice%"=="2" (
    docker-compose down
    goto menu
)
if "%choice%"=="3" (
    docker-compose logs -f
    goto menu
)
if "%choice%"=="4" (
    docker-compose up --build -d
    goto menu
)
if "%choice%"=="5" (
    docker-compose -f docker-compose.prod.yml up -d
    goto menu
)
if "%choice%"=="6" (
    docker-compose down -v --remove-orphans
    docker system prune -af
    goto menu
)
if "%choice%"=="7" (
    docker exec -it mediclaim-backend bash
    goto menu
)
if "%choice%"=="8" (
    docker exec -it mediclaim-frontend sh
    goto menu
)
if "%choice%"=="9" (
    docker ps
    goto menu
)
if "%choice%"=="q" (
    echo Goodbye!
    exit /b 0
)

echo Invalid choice. Please try again.
goto menu