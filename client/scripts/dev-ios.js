#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const clientRoot = path.resolve(__dirname, '..');
process.chdir(clientRoot);

const child = spawn('npx', ['next', 'dev', '--turbopack'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3005' },
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
