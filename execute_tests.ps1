# Test Execution Script for Windows
# Compatible with Windows PowerShell 5.1 (built-in)
# Usage: powershell -ExecutionPolicy Bypass -File execute_tests.ps1

param(
    [switch]$NoProbes = $false
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$REPO_DIR = "C:\Users\RA store\study-planner"
$LOG_FILE = Join-Path $REPO_DIR "TEST_EXECUTION_LOG.txt"
$PROBES_FILE = Join-Path $REPO_DIR "HEALTH_PROBES.txt"

# Initialize log files
$header = @"
=====================================================================
TEST EXECUTION REPORT - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
=====================================================================
Working Directory: $REPO_DIR
Node Version: $(node -v)
NPM Version: $(npm -v)
PowerShell Version: $($PSVersionTable.PSVersion)
=====================================================================

"@

$header | Out-File -FilePath $LOG_FILE -Encoding UTF8
$header | Out-File -FilePath $PROBES_FILE -Encoding UTF8

function Write-Command {
    param(
        [int]$Number,
        [string]$Command,
        [string]$Description
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $divider = "=" * 70
    
    Write-Host "`n[$Number/5] $Description" -ForegroundColor Cyan
    Write-Host "Command: $Command" -ForegroundColor Gray
    Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
    
    $logEntry = "`n$divider`nCOMMAND $Number : $Description`n$divider`nTimestamp: $timestamp`nCommand: $Command`n`n"
    Add-Content -Path $LOG_FILE -Value $logEntry
    
    return $timestamp
}

function Run-Command {
    param(
        [int]$Number,
        [string]$Command,
        [string]$Description
    )
    
    Write-Command -Number $Number -Command $Command -Description $Description
    
    try {
        $output = & cmd.exe /c $Command 2>&1
        $exitCode = $LASTEXITCODE
        
        # Write output to log
        $output | Add-Content -Path $LOG_FILE
        
        Add-Content -Path $LOG_FILE -Value "`nExit Code: $exitCode`n"
        
        if ($exitCode -eq 0) {
            Write-Host "✓ Success (Exit Code: 0)" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed (Exit Code: $exitCode)" -ForegroundColor Red
        }
        
        return $exitCode
    }
    catch {
        $errorMsg = $_.Exception.Message
        Add-Content -Path $LOG_FILE -Value "Error: $errorMsg`n"
        Write-Host "✗ Error: $errorMsg" -ForegroundColor Red
        return 1
    }
}

function Probe-Endpoint {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 5
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        $body = $response.Content.Substring(0, [Math]::Min(150, $response.Content.Length))
        
        $result = "[OK] Status: $statusCode | URL: $Url | Timestamp: $timestamp | Body: $body"
    }
    catch {
        $errorMsg = $_.Exception.Message
        $result = "[ERROR] URL: $Url | Timestamp: $timestamp | Error: $errorMsg"
    }
    
    return $result
}

function Run-Probes {
    $probeCount = 0
    $maxProbes = 15
    $probeIntervalSeconds = 5
    
    Add-Content -Path $PROBES_FILE -Value "`nStarting concurrent health endpoint probes..."
    
    while ($probeCount -lt $maxProbes) {
        $probeCount++
        $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        
        $apiProbe = Probe-Endpoint -Url "http://localhost:8091/api/health"
        $webProbe = Probe-Endpoint -Url "http://localhost:5173/api/health"
        
        $probeEntry = @"
[Probe $probeCount] [$timestamp]
API (8091): $apiProbe
Web (5173): $webProbe

"@
        
        Add-Content -Path $PROBES_FILE -Value $probeEntry
        Write-Host "[Probe $probeCount] API: $(if ($apiProbe -match '\[OK\]') { '✓' } else { '✗' }) | Web: $(if ($webProbe -match '\[OK\]') { '✓' } else { '✗' })" -ForegroundColor Yellow
        
        Start-Sleep -Seconds $probeIntervalSeconds
    }
}

# Main execution
try {
    Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
    Write-Host "TEST EXECUTION SCRIPT" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    
    # Commands 1-4 (no probes)
    $exits = @()
    $exits += Run-Command -Number 1 -Command "npm.cmd install --save-dev @playwright/test" -Description "npm install @playwright/test"
    $exits += Run-Command -Number 2 -Command "npm.cmd run lint" -Description "npm run lint"
    $exits += Run-Command -Number 3 -Command "npm.cmd run build" -Description "npm run build"
    $exits += Run-Command -Number 4 -Command "npx playwright test --list" -Description "npx playwright test --list"
    
    # Command 5 with concurrent probes
    Write-Command -Number 5 -Command "npm.cmd run test:e2e" -Description "npm run test:e2e (with concurrent health probes)"
    
    # Run probes in background job
    if (-not $NoProbes) {
        $probeJob = Start-Job -ScriptBlock ${function:Run-Probes}
        Write-Host "Probes started in background job" -ForegroundColor Yellow
    }
    
    # Run test:e2e
    Write-Host "Starting e2e tests..." -ForegroundColor Yellow
    $output = & cmd.exe /c "npm.cmd run test:e2e" 2>&1
    $exits += $LASTEXITCODE
    
    $output | Add-Content -Path $LOG_FILE
    Add-Content -Path $LOG_FILE -Value "`nExit Code: $($exits[-1])`n"
    
    # Wait for probes to complete
    if (-not $NoProbes) {
        Write-Host "Waiting for probes to complete..." -ForegroundColor Yellow
        Wait-Job -Job $probeJob | Out-Null
    }
    
    # Summary
    Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
    Write-Host "EXECUTION SUMMARY" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    
    for ($i = 0; $i -lt $exits.Count; $i++) {
        $num = $i + 1
        $code = $exits[$i]
        $status = if ($code -eq 0) { "✓ SUCCESS" } else { "✗ FAILED" }
        Write-Host "Command $num : Exit Code $code ($status)" -ForegroundColor $(if ($code -eq 0) { "Green" } else { "Red" })
    }
    
    Write-Host "`nReports saved to:" -ForegroundColor Cyan
    Write-Host "  Main log:    $LOG_FILE" -ForegroundColor Gray
    Write-Host "  Health log:  $PROBES_FILE" -ForegroundColor Gray
    
    Write-Host "`n✓ Execution complete!`n" -ForegroundColor Green
}
catch {
    Write-Host "`n✗ Fatal Error: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}
