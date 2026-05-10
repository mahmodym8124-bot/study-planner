@echo off
REM =====================================================================
REM TEST EXECUTION SCRIPT WITH HEALTH ENDPOINT PROBING
REM =====================================================================
REM
REM This script executes all 5 commands in sequence:
REM 1. npm.cmd install --save-dev @playwright/test
REM 2. npm.cmd run lint
REM 3. npm.cmd run build
REM 4. npx playwright test --list
REM 5. npm.cmd run test:e2e (with concurrent health probes)
REM
REM Run this from Command Prompt (cmd.exe) in Windows
REM Usage: execute_full_test.bat
REM

setlocal enabledelayedexpansion

set "REPO_DIR=C:\Users\RA store\study-planner"
set "LOG_FILE=%REPO_DIR%\TEST_EXECUTION_LOG.txt"
set "PROBES_FILE=%REPO_DIR%\HEALTH_PROBES.txt"

cd /d "%REPO_DIR%" || exit /b 1

REM Initialize log files
(
    echo =====================================================================
    echo TEST EXECUTION REPORT - %date% %time%
    echo =====================================================================
    echo Working Directory: %cd%
    echo Node Version:
) > "%LOG_FILE%"

node -v >> "%LOG_FILE%" 2>&1
npm -v >> "%LOG_FILE%" 2>&1

(
    echo.
    echo =====================================================================
) >> "%LOG_FILE%"

(
    echo =====================================================================
    echo HEALTH ENDPOINT PROBES - %date% %time%
    echo =====================================================================
    echo These probes are captured during test:e2e execution
    echo Endpoints probed:
    echo   - http://localhost:8091/api/health (API Server)
    echo   - http://localhost:5173/api/health (Web Server)
    echo.
) > "%PROBES_FILE%"

REM Function macro to run commands
set "RUN_CMD=call :run_command"

REM ===== COMMAND 1 =====
echo [1/5] Installing @playwright/test...
%RUN_CMD% 1 "npm.cmd install --save-dev @playwright/test" "npm install @playwright/test"
if !CMD_EXIT! neq 0 echo ⚠ Command 1 failed with exit code !CMD_EXIT!
echo.

REM ===== COMMAND 2 =====
echo [2/5] Running lint...
%RUN_CMD% 2 "npm.cmd run lint" "npm run lint"
if !CMD_EXIT! neq 0 echo ⚠ Command 2 failed with exit code !CMD_EXIT!
echo.

REM ===== COMMAND 3 =====
echo [3/5] Running build...
%RUN_CMD% 3 "npm.cmd run build" "npm run build"
if !CMD_EXIT! neq 0 echo ⚠ Command 3 failed with exit code !CMD_EXIT!
echo.

REM ===== COMMAND 4 =====
echo [4/5] Listing Playwright tests...
%RUN_CMD% 4 "npx playwright test --list" "npx playwright test --list"
if !CMD_EXIT! neq 0 echo ⚠ Command 4 failed with exit code !CMD_EXIT!
echo.

REM ===== COMMAND 5 WITH PROBES =====
echo [5/5] Running e2e tests (probes will run concurrently in separate window)...
call :run_command_with_probes
echo.

REM ===== SUMMARY =====
(
    echo.
    echo =====================================================================
    echo EXECUTION SUMMARY
    echo =====================================================================
) >> "%LOG_FILE%"

echo =====================================================================
echo EXECUTION COMPLETE
echo =====================================================================
echo.
echo Log Files Created:
echo   Main Report:    %LOG_FILE%
echo   Health Probes:  %PROBES_FILE%
echo.
echo To view results:
echo   Main log:   type "%LOG_FILE%"
echo   Probes log: type "%PROBES_FILE%"
echo.

endlocal
exit /b 0

REM ===== FUNCTION: run_command =====
:run_command
set CMD_NUM=%1
set CMD_EXEC=%2
set CMD_DESC=%3

echo. >> "%LOG_FILE%"
echo ===== COMMAND %CMD_NUM%: %CMD_DESC% ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

%CMD_EXEC% >> "%LOG_FILE%" 2>&1
set CMD_EXIT=!ERRORLEVEL!

echo. >> "%LOG_FILE%"
echo Exit Code: !CMD_EXIT! >> "%LOG_FILE%"
exit /b !CMD_EXIT!

REM ===== FUNCTION: run_command_with_probes =====
:run_command_with_probes
set CMD_NUM=5

echo. >> "%LOG_FILE%"
echo ===== COMMAND %CMD_NUM%: npm run test:e2e ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"
echo Note: Health probes running concurrently >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM Run test:e2e
npm.cmd run test:e2e >> "%LOG_FILE%" 2>&1
set CMD_EXIT=!ERRORLEVEL!

echo. >> "%LOG_FILE%"
echo Exit Code: !CMD_EXIT! >> "%LOG_FILE%"
exit /b !CMD_EXIT!
