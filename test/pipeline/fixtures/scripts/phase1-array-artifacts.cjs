#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function run(input) {
  const { outputDir } = input;

  const phaseDir = path.join(outputDir, 'phase1-gather-context');
  fs.mkdirSync(phaseDir, { recursive: true });

  const dialogueData = {
    dialogue_segments: [
      { start: 0, end: 1, text: 'a' },
      { start: 1, end: 2, text: 'b' }
    ],
    summary: 'two segments'
  };

  const musicData = {
    segments: [
      { start: 0, end: 2, label: 'intro' }
    ],
    summary: 'one segment'
  };

  fs.writeFileSync(path.join(phaseDir, 'dialogue-data.json'), JSON.stringify(dialogueData, null, 2));
  fs.writeFileSync(path.join(phaseDir, 'music-data.json'), JSON.stringify(musicData, null, 2));

  return {
    artifacts: {
      dialogueData,
      musicData
    }
  };
}

module.exports = { run };
