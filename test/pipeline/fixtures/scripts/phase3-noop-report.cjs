#!/usr/bin/env node

async function run() {
  return {
    artifacts: {
      summaryData: {
        generatedBy: 'phase3-noop-report'
      }
    }
  };
}

module.exports = { run };
