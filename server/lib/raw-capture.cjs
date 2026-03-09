#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const outputManager = require('./output-manager.cjs');

function shouldCaptureRaw(config) {
  return !!config?.debug?.captureRaw;
}

function getRawPhaseDir(outputDir, phaseKey) {
  return outputManager.getPhaseRawDirectory(outputDir, phaseKey);
}

function writeRawJson(baseDir, relativePath, payload) {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf8');
  return fullPath;
}

module.exports = {
  shouldCaptureRaw,
  getRawPhaseDir,
  writeRawJson
};
