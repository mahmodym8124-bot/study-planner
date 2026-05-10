#!/usr/bin/env node

/**
 * Comprehensive test execution script for study-planner
 * Executes commands in sequence and captures output
 * For command 5, probes health endpoints concurrently
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO_DIR = 'C:\\Users\\RA store\\study-planner';
const LOG_FILE = path.join(REPO_DIR, 'execution_report.txt');
const PROBES_LOG = path.join(REPO_DIR, 'health_probes.txt');

class TestRunner {
  constructor() {
    this.logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });
    this.probesStream = fs.createWriteStream(PROBES_LOG, { flags: 'w' });
    this.results = {};
  }

  log(msg) {
    console.log(msg);
    this.logStream.write(msg + '\n');
  }

  logProbe(msg) {
    console.log(`[PROBE] ${msg}`);
    this.probesStream.write(msg + '\n');
  }

  async runCommand(num, cmd, description) {
    this.log(`\n${'='.repeat(70)}`);
    this.log(`COMMAND ${num}: ${description}`);
    this.log(`Command: ${cmd}`);
    this.log(`Timestamp: ${new Date().toISOString()}`);
    this.log(`${'='.repeat(70)}\n`);

    try {
      const output = execSync(cmd, {
        cwd: REPO_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      this.log(output);
      this.log(`\nExit Code: 0 (SUCCESS)\n`);
      this.results[`cmd${num}`] = { exitCode: 0, success: true };
      return 0;
    } catch (error) {
      this.log(error.stdout || '');
      this.log('\n--- STDERR ---');
      this.log(error.stderr || '');
      const exitCode = error.status || 1;
      this.log(`\nExit Code: ${exitCode} (FAILED)\n`);
      this.results[`cmd${num}`] = { exitCode, success: false, error: error.message };
      return exitCode;
    }
  }

  async probeEndpoint(url, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = new Date();
      const timeoutHandle = setTimeout(() => {
        resolve({ status: 'timeout', timestamp: startTime.toISOString(), url });
      }, timeout);

      http
        .get(url, { timeout }, (res) => {
          clearTimeout(timeoutHandle);
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
            if (data.length > 200) data = data.substring(0, 200) + '...';
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              timestamp: startTime.toISOString(),
              url,
              body: data.substring(0, 100)
            });
          });
        })
        .on('error', (err) => {
          clearTimeout(timeoutHandle);
          resolve({
            status: 'error',
            timestamp: startTime.toISOString(),
            url,
            error: err.message
          });
        });
    });
  }

  async runCommandWithProbes(num, cmd, description) {
    this.log(`\n${'='.repeat(70)}`);
    this.log(`COMMAND ${num}: ${description}`);
    this.log(`Command: ${cmd}`);
    this.log(`Timestamp: ${new Date().toISOString()}`);
    this.log(`Note: Will probe health endpoints concurrently during test execution`);
    this.log(`${'='.repeat(70)}\n`);

    // Start the process
    const process = spawn('cmd.exe', ['/c', cmd], {
      cwd: REPO_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(str);
    });

    process.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str);
    });

    // Start probing after a short delay to let servers start
    setTimeout(() => this.probeEndpoints(), 3000);

    return new Promise((resolve) => {
      process.on('close', (code) => {
        this.log(stdout);
        if (stderr) {
          this.log('\n--- STDERR ---');
          this.log(stderr);
        }
        this.log(`\nExit Code: ${code}\n`);
        this.results[`cmd${num}`] = { exitCode: code, success: code === 0 };
        resolve(code);
      });
    });
  }

  async probeEndpoints() {
    const probeIntervalMs = 5000; // Probe every 5 seconds
    const maxProbes = 15; // Probe for ~75 seconds

    for (let i = 0; i < maxProbes; i++) {
      const [apiResult, webResult] = await Promise.all([
        this.probeEndpoint('http://localhost:8091/api/health'),
        this.probeEndpoint('http://localhost:5173/api/health')
      ]);

      this.logProbe(`[Probe ${i + 1}] API (8091): Status=${apiResult.status} | Time=${apiResult.timestamp}`);
      if (apiResult.body) this.logProbe(`  Body: ${apiResult.body}`);
      if (apiResult.error) this.logProbe(`  Error: ${apiResult.error}`);

      this.logProbe(`[Probe ${i + 1}] Web (5173): Status=${webResult.status} | Time=${webResult.timestamp}`);
      if (webResult.body) this.logProbe(`  Body: ${webResult.body}`);
      if (webResult.error) this.logProbe(`  Error: ${webResult.error}`);

      await new Promise((resolve) => setTimeout(resolve, probeIntervalMs));
    }
  }

  async run() {
    this.log('='.repeat(70));
    this.log('TEST EXECUTION REPORT');
    this.log('='.repeat(70));
    this.log(`Date: ${new Date().toISOString()}`);
    this.log(`Working Directory: ${REPO_DIR}\n`);

    // Execute commands
    await this.runCommand(1, 'npm.cmd install --save-dev @playwright/test', 'npm install @playwright/test');
    await this.runCommand(2, 'npm.cmd run lint', 'npm run lint');
    await this.runCommand(3, 'npm.cmd run build', 'npm run build');
    await this.runCommand(4, 'npx playwright test --list', 'npx playwright test --list');
    await this.runCommandWithProbes(5, 'npm.cmd run test:e2e', 'npm run test:e2e');

    // Summary
    this.log('\n' + '='.repeat(70));
    this.log('EXECUTION SUMMARY');
    this.log('='.repeat(70) + '\n');

    for (let i = 1; i <= 5; i++) {
      const result = this.results[`cmd${i}`];
      if (result) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        this.log(`Command ${i}: Exit Code ${result.exitCode} (${status})`);
      }
    }

    this.log(`\nReports saved to:`);
    this.log(`  Main log: ${LOG_FILE}`);
    this.log(`  Health probes: ${PROBES_LOG}`);

    this.logStream.end();
    this.probesStream.end();

    console.log('\n✓ Test execution complete!');
  }
}

const runner = new TestRunner();
runner.run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
