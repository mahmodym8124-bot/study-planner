@echo off
REM Comprehensive test execution script with health endpoint probing
REM Run from: C:\Users\RA store\study-planner

setlocal enabledelayedexpansion

set REPO_DIR=C:\Users\RA store\study-planner
set LOG_FILE=%REPO_DIR%\execution_report.txt
set PROBES_LOG=%REPO_DIR%\health_probes.txt

cd /d "%REPO_DIR%"

REM Initialize log files
(
    echo ===================================================================
    echo COMMAND EXECUTION REPORT
    echo ===================================================================
    echo Timestamp: %date% %time%
    echo Working Directory: %cd%
    echo.
) > "%LOG_FILE%"

(
    echo ===================================================================
    echo HEALTH ENDPOINT PROBES (during e2e test run)
    echo ===================================================================
) > "%PROBES_LOG%"

REM ===== COMMAND 1: npm.cmd install --save-dev @playwright/test =====
echo.
echo [1/5] npm.cmd install --save-dev @playwright/test
echo. >> "%LOG_FILE%"
echo ===== COMMAND 1: npm.cmd install --save-dev @playwright/test ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"

call npm.cmd install --save-dev @playwright/test >> "%LOG_FILE%" 2>&1
set CMD1_EXIT=!ERRORLEVEL!
echo Exit Code: !CMD1_EXIT! >> "%LOG_FILE%"
echo.

REM ===== COMMAND 2: npm.cmd run lint =====
echo [2/5] npm.cmd run lint
echo. >> "%LOG_FILE%"
echo ===== COMMAND 2: npm.cmd run lint ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"

call npm.cmd run lint >> "%LOG_FILE%" 2>&1
set CMD2_EXIT=!ERRORLEVEL!
echo Exit Code: !CMD2_EXIT! >> "%LOG_FILE%"
echo.

REM ===== COMMAND 3: npm.cmd run build =====
echo [3/5] npm.cmd run build
echo. >> "%LOG_FILE%"
echo ===== COMMAND 3: npm.cmd run build ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"

call npm.cmd run build >> "%LOG_FILE%" 2>&1
set CMD3_EXIT=!ERRORLEVEL!
echo Exit Code: !CMD3_EXIT! >> "%LOG_FILE%"
echo.

REM ===== COMMAND 4: npx playwright test --list =====
echo [4/5] npx playwright test --list
echo. >> "%LOG_FILE%"
echo ===== COMMAND 4: npx playwright test --list ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"

call npx playwright test --list >> "%LOG_FILE%" 2>&1
set CMD4_EXIT=!ERRORLEVEL!
echo Exit Code: !CMD4_EXIT! >> "%LOG_FILE%"
echo.

REM ===== COMMAND 5: npm.cmd run test:e2e (with concurrent health probes) =====
echo [5/5] npm.cmd run test:e2e (with health probes)
echo. >> "%LOG_FILE%"
echo ===== COMMAND 5: npm.cmd run test:e2e ===== >> "%LOG_FILE%"
echo Timestamp: %date% %time% >> "%LOG_FILE%"

REM Start test:e2e in background and capture its PID
start "e2e_tests" /b cmd /c "cd /d "%REPO_DIR%" && npm.cmd run test:e2e >> "%LOG_FILE%" 2>&1"

REM Give servers time to start (Playwright webServer timeout is 120s, but we probe earlier)
timeout /t 3 /nobreak

REM Probe health endpoints while test is running
for /L %%i in (1,1,20) do (
    set PROBE_TIME=!date! !time!
    
    REM Probe API health endpoint
    echo [Probe %%i] Attempting API health check at !PROBE_TIME! >> "%PROBES_LOG%"
    powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8091/api/health' -TimeoutSec 5 -ErrorAction Stop; Write-Output \"Status: $($r.StatusCode) | Body: $($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length)))\" } catch { Write-Output \"Error: $($_.Exception.Message)\" }" >> "%PROBES_LOG%" 2>&1
    
    REM Probe Web health endpoint
    echo [Probe %%i] Attempting Web health check at !PROBE_TIME! >> "%PROBES_LOG%"
    powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173/api/health' -TimeoutSec 5 -ErrorAction Stop; Write-Output \"Status: $($r.StatusCode) | Body: $($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length)))\" } catch { Write-Output \"Error: $($_.Exception.Message)\" }" >> "%PROBES_LOG%" 2>&1
    
    timeout /t 5 /nobreak
)

REM Wait for e2e tests to complete (max 10 minutes)
echo Waiting for e2e tests to complete... (max 10 minutes)
timeout /t 600 /nobreak

REM Check if e2e tests still running and get the result
set CMD5_EXIT=0
call npm.cmd run test:e2e >> "%LOG_FILE%" 2>&1
set CMD5_EXIT=!ERRORLEVEL!

echo Exit Code: !CMD5_EXIT! >> "%LOG_FILE%"

REM ===== SUMMARY =====
echo. >> "%LOG_FILE%"
echo ===== EXECUTION SUMMARY ===== >> "%LOG_FILE%"
echo Command 1 (npm install @playwright/test): !CMD1_EXIT! >> "%LOG_FILE%"
echo Command 2 (npm run lint): !CMD2_EXIT! >> "%LOG_FILE%"
echo Command 3 (npm run build): !CMD3_EXIT! >> "%LOG_FILE%"
echo Command 4 (npx playwright test --list): !CMD4_EXIT! >> "%LOG_FILE%"
echo Command 5 (npm run test:e2e): !CMD5_EXIT! >> "%LOG_FILE%"
echo.

echo.
echo ===================================================================
echo EXECUTION COMPLETE
echo ===================================================================
echo Report saved to: %LOG_FILE%
echo Probes saved to: %PROBES_LOG%
echo.
echo Exit Codes:
echo   Command 1: !CMD1_EXIT!
echo   Command 2: !CMD2_EXIT!
echo   Command 3: !CMD3_EXIT!
echo   Command 4: !CMD4_EXIT!
echo   Command 5: !CMD5_EXIT!
echo.

endlocal
pause
