#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPersistedArtifacts } = require('../../lib/persisted-artifacts.cjs');
const {
  resolvePhase1ArtifactPath,
  selectCanonicalPhase1ArtifactFromBag
} = require('../../lib/phase1-baseline-resolution.cjs');
const {
  buildDialogueTimestampArtifact
} = require('../../lib/phase1-timestamp-derivation.cjs');
const getDialogueScript = require('./get-dialogue.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-dialogue-timestamps';
const TIMESTAMP_ALIGNMENT_RETRY_DEFAULTS = Object.freeze({
  maxAttempts: 2,
  backoffMs: 1000
});

function ensureSourceDialogue({ artifacts, outputDir, config, runtimeArtifactSurface }) {
  const bagResolution = selectCanonicalPhase1ArtifactFromBag(artifacts || {}, 'dialogueData', {
    config,
    strict: false,
    runtimeArtifactSurface
  });
  const pathResolution = resolvePhase1ArtifactPath(outputDir, 'dialogueData', {
    config,
    strict: false,
    runtimeArtifactSurface
  });
  const logicalSourcePath = pathResolution.resolvedPath;

  if (bagResolution.resolvedArtifact !== undefined) {
    return {
      sourceDialogueData: bagResolution.resolvedArtifact,
      sourceRuntimeKey: bagResolution.resolvedRuntimeKey,
      runtimeArtifactSurface: bagResolution.resolvedRuntimeSurface,
      sourcePath: logicalSourcePath
    };
  }

  const persisted = loadPersistedArtifacts(outputDir, {
    keys: ['dialogueData'],
    strict: true,
    config,
    runtimeArtifactSurface
  });

  if (persisted.artifacts.dialogueData === undefined) {
    throw new Error(`Missing persisted dialogueData artifact for ${SCRIPT_ID}: ${logicalSourcePath}`);
  }

  const sourceRuntimeKey = pathResolution.resolvedRuntimeSurface === 'reconciled'
    ? 'dialogueDataReconciled'
    : 'dialogueData';
  const persistedSourcePath = persisted.sources.dialogueData;
  const sourcePath = persistedSourcePath && path.basename(persistedSourcePath) !== 'artifacts-complete.json'
    ? persistedSourcePath
    : logicalSourcePath;

  return {
    sourceDialogueData: persisted.artifacts.dialogueData,
    sourceRuntimeKey,
    runtimeArtifactSurface: pathResolution.resolvedRuntimeSurface,
    sourcePath
  };
}

function buildTimestampAlignmentConfig(config = {}) {
  const sourceRetry = config?.ai?.dialogue?.retry || {};
  const maxAttempts = Number.isInteger(sourceRetry.maxAttempts) && sourceRetry.maxAttempts > 0
    ? Math.max(sourceRetry.maxAttempts, TIMESTAMP_ALIGNMENT_RETRY_DEFAULTS.maxAttempts)
    : TIMESTAMP_ALIGNMENT_RETRY_DEFAULTS.maxAttempts;
  const backoffMs = Number.isInteger(sourceRetry.backoffMs) && sourceRetry.backoffMs >= 0
    ? Math.max(sourceRetry.backoffMs, TIMESTAMP_ALIGNMENT_RETRY_DEFAULTS.backoffMs)
    : TIMESTAMP_ALIGNMENT_RETRY_DEFAULTS.backoffMs;

  return {
    ...config,
    ai: {
      ...(config?.ai || {}),
      dialogue: {
        ...((config?.ai && config.ai.dialogue) || {}),
        retry: {
          ...sourceRetry,
          maxAttempts,
          backoffMs
        }
      }
    }
  };
}

async function deriveAlignmentDialogue({ assetPath, config }) {
  const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-dialogue-timestamps-'));
  const alignmentConfig = buildTimestampAlignmentConfig(config);

  try {
    const result = await getDialogueScript.run({
      assetPath,
      outputDir: tempOutputDir,
      config: alignmentConfig,
      preserveSegmentTiming: true
    });

    const alignmentDialogueData = result?.artifacts?.dialogueData;
    const timedSegmentCount = Array.isArray(alignmentDialogueData?.dialogue_segments)
      ? alignmentDialogueData.dialogue_segments.filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end)).length
      : 0;

    if (!alignmentDialogueData || timedSegmentCount === 0) {
      throw new Error('Dialogue alignment rerun did not yield any timed dialogue segments.');
    }

    return alignmentDialogueData;
  } finally {
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
  }
}

async function run(input) {
  const {
    assetPath,
    outputDir,
    config = {},
    artifacts = {},
    runtimeArtifactSurface = 'canonical'
  } = input || {};

  if (!assetPath || !outputDir) {
    throw new Error(`${SCRIPT_ID} requires assetPath and outputDir.`);
  }

  const source = ensureSourceDialogue({ artifacts, outputDir, config, runtimeArtifactSurface });
  const alignmentDialogueData = await deriveAlignmentDialogue({ assetPath, config });

  const artifact = buildDialogueTimestampArtifact({
    sourceDialogueData: source.sourceDialogueData,
    alignmentDialogueData,
    outputDir,
    sourcePath: source.sourcePath,
    runtimeArtifactSurface: source.runtimeArtifactSurface,
    sourceRuntimeKey: source.sourceRuntimeKey,
    sourceArtifactKey: 'dialogueData'
  });

  const outputResolution = resolvePhase1ArtifactPath(outputDir, 'dialogueTimestampsData', {
    config,
    runtimeArtifactSurface: source.runtimeArtifactSurface
  });
  const outputPath = outputResolution.resolvedPath;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

  const artifactRuntimeKey = source.runtimeArtifactSurface === 'reconciled'
    ? 'dialogueTimestampsDataReconciled'
    : 'dialogueTimestampsData';

  return {
    primaryArtifactKey: artifactRuntimeKey,
    artifacts: {
      [artifactRuntimeKey]: artifact
    }
  };
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Timestamp derivation must preserve the selected dialogue artifact text verbatim while aligning against a fresh timed dialogue rerun.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'runtimeBudgets']
    }
  }
};

if (require.main === module) {
  const assetPath = process.argv[2];
  const outputDir = process.argv[3];

  run({ assetPath, outputDir })
    .then(() => {
      console.log('Dialogue timestamps complete.');
    })
    .catch((error) => {
      console.error(`❌ ${SCRIPT_ID} failed:`, error.message);
      process.exitCode = 1;
    });
}
