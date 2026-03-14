#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  lookupDeterministicRecoveryDeclaration,
  wrapLegacySuccessResult,
  createFailureResult
} = require('./script-contract.cjs');

async function executeScript({ phase, scriptPath, input, failLabel = 'Script' }) {
  const absoluteScriptPath = path.resolve(process.cwd(), scriptPath);
  if (!fs.existsSync(absoluteScriptPath)) {
    throw new Error(`Script not found: ${absoluteScriptPath}`);
  }

  const scriptId = path.basename(scriptPath, path.extname(scriptPath));
  const previousExecution = input?.artifacts?.__scriptExecution?.[scriptId] || null;

  console.log(`   Running: ${scriptPath}`);
  const startedAt = new Date();

  let script;
  try {
    script = require(absoluteScriptPath);
    if (typeof script.run !== 'function') {
      throw new Error(`Script must export a run() function: ${scriptPath}`);
    }

    const result = await script.run(input);
    return wrapLegacySuccessResult({
      result,
      phase,
      script: scriptId,
      config: input?.config || {},
      outputDir: input?.outputDir,
      previousExecution,
      startedAt,
      completedAt: new Date()
    });
  } catch (error) {
    console.error(`   ❌ ${failLabel} failed: ${scriptPath}`);
    console.error(`      Error: ${error.message}`);

    const declaration = lookupDeterministicRecoveryDeclaration({
      scriptId,
      scriptPath,
      scriptModule: script
    });

    const failure = createFailureResult({
      phase,
      script: scriptId,
      config: input?.config || {},
      outputDir: input?.outputDir,
      error,
      previousExecution,
      declaration,
      startedAt,
      completedAt: new Date()
    });

    error.scriptResult = failure.envelope;
    error.scriptRecovery = failure.result;
    throw error;
  }
}

module.exports = {
  executeScript
};
