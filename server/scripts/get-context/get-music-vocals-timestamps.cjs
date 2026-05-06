#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadPersistedArtifacts } = require('../../lib/persisted-artifacts.cjs');
const {
  resolvePhase1ArtifactPath,
  selectCanonicalPhase1ArtifactFromBag
} = require('../../lib/phase1-baseline-resolution.cjs');
const {
  buildMusicVocalsTimestampArtifact
} = require('../../lib/phase1-timestamp-derivation.cjs');
const {
  deriveFasterWhisperMusicVocalsTiming
} = require('../../lib/faster-whisper-music-vocals-timing.cjs');

const SCRIPT_ID = 'get-music-vocals-timestamps';

function ensureSourceMusicVocals({ artifacts, outputDir, config, runtimeArtifactSurface }) {
  const bagResolution = selectCanonicalPhase1ArtifactFromBag(artifacts || {}, 'musicVocalsData', {
    config,
    strict: false,
    runtimeArtifactSurface
  });
  const pathResolution = resolvePhase1ArtifactPath(outputDir, 'musicVocalsData', {
    config,
    strict: false,
    runtimeArtifactSurface
  });
  const logicalSourcePath = pathResolution.resolvedPath;

  if (bagResolution.resolvedArtifact !== undefined) {
    return {
      sourceMusicVocalsData: bagResolution.resolvedArtifact,
      sourceRuntimeKey: bagResolution.resolvedRuntimeKey,
      runtimeArtifactSurface: bagResolution.resolvedRuntimeSurface,
      sourcePath: logicalSourcePath
    };
  }

  const persisted = loadPersistedArtifacts(outputDir, {
    keys: ['musicVocalsData'],
    strict: true,
    config,
    runtimeArtifactSurface
  });

  if (persisted.artifacts.musicVocalsData === undefined) {
    throw new Error(`Missing persisted musicVocalsData artifact for ${SCRIPT_ID}: ${logicalSourcePath}`);
  }

  const sourceRuntimeKey = pathResolution.resolvedRuntimeSurface === 'reconciled'
    ? 'musicVocalsDataReconciled'
    : 'musicVocalsData';
  const persistedSourcePath = persisted.sources.musicVocalsData;
  const sourcePath = persistedSourcePath && path.basename(persistedSourcePath) !== 'artifacts-complete.json'
    ? persistedSourcePath
    : logicalSourcePath;

  return {
    sourceMusicVocalsData: persisted.artifacts.musicVocalsData,
    sourceRuntimeKey,
    runtimeArtifactSurface: pathResolution.resolvedRuntimeSurface,
    sourcePath
  };
}

async function deriveAlignmentMusicVocals({ assetPath }) {
  return deriveFasterWhisperMusicVocalsTiming({ assetPath });
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

  const source = ensureSourceMusicVocals({ artifacts, outputDir, config, runtimeArtifactSurface });
  const alignment = await deriveAlignmentMusicVocals({ assetPath });

  const artifact = buildMusicVocalsTimestampArtifact({
    sourceMusicVocalsData: source.sourceMusicVocalsData,
    alignmentMusicVocalsData: alignment.musicVocalsData,
    outputDir,
    sourcePath: source.sourcePath,
    runtimeArtifactSurface: source.runtimeArtifactSurface,
    sourceRuntimeKey: source.sourceRuntimeKey,
    sourceArtifactKey: 'musicVocalsData',
    alignmentMetadata: alignment.metadata
  });

  const outputResolution = resolvePhase1ArtifactPath(outputDir, 'musicVocalsTimestampsData', {
    config,
    runtimeArtifactSurface: source.runtimeArtifactSurface
  });
  const outputPath = outputResolution.resolvedPath;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

  const artifactRuntimeKey = source.runtimeArtifactSurface === 'reconciled'
    ? 'musicVocalsTimestampsDataReconciled'
    : 'musicVocalsTimestampsData';

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
    guidance: 'Timestamp derivation must preserve the selected music-vocals artifact text verbatim while treating sung timing confidence conservatively.',
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
      console.log('Music-vocals timestamps complete.');
    })
    .catch((error) => {
      console.error(`❌ ${SCRIPT_ID} failed:`, error.message);
      process.exitCode = 1;
    });
}
