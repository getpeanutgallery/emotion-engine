/**
 * Processed assets retention policy helpers.
 *
 * New behavior:
 * - Default is to keep processed/intermediate files.
 * - YAML flag debug.keepProcessedIntermediates=false enables cleanup.
 *
 * Backward compatibility:
 * - debug.keepProcessedFiles (alias)
 * - debug.keepTempFiles (legacy semantics)
 */

function shouldKeepProcessedIntermediates(config) {
  const debug = config?.debug;

  if (!debug || typeof debug !== 'object') {
    return true;
  }

  if (typeof debug.keepProcessedIntermediates === 'boolean') {
    return debug.keepProcessedIntermediates;
  }

  if (typeof debug.keepProcessedFiles === 'boolean') {
    return debug.keepProcessedFiles;
  }

  if (typeof debug.keepTempFiles === 'boolean') {
    return debug.keepTempFiles;
  }

  return true;
}

module.exports = {
  shouldKeepProcessedIntermediates
};
