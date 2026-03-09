#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function captureToolVersion({ toolName, toolPath, outDir }) {
  if (!toolName || !toolPath || !outDir) {
    throw new Error('captureToolVersion: toolName, toolPath, and outDir are required');
  }

  const outPath = path.join(outDir, `${toolName}.json`);
  if (fs.existsSync(outPath)) return outPath;

  fs.mkdirSync(outDir, { recursive: true });
  const command = `"${toolPath}" -version`;

  try {
    const { stdout, stderr } = await execAsync(command);
    fs.writeFileSync(outPath, JSON.stringify({
      schemaVersion: 1,
      tool: toolName,
      resolvedPath: toolPath,
      command,
      exitCode: 0,
      stdout,
      stderr,
      capturedAt: new Date().toISOString()
    }, null, 2), 'utf8');
    return outPath;
  } catch (error) {
    fs.writeFileSync(outPath, JSON.stringify({
      schemaVersion: 1,
      tool: toolName,
      resolvedPath: toolPath,
      command,
      exitCode: typeof error?.code === 'number' ? error.code : 1,
      stdout: error?.stdout || '',
      stderr: error?.stderr || '',
      error: error?.message || String(error),
      capturedAt: new Date().toISOString()
    }, null, 2), 'utf8');
    return outPath;
  }
}

async function ensureToolVersionsCaptured({ captureRaw, toolVersionsDir, tools }) {
  if (!captureRaw) return;

  const list = Array.isArray(tools) ? tools : [];
  for (const tool of list) {
    if (!tool) continue;
    await captureToolVersion({
      toolName: tool.name,
      toolPath: tool.path,
      outDir: toolVersionsDir
    });
  }
}

module.exports = {
  captureToolVersion,
  ensureToolVersionsCaptured
};
