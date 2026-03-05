#!/usr/bin/env node
/**
 * Evaluation Report Script
 * 
 * Generates final evaluation report from all analysis data.
 * This script runs in Phase 3 (Report) of the pipeline.
 * 
 * @module scripts/report/evaluation
 */

const fs = require('fs');
const path = require('path');
const aiProvider = require('../../lib/ai-providers/ai-provider-interface.js');

/**
 * Main entry point
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   📊 Generating evaluation report...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    dialogueData = { dialogue_segments: [], summary: '' },
    musicData = { segments: [], summary: '', hasMusic: false },
    chunkAnalysis = { chunks: [], totalTokens: 0 },
    perSecondData = { per_second_data: [], summary: '' }
  } = artifacts;

  // Calculate metrics
  const keyMetrics = calculateMetrics(perSecondData.per_second_data || []);
  const duration = chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0;
  const totalTokens = chunkAnalysis.totalTokens || 0;

  // Generate AI recommendation
  console.log('   🤖 Generating AI recommendation...');
  const recommendation = await generateRecommendation({
    keyMetrics,
    duration,
    chunkAnalysis,
    dialogueData,
    musicData
  });

  // Build markdown report
  console.log('   📝 Building report...');
  const reportContent = buildReport({
    keyMetrics,
    duration,
    totalTokens,
    chunkAnalysis,
    perSecondData,
    dialogueData,
    musicData,
    recommendation
  });

  // Save report
  const reportPath = path.join(outputDir, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`   ✅ Report saved to: ${reportPath}`);

  // Save raw JSON data
  const jsonPath = path.join(outputDir, 'analysis-data.json');
  const jsonData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      pipelineVersion: '8.0.0',
      config: config || {}
    },
    summary: {
      duration,
      totalTokens,
      keyMetrics,
      recommendation: recommendation.text
    },
    data: {
      dialogueData,
      musicData,
      chunkAnalysis,
      perSecondData
    }
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log(`   ✅ Raw data saved to: ${jsonPath}`);

  return {
    artifacts: {
      reportFiles: {
        main: reportPath,
        json: jsonPath
      },
      summary: {
        totalTokens,
        duration,
        keyMetrics,
        recommendation: recommendation.text
      }
    }
  };
}

/**
 * Calculate average metrics from per-second data
 */
function calculateMetrics(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) {
    return {};
  }

  const emotionTotals = {};
  const emotionCounts = {};

  for (const data of perSecondData) {
    for (const [lens, emotionData] of Object.entries(data.emotions || {})) {
      if (!emotionTotals[lens]) {
        emotionTotals[lens] = 0;
        emotionCounts[lens] = 0;
      }
      emotionTotals[lens] += emotionData.score || 0;
      emotionCounts[lens]++;
    }
  }

  const metrics = {};
  for (const lens of Object.keys(emotionTotals)) {
    metrics[`avg${capitalize(lens)}`] = emotionTotals[lens] / emotionCounts[lens];
  }

  return metrics;
}

/**
 * Generate AI recommendation based on analysis
 */
async function generateRecommendation(data) {
  try {
    const { keyMetrics, duration, chunkAnalysis } = data;

    // Get AI provider from environment
    const provider = aiProvider.getProviderFromEnv();
    const model = process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b';
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      return generateBasicRecommendation(data);
    }

    // Build prompt
    const prompt = buildRecommendationPrompt(data);

    // Call AI provider
    const response = await provider.complete({
      prompt,
      model,
      apiKey,
      options: {
        temperature: 0.7,
        maxTokens: 1024
      }
    });

    return parseRecommendationResponse(response.content);
  } catch (error) {
    console.warn('   ⚠️  AI recommendation failed, using fallback:', error.message);
    return generateBasicRecommendation(data);
  }
}

/**
 * Build recommendation prompt for AI
 */
function buildRecommendationPrompt(data) {
  const { keyMetrics, duration, chunkAnalysis } = data;

  let prompt = `Based on the following emotion analysis of a ${duration.toFixed(0)}-second video, provide a recommendation:\n\n`;

  prompt += `## Key Metrics (Average Scores 1-10)\n`;
  for (const [metric, value] of Object.entries(keyMetrics)) {
    const emotion = metric.replace('avg', '').toLowerCase();
    prompt += `- ${capitalize(emotion)}: ${value.toFixed(1)}/10\n`;
  }
  prompt += '\n';

  prompt += `## Chunk Analysis Summary\n`;
  prompt += `Total chunks analyzed: ${chunkAnalysis.chunks?.length || 0}\n`;
  prompt += `Total tokens used: ${chunkAnalysis.totalTokens || 0}\n\n`;

  if (chunkAnalysis.chunks && chunkAnalysis.chunks.length > 0) {
    prompt += `## Sample Chunk Summaries\n`;
    for (let i = 0; i < Math.min(3, chunkAnalysis.chunks.length); i++) {
      const chunk = chunkAnalysis.chunks[i];
      prompt += `- Chunk ${i + 1} (${chunk.startTime.toFixed(0)}s-${chunk.endTime.toFixed(0)}s): ${chunk.summary}\n`;
    }
    prompt += '\n';
  }

  prompt += `Provide:\n`;
  prompt += `1. A brief recommendation (1-2 sentences)\n`;
  prompt += `2. Reasoning for the recommendation\n\n`;
  prompt += `Respond in JSON format:\n`;
  prompt += `{"text": "recommendation text", "reasoning": "explanation"}\n`;

  return prompt;
}

/**
 * Parse AI recommendation response
 */
function parseRecommendationResponse(responseContent) {
  try {
    let jsonData = null;
    try {
      jsonData = JSON.parse(responseContent.trim());
    } catch (e) {
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[1].trim());
      }
    }

    if (jsonData) {
      return {
        text: jsonData.text || 'No recommendation provided',
        reasoning: jsonData.reasoning || 'No reasoning provided'
      };
    }
  } catch (e) {
    // Fall through to basic recommendation
  }

  return generateBasicRecommendation({ keyMetrics: {}, duration: 0 });
}

/**
 * Generate basic recommendation without AI
 */
function generateBasicRecommendation(data) {
  const { keyMetrics } = data;
  
  // Find lowest scoring emotion
  let lowestEmotion = null;
  let lowestScore = Infinity;
  
  for (const [metric, value] of Object.entries(keyMetrics)) {
    if (value < lowestScore) {
      lowestScore = value;
      lowestEmotion = metric.replace('avg', '').toLowerCase();
    }
  }

  const text = lowestEmotion
    ? `Consider improving ${lowestEmotion} levels, which scored ${lowestScore.toFixed(1)}/10 on average.`
    : 'Analysis complete. Review detailed metrics for insights.';

  const reasoning = lowestEmotion
    ? `The ${lowestEmotion} metric showed the lowest average score across the video duration.`
    : 'Basic analysis based on available metrics.';

  return { text, reasoning };
}

/**
 * Build markdown report
 */
function buildReport(data) {
  const {
    keyMetrics,
    duration,
    totalTokens,
    chunkAnalysis,
    perSecondData,
    dialogueData,
    musicData,
    recommendation
  } = data;

  let report = `# Emotion Analysis Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Pipeline Version:** 8.0.0\n\n`;

  report += `---\n\n`;

  report += `## Executive Summary\n\n`;
  report += `**Video Duration:** ${duration.toFixed(1)} seconds\n`;
  report += `**Total Tokens Used:** ${totalTokens.toLocaleString()}\n`;
  report += `**Chunks Analyzed:** ${chunkAnalysis.chunks?.length || 0}\n\n`;

  report += `### Recommendation\n\n`;
  report += `> ${recommendation.text}\n\n`;
  report += `*${recommendation.reasoning}*\n\n`;

  report += `---\n\n`;

  report += `## Key Metrics\n\n`;
  report += `| Emotion | Average Score (1-10) |\n`;
  report += `|---------|---------------------|\n`;
  for (const [metric, value] of Object.entries(keyMetrics)) {
    const emotion = metric.replace('avg', '').toLowerCase();
    const bar = '█'.repeat(Math.round(value / 10 * 10));
    report += `| ${capitalize(emotion)} | ${value.toFixed(1)} ${bar} |\n`;
  }
  report += '\n';

  report += `---\n\n`;

  report += `## Chunk-by-Chunk Analysis\n\n`;
  if (chunkAnalysis.chunks && chunkAnalysis.chunks.length > 0) {
    for (const chunk of chunkAnalysis.chunks) {
      report += `### Chunk ${chunk.chunkIndex + 1} (${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s)\n\n`;
      report += `**Summary:** ${chunk.summary}\n\n`;
      
      if (chunk.emotions) {
        report += `**Emotions:**\n`;
        for (const [lens, emotionData] of Object.entries(chunk.emotions)) {
          report += `- ${capitalize(lens)}: ${emotionData.score}/10\n`;
        }
        report += '\n';
      }
      
      if (chunk.dominant_emotion) {
        report += `**Dominant Emotion:** ${chunk.dominant_emotion}\n\n`;
      }
      
      report += `---\n\n`;
    }
  } else {
    report += `*No chunk analysis data available*\n\n`;
  }

  report += `## Dialogue Summary\n\n`;
  if (dialogueData.dialogue_segments && dialogueData.dialogue_segments.length > 0) {
    report += `**Total Segments:** ${dialogueData.dialogue_segments.length}\n\n`;
    report += `**Summary:** ${dialogueData.summary}\n\n`;
    report += `### Sample Dialogue\n\n`;
    for (let i = 0; i < Math.min(5, dialogueData.dialogue_segments.length); i++) {
      const seg = dialogueData.dialogue_segments[i];
      report += `- [${formatTime(seg.start)}] ${seg.speaker || 'Speaker'}: ${seg.text}\n`;
    }
  } else {
    report += `*No dialogue data available*\n`;
  }
  report += '\n\n';

  report += `---\n\n`;

  report += `## Music/Audio Summary\n\n`;
  if (musicData.hasMusic) {
    report += `**Music Detected:** Yes\n\n`;
    report += `**Summary:** ${musicData.summary}\n\n`;
    report += `### Audio Segments\n\n`;
    for (const seg of musicData.segments.slice(0, 10)) {
      report += `- [${formatTime(seg.start)}-${formatTime(seg.end)}] ${seg.type || 'Audio'}: ${seg.description} (intensity: ${seg.intensity}/10)\n`;
    }
  } else {
    report += `*No music detected*\n`;
  }
  report += '\n\n';

  report += `---\n\n`;

  report += `## Technical Details\n\n`;
  report += `**Per-Second Data Points:** ${perSecondData.per_second_data?.length || 0}\n`;
  report += `**Analysis Method:** AI-powered emotion lens evaluation\n`;
  report += `**Data Files:**\n`;
  report += `- Raw JSON: \`analysis-data.json\`\n`;
  report += `- Per-second data: \`per-second-data.json\`\n`;
  report += `- Chunk analysis: \`chunk-analysis.json\`\n\n`;

  report += `---\n\n`;
  report += `*Generated by OpenTruth Emotion Engine v8.0*\n`;

  return report;
}

/**
 * Format time as MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-report';

  console.log('Evaluation Report Script - Test Mode');
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - artifacts from previous phases (chunkAnalysis, dialogueData, etc.)');
  console.log('');
  console.log('Example usage:');
  console.log('  node evaluation.cjs output/');
}
