# Test Execution Instructions

This document provides multiple ways to execute the requested tests with command and health endpoint capture.

## Overview

The following 5 commands will be executed in sequence from `C:\Users\RA store\study-planner`:

1. `npm.cmd install --save-dev @playwright/test`
2. `npm.cmd run lint`
3. `npm.cmd run build`
4. `npx playwright test --list`
5. `npm.cmd run test:e2e` (with concurrent health endpoint probing)

## Execution Options

### Option 1: Windows Batch Script (Most Compatible)

**File**: `execute_tests.ps1` or `EXECUTE_TESTS_FULL.bat`

**Requirements**: Windows Command Prompt (cmd.exe)

**How to Run**:
```batch
cd C:\Users\RA store\study-planner
EXECUTE_TESTS_FULL.bat
```

**Output Files**:
- `TEST_EXECUTION_LOG.txt` - Main execution log with all command output
- `HEALTH_PROBES.txt` - Health endpoint probe results

---

### Option 2: PowerShell Script (Windows Built-in)

**File**: `execute_tests.ps1`

**Requirements**: Windows PowerShell 5.1 (built-in to Windows 10/11)

**How to Run**:
```powershell
cd "C:\Users\RA store\study-planner"
powershell -ExecutionPolicy Bypass -File execute_tests.ps1
```

**Features**:
- Concurrent health endpoint probing during test:e2e
- Colored output for better readability
- Background jobs for probing

**Output Files**:
- `TEST_EXECUTION_LOG.txt` - Main execution log
- `HEALTH_PROBES.txt` - Health endpoint probes

---

### Option 3: Python Script

**File**: `execute_tests.py`

**Requirements**: Python 3.x

**How to Run**:
```bash
cd "C:\Users\RA store\study-planner"
python execute_tests.py
```

**Features**:
- Threading-based concurrent probing
- Cross-platform compatible
- Detailed error logging

**Output Files**:
- `TEST_EXECUTION_LOG.txt` - Main execution log
- `HEALTH_PROBES.txt` - Health endpoint probes

---

### Option 4: Node.js Script

**File**: `execute_tests.js`

**Requirements**: Node.js (available in this repo)

**How to Run**:
```bash
cd "C:\Users\RA store\study-planner"
node execute_tests.js
```

**Features**:
- Uses Node.js built-in http module
- spawn() for concurrent processes
- Detailed output capture

**Output Files**:
- `TEST_EXECUTION_LOG.txt` - Main execution log
- `HEALTH_PROBES.txt` - Health endpoint probes

---

## What Each Command Does

### Command 1: `npm.cmd install --save-dev @playwright/test`
Installs Playwright test framework as a dev dependency.

**Expected Output**: NPM install messages

---

### Command 2: `npm.cmd run lint`
Runs ESLint to check code quality.

**Expected Output**: Lint results (files checked, errors if any)

---

### Command 3: `npm.cmd run build`
Builds the Vite frontend for production.

**Expected Output**: Build artifacts created in `dist/` directory

---

### Command 4: `npx playwright test --list`
Lists all available Playwright tests.

**Expected Output**: Test file paths and test names

---

### Command 5: `npm.cmd run test:e2e`
Runs end-to-end tests using Playwright.

**During Execution**:
- Playwright automatically starts:
  - API server on port 8091
  - Web client on port 5173
- Health probes continuously check both endpoints:
  - `http://localhost:8091/api/health`
  - `http://localhost:5173/api/health`
- Tests run signup, login, notes, focus, and persistence flows

**Expected Output**: Test results with pass/fail status

---

## Log File Locations

After execution, check these files for results:

### TEST_EXECUTION_LOG.txt
Contains:
- Full stdout/stderr for all 5 commands
- Exit codes for each command
- Command execution timestamps
- Error messages if any

### HEALTH_PROBES.txt
Contains:
- Timestamps of each probe attempt
- HTTP status codes received
- Response body snippets
- Errors if endpoints unreachable
- Captured during test:e2e execution only

---

## Exit Codes

- **0** = Success
- **Non-zero** = Failure

Check `TEST_EXECUTION_LOG.txt` for detailed error information.

---

## Troubleshooting

### Port Already in Use
If ports 8091 or 5173 are already in use:
```bash
# Kill existing processes
netstat -ano | findstr :8091
taskkill /PID <PID> /F

netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### MongoDB Connection Error
If tests fail with MongoDB errors:
- Ensure `MONGODB_URI` environment variable is set in `.env`
- Check that MongoDB server is running
- The test:e2e run uses a separate database: `study-planner-e2e`

### Node/NPM Not Found
Ensure Node.js is installed and in PATH:
```bash
node --version
npm --version
```

### Playwright Installation Issues
```bash
npm.cmd install --save-dev @playwright/test
npx playwright install
```

---

## Running Manually (Step by Step)

If you prefer to run commands individually:

```batch
cd "C:\Users\RA store\study-planner"

REM Step 1
npm.cmd install --save-dev @playwright/test

REM Step 2
npm.cmd run lint

REM Step 3
npm.cmd run build

REM Step 4
npx playwright test --list

REM Step 5
npm.cmd run test:e2e
```

---

## Health Endpoint Details

### API Health Endpoint
- **URL**: `http://localhost:8091/api/health`
- **Expected Status**: 200 OK
- **Expected Body**: JSON with health information

### Web Health Endpoint
- **URL**: `http://localhost:5173/api/health`
- **Expected Status**: 200 OK
- **Expected Body**: JSON or text health status

### Probe Frequency
- Probes start after 3-second delay (allowing servers to initialize)
- Probes run every 5 seconds
- Maximum 15 probes (~75 seconds total probing duration)

---

## Parsing Results

To extract key information from logs:

```bash
# View main execution log
type TEST_EXECUTION_LOG.txt

# View health probes
type HEALTH_PROBES.txt

# Find specific command exit codes
findstr "Exit Code:" TEST_EXECUTION_LOG.txt

# Find errors
findstr /i "error" TEST_EXECUTION_LOG.txt

# Find health probe statuses
findstr "Status:" HEALTH_PROBES.txt
```

---

## Additional Notes

- The entire test execution may take 5-15 minutes
- Playwright tests can be flaky; initial timeout is 60 seconds per test
- Retries are disabled in CI mode (enabled in this environment)
- All commands continue even if one fails
- Health probes are non-blocking and don't affect test execution

---

## Support

For detailed output, refer to the generated log files:
- **TEST_EXECUTION_LOG.txt** - Complete command output and errors
- **HEALTH_PROBES.txt** - Endpoint health during test run
