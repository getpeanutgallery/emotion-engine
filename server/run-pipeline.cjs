#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 4-step pipeline in sequence
 * 
 * Usage: node server/run-pipeline.cjs <video-path> [output-dir]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger.cjs');

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');

// Log working directory and resolved paths
logger.info(`Starting Emotion Engine Pipeline`);
logger.info(`Working directory: ${process.cwd()}`);
logger.info(`Video path: ${VIDEO_PATH}`);
logger.info(`Output directory: ${OUTPUT_DIR}`);

if (!fs.existsSync(VIDEO_PATH)) {
    logger.error(`Video not found: ${VIDEO_PATH}`);
    process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const STEPS = [
    {
        name: 'Extract Dialogue',
        script: '01-extract-dialogue.cjs',
        output: '01-dialogue-analysis.md',
        description: 'Transcribe speech, identify speakers, detect emotions'
    },
    {
        name: 'Analyze Music',
        script: '02-extract-music.cjs',
        output: '02-music-analysis.md',
        description: 'Analyze music, SFX, audio atmosphere'
    },
    {
        name: 'Chunked Video Analysis',
        script: '03-analyze-chunks.cjs',
        output: '03-chunked-analysis.json',
        description: 'Process video chunks with context memory'
    },
    {
        name: 'Per-Second Emotion Timeline',
        script: '04-per-second-emotions.cjs',
        output: '04-per-second-emotions.json',
        description: 'Generate per-second emotion timeline'
    }
];

/**
 * Validate output file after each step
 * @param {string} filePath - Path to the output file
 * @param {string} stepName - Name of the step for error messages
 * @returns {{valid: boolean, error?: string, size?: number}}
 */
function validateOutputFile(filePath, stepName) {
    const result = { valid: false };
    
    // Check file exists
    if (!fs.existsSync(filePath)) {
        result.error = `Output file missing: ${path.basename(filePath)}`;
        return result;
    }
    
    // Check file size > 0
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
        result.error = `Output file is empty: ${path.basename(filePath)}`;
        return result;
    }
    
    result.size = stats.size;
    
    // For JSON files: validate JSON syntax
    if (filePath.endsWith('.json')) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            JSON.parse(content);
        } catch (e) {
            result.error = `Invalid JSON syntax in ${path.basename(filePath)}: ${e.message}`;
            return result;
        }
    }
    
    result.valid = true;
    return result;
}

function runStep(step, index, totalSteps) {
    return new Promise((resolve, reject) => {
        const progress = ((index + 1) / totalSteps * 100).toFixed(0);
        logger.info(`═══════════════════════════════════════════════════════════`);
        logger.info(`Step ${index + 1}/${totalSteps} (${progress}%): ${step.name}`);
        logger.info(`Description: ${step.description}`);
        logger.info(`═══════════════════════════════════════════════════════════`);
        
        const startTime = Date.now();
        const scriptPath = path.resolve(__dirname, step.script);
        
        logger.info(`Running: ${step.script}`);
        
        const child = spawn('node', [scriptPath, VIDEO_PATH, OUTPUT_DIR], {
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (code === 0) {
                // Validate output file
                const outputPath = path.resolve(OUTPUT_DIR, step.output);
                const validation = validateOutputFile(outputPath, step.name);
                
                if (!validation.valid) {
                    logger.error(`Step ${index + 1} validation failed: ${validation.error}`);
                    reject(new Error(validation.error));
                    return;
                }
                
                logger.info(`Step ${index + 1} complete in ${duration}s`);
                logger.info(`Output: ${step.output} (${(validation.size / 1024).toFixed(1)} KB)`);
                resolve();
            } else {
                logger.error(`Step ${index + 1} failed with code ${code}`);
                reject(new Error(`Step ${index + 1} failed with code ${code}`));
            }
        });
        
        child.on('error', (err) => {
            logger.error(`Failed to run step ${index + 1}: ${err.message}`);
            reject(new Error(`Failed to run step ${index + 1}: ${err.message}`));
        });
    });
}

async function main() {
    logger.info('╔═══════════════════════════════════════════════════════════════════════╗');
    logger.info('║         Emotion Engine - Complete Analysis Pipeline                   ║');
    logger.info('╚═══════════════════════════════════════════════════════════════════════╝');
    
    const pipelineStart = Date.now();
    const validationReport = [];
    
    try {
        // Run each step sequentially
        for (let i = 0; i < STEPS.length; i++) {
            await runStep(STEPS[i], i, STEPS.length);
            validationReport.push({
                step: STEPS[i].name,
                output: STEPS[i].output,
                status: 'passed'
            });
        }
        
        const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(1);
        
        // Generate validation report
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info('VALIDATION REPORT');
        logger.info('═══════════════════════════════════════════════════════════');
        validationReport.forEach((item, idx) => {
            logger.info(`  ${idx + 1}. ${item.step}: ✅ ${item.status}`);
        });
        logger.info('═══════════════════════════════════════════════════════════');
        
        logger.info('PIPELINE COMPLETE!');
        logger.info(`Total time: ${totalDuration}s`);
        logger.info(`Output directory: ${OUTPUT_DIR}/`);
        logger.info('Files generated:');
        STEPS.forEach(step => {
            const outputPath = path.join(OUTPUT_DIR, step.output);
            const stats = fs.statSync(outputPath);
            logger.info(`  • ${step.output} (${(stats.size / 1024).toFixed(1)} KB)`);
        });
        logger.info(`Ready for final report generation: node generate-report.cjs ${OUTPUT_DIR}`);
        logger.info('═══════════════════════════════════════════════════════════');
        
        process.exit(0);
        
    } catch (error) {
        logger.error('PIPELINE FAILED');
        logger.error(`Error: ${error.message}`);
        
        // Add failed step to validation report
        const failedStep = STEPS.find((_, idx) => idx === validationReport.length);
        if (failedStep) {
            validationReport.push({
                step: failedStep.name,
                output: failedStep.output,
                status: 'failed',
                error: error.message
            });
        }
        
        // Generate failure report
        logger.info('Validation Report (up to failure):');
        validationReport.forEach((item, idx) => {
            const status = item.status === 'passed' ? '✅' : '❌';
            logger.info(`  ${idx + 1}. ${item.step}: ${status} ${item.status}${item.error ? ` - ${item.error}` : ''}`);
        });
        logger.info('═══════════════════════════════════════════════════════════');
        
        process.exit(1);
    }
}

main();
