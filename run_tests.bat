@echo off
setlocal enabledelayedexpansion

cd /d "C:\Users\RA store\study-planner"

echo ===== COMMAND 1: npm.cmd install --save-dev @playwright/test =====
echo Command: npm.cmd install --save-dev @playwright/test
npm.cmd install --save-dev @playwright/test
echo Exit Code: !ERRORLEVEL!
echo.

echo ===== COMMAND 2: npm.cmd run lint =====
echo Command: npm.cmd run lint
npm.cmd run lint
echo Exit Code: !ERRORLEVEL!
echo.

echo ===== COMMAND 3: npm.cmd run build =====
echo Command: npm.cmd run build
npm.cmd run build
echo Exit Code: !ERRORLEVEL!
echo.

echo ===== COMMAND 4: npx playwright test --list =====
echo Command: npx playwright test --list
npx playwright test --list
echo Exit Code: !ERRORLEVEL!
echo.

echo ===== COMMAND 5: npm.cmd run test:e2e (running in background) =====
echo Command: npm.cmd run test:e2e
npm.cmd run test:e2e
echo Exit Code: !ERRORLEVEL!
echo.

endlocal
