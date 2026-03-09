#!/usr/bin/env node
/**
 * Get Metadata Script
 *
 * Extracts video/audio metadata via ffprobe.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 *
 * Artifacts:
 * - phase1-gather-context/metadata.json
 * - artifacts.metadataData (object)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const outputManager = require('../../lib/output-manager.cjs');
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ensureToolVersionsCaptured } = require('../../lib/tool-versions.cjs');
const { ffprobePath } = require('../../lib/ffmpeg-path.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');

const execAsync = promisify(exec);

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-metadata';

async function run(input) {
  const { assetPath, outputDir, config } = input;

  console.log('   🧾 Extracting metadata via ffprobe:', assetPath);

  // Create phase directory for artifacts
  const phaseDir = outputManager.createPhaseDirectory(outputDir, PHASE_KEY);

  const captureRaw = shouldCaptureRaw(config);
  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg', 'metadata');
  const toolVersionsDir = path.join(rawDir, 'tools', '_versions');

  await ensureToolVersionsCaptured({
    captureRaw,
    toolVersionsDir,
    tools: [{ name: 'ffprobe', path: ffprobePath }]
  });

  const command = `"${ffprobePath}" -v error -print_format json -show_format -show_streams "${assetPath}"`;

  let stdout = '';
  let stderr = '';
  let parsed = null;

  try {
    const result = await execAsync(command, { maxBuffer: 25 * 1024 * 1024 });
    stdout = result.stdout || '';
    stderr = result.stderr || '';
    parsed = stdout.trim().length ? JSON.parse(stdout) : {};

    if (captureRaw) {
      writeRawJson(ffmpegRawDir, 'ffprobe-metadata.json', {
        tool: 'ffprobe',
        command,
        status: 'success',
        stdout,
        stderr
      });
    }
  } catch (error) {
    stdout = error?.stdout || '';
    stderr = error?.stderr || '';

    if (captureRaw) {
      writeRawJson(ffmpegRawDir, 'ffprobe-metadata.json', {
        tool: 'ffprobe',
        command,
        status: 'failed',
        stdout,
        stderr,
        error: error?.message || String(error)
      });
    }

    events.error({
      message: error?.message || String(error),
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      where: 'ffprobe'
    });

    throw new Error(`get-metadata failed: ${error?.message || String(error)}`);
  }

  const metadataData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetPath,
    ffprobe: parsed
  };

  const artifactPath = path.join(phaseDir, 'metadata.json');
  fs.writeFileSync(artifactPath, JSON.stringify(metadataData, null, 2), 'utf8');
  events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

  console.log(`   ✅ Metadata saved to: ${artifactPath}`);

  events.emit({ kind: 'script.end', phase: PHASE_KEY, script: SCRIPT_ID, outcome: 'success' });

  return {
    artifacts: {
      metadataData
    }
  };
}

module.exports = { run };
