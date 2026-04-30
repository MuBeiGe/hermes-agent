#!/usr/bin/env node
/**
 * OV Console Dashboard — Build Script
 * Concatenates source files in order, wraps in IIFE.
 * 
 * Usage: node build.js
 * Config: build.json
 */

const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'build.json'), 'utf8'));
const { sources, output, wrapper } = config;

// Read all source files
let code = wrapper.prefix;
for (const src of sources) {
    const filePath = path.join(__dirname, src);
    if (!fs.existsSync(filePath)) {
        console.error(`ERROR: Source file not found: ${src}`);
        process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    code += '\n' + content + '\n';
}
code += wrapper.suffix;

// Ensure dist directory exists
const outDir = path.dirname(path.join(__dirname, output));
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Backup old dist if exists
const outPath = path.join(__dirname, output);
if (fs.existsSync(outPath)) {
    const backup = outPath + '.bak.' + Date.now();
    fs.copyFileSync(outPath, backup);
    console.log('Backed up to:', path.basename(backup));
}

// Write output
fs.writeFileSync(outPath, code, 'utf8');

// Stats
const totalLines = code.split('\n').length;
const totalBytes = Buffer.byteLength(code, 'utf8');
console.log(`Built: ${output} (${totalLines} lines, ${(totalBytes/1024).toFixed(1)} KB)`);

// Quick validation
if (!code.includes('window.__HERMES_PLUGINS__.register')) {
    console.error('WARNING: Output missing register() call!');
    process.exit(1);
}
if (!code.includes('function App()')) {
    console.error('WARNING: Output missing App component!');
    process.exit(1);
}

console.log('Build OK');
