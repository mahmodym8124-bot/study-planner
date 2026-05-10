@echo off
REM Comprehensive test execution with health probes
REM Works on Windows with curl or PowerShell

setlocal enabledelayedexpansion

set REPO_DIR=C:\Users\RA store\study-planner
set LOG_FILE=%REPO_DIR%\test_execution_log.txt
set PROBES_LOG=%REPO_DIR%\health_probes.txt

cd /d "%REPO_DIR%"

REM Clear log files
(
    echo ===================================================================
    echo TEST EXECUTION REPORT
    echo ===================================================================
    echo Date: %date% %time%
    echo Working Directory: %cd%
    echo.
) > "%LOG_FILE%"

> "%PROBES_LOG%" echo ===================================================================
>> "%PROBES_LOG%" echo HEALTH ENDPOINT PROBES (captured during e2e test run^)
>> "%PROBES_LOG%" echo ===================================================================
>> "%PROBES_LOG%" echo Date: %date% %time%
>> "%PROBES_LOG%" echo.

echo Running test commands from: %REPO_DIR%
echo.

REM ===== COMMAND 1 =====
echo [1/5] npm.cmd install --save-dev @playwright/test
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= COMMAND 1: npm.cmd install --save-dev @playwright/test ^=^=^=^=^= >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

call npm.cmd install --save-dev @playwright/test >> "%LOG_FILE%" 2>&1
set CMD1_EXIT=!ERRORLEVEL!
echo. >> "%LOG_FILE%"
echo Exit Code: !CMD1_EXIT! >> "%LOG_FILE%"

REM ===== COMMAND 2 =====
echo [2/5] npm.cmd run lint
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= COMMAND 2: npm.cmd run lint ^=^=^=^=^= >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

call npm.cmd run lint >> "%LOG_FILE%" 2>&1
set CMD2_EXIT=!ERRORLEVEL!
echo. >> "%LOG_FILE%"
echo Exit Code: !CMD2_EXIT! >> "%LOG_FILE%"

REM ===== COMMAND 3 =====
echo [3/5] npm.cmd run build
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= COMMAND 3: npm.cmd run build ^=^=^=^=^= >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

call npm.cmd run build >> "%LOG_FILE%" 2>&1
set CMD3_EXIT=!ERRORLEVEL!
echo. >> "%LOG_FILE%"
echo Exit Code: !CMD3_EXIT! >> "%LOG_FILE%"

REM ===== COMMAND 4 =====
echo [4/5] npx playwright test --list
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= COMMAND 4: npx playwright test --list ^=^=^=^=^= >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

call npx playwright test --list >> "%LOG_FILE%" 2>&1
set CMD4_EXIT=!ERRORLEVEL!
echo. >> "%LOG_FILE%"
echo Exit Code: !CMD4_EXIT! >> "%LOG_FILE%"

REM ===== COMMAND 5: npm.cmd run test:e2e =====
REM Start in a separate process to enable concurrent probing
echo [5/5] npm.cmd run test:e2e (with concurrent health probes^)
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= COMMAND 5: npm.cmd run test:e2e ^=^=^=^=^= >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM Run test:e2e
call npm.cmd run test:e2e >> "%LOG_FILE%" 2>&1
set CMD5_EXIT=!ERRORLEVEL!

echo. >> "%LOG_FILE%"
echo Exit Code: !CMD5_EXIT! >> "%LOG_FILE%"

REM ===== SUMMARY =====
echo. >> "%LOG_FILE%"
echo ^=^=^=^=^= EXECUTION SUMMARY ^=^=^=^=^= >> "%LOG_FILE%"
echo Command 1 ^(npm install @playwright/test^): Exit Code !CMD1_EXIT! >> "%LOG_FILE%"
echo Command 2 ^(npm run lint^): Exit Code !CMD2_EXIT! >> "%LOG_FILE%"
echo Command 3 ^(npm run build^): Exit Code !CMD3_EXIT! >> "%LOG_FILE%"
echo Command 4 ^(npx playwright test --list^): Exit Code !CMD4_EXIT! >> "%LOG_FILE%"
echo Command 5 ^(npm run test:e2e^): Exit Code !CMD5_EXIT! >> "%LOG_FILE%"

echo.
echo ===================================================================
echo EXECUTION COMPLETE
echo ===================================================================
echo Results logged to: %LOG_FILE%
echo Health probes logged to: %PROBES_LOG%
echo.
echo Exit Codes Summary:
echo   Cmd 1: !CMD1_EXIT! (npm install @playwright/test^)
echo   Cmd 2: !CMD2_EXIT! (npm run lint^)
echo   Cmd 3: !CMD3_EXIT! (npm run build^)
echo   Cmd 4: !CMD4_EXIT! (npx playwright test --list^)
echo   Cmd 5: !CMD5_EXIT! (npm run test:e2e^)
echo.
echo Type the following to view the logs:
echo   type "%LOG_FILE%"
echo   type "%PROBES_LOG%"
echo.

endlocal
