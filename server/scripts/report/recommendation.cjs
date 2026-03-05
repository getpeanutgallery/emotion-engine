#!/usr/bin/env node
/**
 * Recommendation Report Script
 * 
 * Generates AI-powered recommendation based on emotion analysis.
 * This script runs in Phase 3 (Report) of the pipeline.
 * 
 * Analyzes chunk data and metrics to provide actionable insights.
 * 
 * @module scripts/report/recommendation
 */

const fs = require('fs');
const path = require('path');

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.outputDir - Base output directory
 * @param {object} input.artifacts - Artifacts from previous phases
 *   @param {array} input.artifacts.chunkAnalysis.chunks - Array of chunk results
 *   @param {object} input.artifacts.metricsData - Metrics from metrics.cjs
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   🤖 Generating AI recommendation...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    metricsData = {}
  } = artifacts;

  const chunks = chunkAnalysis.chunks || [];

  // Generate recommendation based on analysis
  console.log('   📊 Analyzing emotional patterns...');
  const recommendation = generateRecommendation(chunks, metricsData, config);

  // Create recommendation subdirectory
  const recommendationDir = path.join(outputDir, 'recommendation');
  fs.mkdirSync(recommendationDir, { recursive: true });

  // Save recommendation JSON
  const recommendationPath = path.join(recommendationDir, 'recommendation.json');
  fs.writeFileSync(recommendationPath, JSON.stringify(recommendation, null, 2), 'utf8');
  console.log(`   ✅ Recommendation saved to: ${recommendationPath}`);

  return {
    artifacts: {
      recommendationData: {
        path: recommendationPath,
        generatedAt: recommendation.generatedAt,
        text: recommendation.text,
        reasoning: recommendation.reasoning,
        confidence: recommendation.confidence,
        keyFindings: recommendation.keyFindings,
        suggestions: recommendation.suggestions,
        summary: {
          hasRecommendation: !!recommendation.text && recommendation.text !== 'No recommendation available',
          confidence: recommendation.confidence || 0
        }
      }
    }
  };
}

/**
 * Generate AI recommendation based on emotion analysis
 * 
 * @function generateRecommendation
 * @param {array} chunks - Array of chunk analysis results
 * @param {object} metricsData - Metrics from metrics.cjs
 * @param {object} config - Pipeline config
 * @returns {object} - Recommendation object with text, reasoning, and confidence
 */
function generateRecommendation(chunks, metricsData, config) {
  const recommendation = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    text: '',
    reasoning: '',
    confidence: 0,
    keyFindings: [],
    suggestions: []
  };

  if (!chunks || chunks.length === 0) {
    recommendation.text = 'No recommendation available';
    recommendation.reasoning = 'No chunk analysis data was provided';
    recommendation.confidence = 0;
    return recommendation;
  }

  // Analyze emotional patterns across chunks
  const emotionScores = analyzeEmotionPatterns(chunks);
  
  // Identify dominant emotions
  const dominantEmotions = findDominantEmotions(emotionScores);
  
  // Detect emotional trends
  const trends = detectEmotionalTrends(chunks);
  
  // Calculate engagement score
  const engagementScore = calculateEngagementScore(chunks, emotionScores);

  // Generate recommendation based on analysis
  if (engagementScore >= 7) {
    recommendation.text = 'This content demonstrates strong emotional engagement. The emotional arc effectively maintains viewer attention with compelling peaks and valleys.';
    recommendation.reasoning = `High engagement score (${engagementScore.toFixed(1)}/10) driven by ${dominantEmotions.slice(0, 2).join(' and ')} emotions with clear emotional progression.`;
    recommendation.confidence = 0.85;
    
    recommendation.keyFindings = [
      `Strong ${dominantEmotions[0]} response throughout`,
      `Emotional engagement remains consistent across ${chunks.length} segments`,
      trends.increasing ? 'Emotional intensity builds over time' : 'Emotional intensity remains stable'
    ];
    
    recommendation.suggestions = [
      'Consider amplifying peak emotional moments for even stronger impact',
      'Maintain the current pacing to preserve engagement',
      'Test variations of high-engagement segments to optimize further'
    ];
  } else if (engagementScore >= 5) {
    recommendation.text = 'This content shows moderate emotional engagement with room for improvement. Consider strengthening emotional peaks and reducing flat sections.';
    recommendation.reasoning = `Moderate engagement score (${engagementScore.toFixed(1)}/10) with ${dominantEmotions[0]} as the primary emotion but inconsistent emotional intensity.`;
    recommendation.confidence = 0.72;
    
    recommendation.keyFindings = [
      `Mixed emotional response with ${dominantEmotions[0]} dominating`,
      'Some segments show stronger engagement than others',
      trends.decreasing ? 'Emotional engagement decreases over time' : 'Emotional engagement fluctuates'
    ];
    
    recommendation.suggestions = [
      'Strengthen emotional hooks in the first 3 seconds',
      'Reduce or remove low-engagement segments',
      'Add more dynamic transitions between emotional states',
      'Consider restructuring to build toward a stronger climax'
    ];
  } else {
    recommendation.text = 'This content struggles to maintain emotional engagement. Significant restructuring is recommended to improve viewer retention and emotional impact.';
    recommendation.reasoning = `Low engagement score (${engagementScore.toFixed(1)}/10) with weak emotional responses and ${trends.decreasing ? 'declining' : 'inconsistent'} viewer interest.`;
    recommendation.confidence = 0.68;
    
    recommendation.keyFindings = [
      'Weak emotional response across most segments',
      dominantEmotions[0] === 'boredom' ? 'Boredom is the dominant emotion' : 'Lack of clear emotional focus',
      'Emotional arc lacks compelling progression'
    ];
    
    recommendation.suggestions = [
      'Completely restructure the opening to grab attention immediately',
      'Remove or replace low-engagement segments',
      'Add stronger emotional triggers (surprise, curiosity, excitement)',
      'Consider shorter format to maintain intensity',
      'Test with different target personas to find better alignment'
    ];
  }

  // Add persona-specific insights if available
  if (config?.tool_variables?.soulId) {
    recommendation.suggestions.push(
      `Consider testing with different personas (current: ${config.tool_variables.soulId})`
    );
  }

  return recommendation;
}

/**
 * Analyze emotion patterns across chunks
 * 
 * @function analyzeEmotionPatterns
 * @param {array} chunks - Array of chunk analysis results
 * @returns {object} - Aggregated emotion scores
 */
function analyzeEmotionPatterns(chunks) {
  const emotionScores = {};
  const emotionCounts = {};

  for (const chunk of chunks) {
    if (!chunk.emotions) continue;

    for (const [emotion, data] of Object.entries(chunk.emotions)) {
      const score = data.score || (typeof data === 'number' ? data : 0);
      
      if (!emotionScores[emotion]) {
        emotionScores[emotion] = 0;
        emotionCounts[emotion] = 0;
      }
      
      emotionScores[emotion] += score;
      emotionCounts[emotion]++;
    }
  }

  // Calculate averages
  const averages = {};
  for (const emotion of Object.keys(emotionScores)) {
    averages[emotion] = emotionScores[emotion] / emotionCounts[emotion];
  }

  return averages;
}

/**
 * Find dominant emotions sorted by score
 * 
 * @function findDominantEmotions
 * @param {object} emotionScores - Aggregated emotion scores
 * @returns {array} - Array of emotion names sorted by score
 */
function findDominantEmotions(emotionScores) {
  return Object.entries(emotionScores)
    .sort((a, b) => b[1] - a[1])
    .map(([emotion]) => emotion);
}

/**
 * Detect emotional trends across chunks
 * 
 * @function detectEmotionalTrends
 * @param {array} chunks - Array of chunk analysis results
 * @returns {object} - Trend analysis
 */
function detectEmotionalTrends(chunks) {
  if (chunks.length < 2) {
    return { increasing: false, decreasing: false, stable: true };
  }

  // Compare first half to second half
  const midpoint = Math.floor(chunks.length / 2);
  const firstHalf = chunks.slice(0, midpoint);
  const secondHalf = chunks.slice(midpoint);

  const firstAvg = calculateAverageEngagement(firstHalf);
  const secondAvg = calculateAverageEngagement(secondHalf);

  const change = secondAvg - firstAvg;

  return {
    increasing: change > 1,
    decreasing: change < -1,
    stable: Math.abs(change) <= 1,
    change
  };
}

/**
 * Calculate average engagement for a set of chunks
 * 
 * @function calculateAverageEngagement
 * @param {array} chunks - Array of chunk analysis results
 * @returns {number} - Average engagement score
 */
function calculateAverageEngagement(chunks) {
  if (!chunks || chunks.length === 0) return 0;

  let totalEngagement = 0;
  let count = 0;

  for (const chunk of chunks) {
    if (!chunk.emotions) continue;

    // Engagement = excitement + curiosity - boredom (simplified)
    const excitement = chunk.emotions.excitement?.score || 0;
    const curiosity = chunk.emotions.curiosity?.score || 0;
    const boredom = chunk.emotions.boredom?.score || 10; // Default high if missing

    const engagement = excitement + curiosity + (10 - boredom);
    totalEngagement += engagement;
    count++;
  }

  return count > 0 ? totalEngagement / count : 0;
}

/**
 * Calculate overall engagement score (0-10)
 * 
 * @function calculateEngagementScore
 * @param {array} chunks - Array of chunk analysis results
 * @param {object} emotionScores - Aggregated emotion scores
 * @returns {number} - Engagement score
 */
function calculateEngagementScore(chunks, emotionScores) {
  const avgEngagement = calculateAverageEngagement(chunks);
  
  // Normalize to 0-10 scale (max theoretical is 30: 10+10+10)
  return Math.min(10, Math.max(0, avgEngagement / 3));
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-recommendation';
  
  run({
    outputDir,
    artifacts: {
      chunkAnalysis: {
        chunks: [
          {
            emotions: {
              excitement: { score: 8, reasoning: 'High energy' },
              boredom: { score: 2, reasoning: 'Very engaging' },
              curiosity: { score: 7, reasoning: 'Intriguing content' }
            }
          },
          {
            emotions: {
              excitement: { score: 6, reasoning: 'Moderate energy' },
              boredom: { score: 4, reasoning: 'Some drag' },
              curiosity: { score: 5, reasoning: 'Somewhat interesting' }
            }
          }
        ],
        videoDuration: 120
      },
      metricsData: {
        summary: {
          averages: { excitement: 7, boredom: 3, curiosity: 6 }
        }
      }
    },
    config: { version: '8.0.0', name: 'Test Pipeline', tool_variables: { soulId: 'test-persona' } }
  })
    .then(result => {
      console.log('Recommendation generation complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch(console.error);
}
