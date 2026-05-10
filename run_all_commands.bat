@echo off
setlocal enabledelayedexpansion

REM Change to the working directory
cd /d "C:\Users\RA store\study-planner"

REM Create output files
set outfile=C:\Users\RA store\study-planner\command_output.txt
set errorfile=C:\Users\RA store\study-planner\command_errors.txt

> "%outfile%" echo Command Execution Log - %date% %time%
> "%errorfile%" echo Error Log - %date% %time%

REM ===== COMMAND 1 =====
echo. >> "%outfile%"
echo ===== COMMAND 1: npm.cmd install --save-dev @playwright/test ===== >> "%outfile%"
echo %date% %time%: Starting Command 1 >> "%outfile%"

call npm.cmd install --save-dev @playwright/test >> "%outfile%" 2>> "%errorfile%"
set cmd1_exit=!ERRORLEVEL!
echo Exit Code: !cmd1_exit! >> "%outfile%"

REM ===== COMMAND 2 =====
echo. >> "%outfile%"
echo ===== COMMAND 2: npm.cmd run lint ===== >> "%outfile%"
echo %date% %time%: Starting Command 2 >> "%outfile%"

call npm.cmd run lint >> "%outfile%" 2>> "%errorfile%"
set cmd2_exit=!ERRORLEVEL!
echo Exit Code: !cmd2_exit! >> "%outfile%"

REM ===== COMMAND 3 =====
echo. >> "%outfile%"
echo ===== COMMAND 3: npm.cmd run build ===== >> "%outfile%"
echo %date% %time%: Starting Command 3 >> "%outfile%"

call npm.cmd run build >> "%outfile%" 2>> "%errorfile%"
set cmd3_exit=!ERRORLEVEL!
echo Exit Code: !cmd3_exit! >> "%outfile%"

REM ===== COMMAND 4 =====
echo. >> "%outfile%"
echo ===== COMMAND 4: npx playwright test --list ===== >> "%outfile%"
echo %date% %time%: Starting Command 4 >> "%outfile%"

call npx playwright test --list >> "%outfile%" 2>> "%errorfile%"
set cmd4_exit=!ERRORLEVEL!
echo Exit Code: !cmd4_exit! >> "%outfile%"

REM ===== COMMAND 5 =====
echo. >> "%outfile%"
echo ===== COMMAND 5: npm.cmd run test:e2e ===== >> "%outfile%"
echo %date% %time%: Starting Command 5 >> "%outfile%"

call npm.cmd run test:e2e >> "%outfile%" 2>> "%errorfile%"
set cmd5_exit=!ERRORLEVEL!
echo Exit Code: !cmd5_exit! >> "%outfile%"

echo.
echo All commands completed.
echo Command 1 exit code: !cmd1_exit!
echo Command 2 exit code: !cmd2_exit!
echo Command 3 exit code: !cmd3_exit!
echo Command 4 exit code: !cmd4_exit!
echo Command 5 exit code: !cmd5_exit!

endlocal
