#!/usr/bin/env python3
"""
Test Execution Script with Health Endpoint Probing
Executes all 5 commands in sequence and probes endpoints during test:e2e
"""

import subprocess
import sys
import os
import time
import threading
import urllib.request
import json
from datetime import datetime
from pathlib import Path

# Configuration
REPO_DIR = r"C:\Users\RA store\study-planner"
LOG_FILE = os.path.join(REPO_DIR, "TEST_EXECUTION_LOG.txt")
PROBES_FILE = os.path.join(REPO_DIR, "HEALTH_PROBES.txt")

# API endpoints to probe
ENDPOINTS = [
    "http://localhost:8091/api/health",
    "http://localhost:5173/api/health"
]

class TestRunner:
    def __init__(self):
        self.results = {}
        self.probing = False
        self.probe_count = 0
        
        # Clear log files
        open(LOG_FILE, 'w').close()
        open(PROBES_FILE, 'w').close()
        
        self.write_header()
    
    def write_header(self):
        """Write header to log files"""
        header = f"""=====================================================================
TEST EXECUTION REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
=====================================================================
Working Directory: {REPO_DIR}
Python Version: {sys.version}
=====================================================================

"""
        with open(LOG_FILE, 'a') as f:
            f.write(header)
        
        probe_header = f"""=====================================================================
HEALTH ENDPOINT PROBES - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
=====================================================================
Probed endpoints:
  - http://localhost:8091/api/health (API Server)
  - http://localhost:5173/api/health (Web Server)

Probes captured during test:e2e execution.
=====================================================================

"""
        with open(PROBES_FILE, 'a') as f:
            f.write(probe_header)
    
    def log(self, message):
        """Log to both console and file"""
        print(message)
        with open(LOG_FILE, 'a') as f:
            f.write(message + '\n')
    
    def log_probe(self, message):
        """Log probe results"""
        print(f"[PROBE] {message}")
        with open(PROBES_FILE, 'a') as f:
            f.write(message + '\n')
    
    def run_command(self, cmd_num, cmd, description):
        """Execute a command and capture output"""
        self.log(f"\n{'='*70}")
        self.log(f"COMMAND {cmd_num}: {description}")
        self.log(f"{'='*70}")
        self.log(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"Command: {cmd}\n")
        
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=REPO_DIR,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            # Log stdout
            if result.stdout:
                self.log(result.stdout)
            
            # Log stderr
            if result.stderr:
                self.log("\n--- STDERR ---")
                self.log(result.stderr)
            
            exit_code = result.returncode
            self.log(f"\nExit Code: {exit_code}\n")
            
            self.results[f"cmd{cmd_num}"] = {
                "exit_code": exit_code,
                "success": exit_code == 0
            }
            
            return exit_code
        
        except subprocess.TimeoutExpired:
            self.log("ERROR: Command timeout (10 minutes)")
            self.results[f"cmd{cmd_num}"] = {"exit_code": -1, "success": False}
            return -1
        
        except Exception as e:
            self.log(f"ERROR: {str(e)}")
            self.results[f"cmd{cmd_num}"] = {"exit_code": -1, "success": False}
            return -1
    
    def probe_endpoint(self, url):
        """Probe a single endpoint"""
        try:
            req = urllib.request.Request(url, timeout=5)
            response = urllib.request.urlopen(req)
            status = response.status
            body = response.read(150).decode('utf-8', errors='ignore')
            return {
                "status": "ok",
                "code": status,
                "body": body[:100]
            }
        except urllib.error.HTTPError as e:
            return {
                "status": "http_error",
                "code": e.code,
                "body": str(e.reason)
            }
        except Exception as e:
            return {
                "status": "error",
                "code": None,
                "body": str(e)
            }
    
    def probe_endpoints_loop(self):
        """Continuously probe endpoints in background"""
        max_probes = 15
        probe_interval = 5
        self.probe_count = 0
        
        while self.probing and self.probe_count < max_probes:
            self.probe_count += 1
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            
            self.log_probe(f"\n[Probe {self.probe_count}] {timestamp}")
            
            for endpoint in ENDPOINTS:
                result = self.probe_endpoint(endpoint)
                port = "8091" if "8091" in endpoint else "5173"
                
                if result["status"] == "ok":
                    self.log_probe(
                        f"  Port {port}: HTTP {result['code']} | "
                        f"Body: {result['body']}"
                    )
                elif result["status"] == "http_error":
                    self.log_probe(
                        f"  Port {port}: HTTP {result['code']} | "
                        f"{result['body']}"
                    )
                else:
                    self.log_probe(
                        f"  Port {port}: ERROR | {result['body']}"
                    )
            
            time.sleep(probe_interval)
    
    def run_with_probes(self, cmd_num, cmd, description):
        """Run command with concurrent endpoint probing"""
        self.log(f"\n{'='*70}")
        self.log(f"COMMAND {cmd_num}: {description}")
        self.log(f"{'='*70}")
        self.log(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"Command: {cmd}")
        self.log("Note: Health probes running concurrently\n")
        
        # Start probing in background
        self.probing = True
        probe_thread = threading.Thread(target=self.probe_endpoints_loop)
        probe_thread.daemon = True
        probe_thread.start()
        
        # Wait for servers to start
        time.sleep(3)
        
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=REPO_DIR,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            # Stop probing
            self.probing = False
            probe_thread.join(timeout=5)
            
            # Log output
            if result.stdout:
                self.log(result.stdout)
            
            if result.stderr:
                self.log("\n--- STDERR ---")
                self.log(result.stderr)
            
            exit_code = result.returncode
            self.log(f"\nExit Code: {exit_code}\n")
            
            self.results[f"cmd{cmd_num}"] = {
                "exit_code": exit_code,
                "success": exit_code == 0
            }
            
            return exit_code
        
        except subprocess.TimeoutExpired:
            self.probing = False
            self.log("ERROR: Command timeout (10 minutes)")
            self.results[f"cmd{cmd_num}"] = {"exit_code": -1, "success": False}
            return -1
        
        except Exception as e:
            self.probing = False
            self.log(f"ERROR: {str(e)}")
            self.results[f"cmd{cmd_num}"] = {"exit_code": -1, "success": False}
            return -1
    
    def print_summary(self):
        """Print execution summary"""
        self.log(f"\n{'='*70}")
        self.log("EXECUTION SUMMARY")
        self.log(f"{'='*70}\n")
        
        for i in range(1, 6):
            result = self.results.get(f"cmd{i}")
            if result:
                status = "✓ SUCCESS" if result["success"] else "✗ FAILED"
                self.log(
                    f"Command {i}: Exit Code {result['exit_code']} ({status})"
                )
        
        self.log(f"\nReports saved to:")
        self.log(f"  Main log:    {LOG_FILE}")
        self.log(f"  Health log:  {PROBES_FILE}")
        self.log(f"\n✓ Execution complete!\n")
    
    def run_all(self):
        """Execute all commands"""
        print("\n" + "="*70)
        print("TEST EXECUTION SCRIPT")
        print("="*70 + "\n")
        
        # Commands 1-4
        self.run_command(1, "npm.cmd install --save-dev @playwright/test", 
                        "npm install @playwright/test")
        self.run_command(2, "npm.cmd run lint", 
                        "npm run lint")
        self.run_command(3, "npm.cmd run build", 
                        "npm run build")
        self.run_command(4, "npx playwright test --list", 
                        "npx playwright test --list")
        
        # Command 5 with probes
        self.run_with_probes(5, "npm.cmd run test:e2e", 
                            "npm run test:e2e")
        
        # Print summary
        self.print_summary()

def main():
    runner = TestRunner()
    runner.run_all()

if __name__ == "__main__":
    main()
