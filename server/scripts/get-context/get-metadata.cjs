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
const {
  createCommandFailure,
  createInvalidOutputFailure,
  applyFailureMetadata
} = require('../../lib/tool-wrapper-contract.cjs');

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

    try {
      parsed = stdout.trim().length ? JSON.parse(stdout) : {};
    } catch (parseError) {
      const failure = createInvalidOutputFailure({
        stage: 'tool.wrapper.ffprobe.parse',
        code: 'GET_METADATA_INVALID_OUTPUT',
        message: `get-metadata produced invalid ffprobe JSON: ${parseError.message}`,
        diagnostics: {
          tool: 'ffprobe',
          command,
          stdout,
          stderr,
          parseError: parseError.message
        }
      });
      throw applyFailureMetadata(new Error(failure.error), failure.failure);
    }

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
    stdout = error?.stdout || stdout || '';
    stderr = error?.stderr || stderr || '';

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

    if (error?.failureCategory) {
      throw error;
    }

    const failure = createCommandFailure({
      stage: 'tool.wrapper.ffprobe.exec',
      code: 'GET_METADATA_TOOL_FAILED',
      command: ffprobePath,
      args: ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', assetPath],
      stdout,
      stderr,
      exitCode: error?.code ?? null,
      message: `get-metadata failed: ${error?.message || String(error)}`,
      tool: 'ffprobe'
    });
    throw applyFailureMetadata(new Error(failure.error), failure.failure);
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
    primaryArtifactKey: 'metadataData',
    metrics: {
      streamsCount: Array.isArray(parsed?.streams) ? parsed.streams.length : 0,
      formatDurationSeconds: Number(parsed?.format?.duration) || null
    },
    diagnostics: {
      degraded: false,
      warnings: []
    },
    artifacts: {
      metadataData
    }
  };
}

const deterministicRecovery = {
  script: 'get-metadata',
  family: 'tool.wrapper.v1',
  knownStrategies: [
    { id: 'retry-after-path-normalization', kind: 'repair', consumesAttempt: true, terminalIfUnavailable: false },
    { id: 're-extract-artifact', kind: 'rerun', consumesAttempt: true, terminalIfUnavailable: false }
  ],
  degradedSuccess: {
    allowed: false,
    conditions: []
  }
};

module.exports = { run, deterministicRecovery };
