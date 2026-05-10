#!/bin/bash

cd "C:\Users\RA store\study-planner"

# Function to run command and capture output
run_command() {
    local cmd_num=$1
    local cmd_str=$2
    
    echo ""
    echo "===== COMMAND $cmd_num: $cmd_str ====="
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Command: $cmd_str"
    
    eval "$cmd_str"
    exit_code=$?
    
    echo "Exit Code: $exit_code"
    echo ""
}

# Execute all commands in sequence
run_command 1 "npm.cmd install --save-dev @playwright/test"
run_command 2 "npm.cmd run lint"
run_command 3 "npm.cmd run build"
run_command 4 "npx playwright test --list"
run_command 5 "npm.cmd run test:e2e"

