'use strict';

const fs = require('fs');
const path = require('path');

const RECONCILIATION_SCRIPT_BASENAME = 'reconcile-famous-song-phase1.cjs';

const RAW_PHASE1_PATHS = Object.freeze({
  dialogueData: ['phase1-gather-context', 'dialogue-data.json'],
  musicData: ['phase1-gather-context', 'music-data.json'],
  musicVocalsData: ['phase1-gather-context', 'music-vocals-data.json'],
  visualIdentityData: ['phase1-gather-context', 'visual-identity-data.json'],
  metadataData: ['phase1-gather-context', 'metadata.json']
});

const RECONCILED_PHASE1_PATHS = Object.freeze({
  dialogueData: ['phase1-gather-context', 'dialogue-data.reconciled.json'],
  musicVocalsData: ['phase1-gather-context', 'music-vocals-data.reconciled.json'],
  famousSongReconciliation: ['phase1-gather-context', 'famous-song-reconciliation.json']
});

const RECONCILED_PHASE1_RUNTIME_KEYS = Object.freeze({
  dialogueData: 'dialogueDataReconciled',
  musicVocalsData: 'musicVocalsDataReconciled',
  famousSongReconciliation: 'famousSongReconciliation'
});

function flattenPhaseScripts(phaseConfig) {
  if (!phaseConfig) return [];
  if (Array.isArray(phaseConfig)) {
    return phaseConfig.map((entry) => (typeof entry === 'string' ? entry : entry?.script)).filter(Boolean);
  }
  if (typeof phaseConfig === 'object') {
    if (Array.isArray(phaseConfig.parallel)) {
      return phaseConfig.parallel.map((entry) => (typeof entry === 'string' ? entry : entry?.script)).filter(Boolean);
    }
    if (Array.isArray(phaseConfig.sequential)) {
      return phaseConfig.sequential.map((entry) => (typeof entry === 'string' ? entry : entry?.script)).filter(Boolean);
    }
  }
  return [];
}

function normalizeScriptPath(scriptPath) {
  return String(scriptPath || '').replace(/\\/g, '/');
}

function isFamousSongReconciliationScript(scriptPath) {
  const normalized = normalizeScriptPath(scriptPath);
  return normalized.endsWith(`/${RECONCILIATION_SCRIPT_BASENAME}`) || normalized === RECONCILIATION_SCRIPT_BASENAME;
}

function isFamousSongReconciliationConfigured(config = {}) {
  return flattenPhaseScripts(config?.gather_context).some((scriptPath) => isFamousSongReconciliationScript(scriptPath));
}

function getRawArtifactPath(outputDir, artifactKey) {
  const parts = RAW_PHASE1_PATHS[artifactKey];
  if (!parts) return null;
  return path.resolve(outputDir, ...parts);
}

function getReconciledArtifactPath(outputDir, artifactKey) {
  const parts = RECONCILED_PHASE1_PATHS[artifactKey];
  if (!parts) return null;
  return path.resolve(outputDir, ...parts);
}

function getReconciledArtifactRuntimeKey(artifactKey) {
  return RECONCILED_PHASE1_RUNTIME_KEYS[artifactKey] || null;
}

function selectCanonicalPhase1ArtifactFromBag(artifacts = {}, artifactKey, { config = {}, strict = false } = {}) {
  const reconciliationConfigured = isFamousSongReconciliationConfigured(config);
  const rawRuntimeKey = artifactKey;
  const reconciledRuntimeKey = getReconciledArtifactRuntimeKey(artifactKey);
  const shouldUseReconciled = reconciliationConfigured && Boolean(reconciledRuntimeKey);

  if (shouldUseReconciled) {
    const reconciledArtifact = artifacts?.[reconciledRuntimeKey];
    if (reconciledArtifact !== undefined) {
      return {
        artifactKey,
        reconciliationConfigured,
        shouldUseReconciled,
        rawRuntimeKey,
        reconciledRuntimeKey,
        resolvedRuntimeKey: reconciledRuntimeKey,
        resolvedArtifact: reconciledArtifact
      };
    }

    if (strict) {
      throw new Error(`Famous-song reconciliation is configured, but the reconciled ${artifactKey} runtime artifact is missing: ${reconciledRuntimeKey}`);
    }
  }

  return {
    artifactKey,
    reconciliationConfigured,
    shouldUseReconciled,
    rawRuntimeKey,
    reconciledRuntimeKey,
    resolvedRuntimeKey: rawRuntimeKey,
    resolvedArtifact: artifacts?.[rawRuntimeKey]
  };
}

function resolvePhase1ArtifactPath(outputDir, artifactKey, { config = {}, strict = false } = {}) {
  const rawPath = getRawArtifactPath(outputDir, artifactKey);
  const reconciledPath = getReconciledArtifactPath(outputDir, artifactKey);
  const reconciliationConfigured = isFamousSongReconciliationConfigured(config);
  const shouldUseReconciled = reconciliationConfigured && Boolean(reconciledPath);
  const resolvedPath = shouldUseReconciled ? reconciledPath : rawPath;

  if (strict && shouldUseReconciled && resolvedPath && !fs.existsSync(resolvedPath)) {
    throw new Error(`Famous-song reconciliation is configured, but the reconciled ${artifactKey} artifact is missing: ${resolvedPath}`);
  }

  return {
    artifactKey,
    reconciliationConfigured,
    shouldUseReconciled,
    rawPath,
    reconciledPath,
    resolvedPath
  };
}

module.exports = {
  RECONCILIATION_SCRIPT_BASENAME,
  RAW_PHASE1_PATHS,
  RECONCILED_PHASE1_PATHS,
  RECONCILED_PHASE1_RUNTIME_KEYS,
  flattenPhaseScripts,
  isFamousSongReconciliationScript,
  isFamousSongReconciliationConfigured,
  getRawArtifactPath,
  getReconciledArtifactPath,
  getReconciledArtifactRuntimeKey,
  selectCanonicalPhase1ArtifactFromBag,
  resolvePhase1ArtifactPath
};
