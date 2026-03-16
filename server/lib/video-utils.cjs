#!/usr/bin/env node
/**
 * Video Utilities for Emotion Engine
 * 
 * Provides chunk compression and video processing utilities
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath, ffprobePath } = require('./ffmpeg-path.cjs');
const { buildVideoCompressArgs } = require('./ffmpeg-config.cjs');

/**
 * Compress a video chunk to meet size requirements
 * 
 * @param {string} inputPath - Path to input video file
 * @param {string} outputPath - Path to output compressed file
 * @param {number} maxSizeBytes - Maximum target size in bytes
 * @returns {Promise<{success: boolean, originalSize: number, compressedSize: number}>}
 */
async function compressChunk(inputPath, outputPath, maxSizeBytes, config) {
    const originalSize = fs.statSync(inputPath).size;
    
    // If already under target, just copy
    if (originalSize <= maxSizeBytes) {
        fs.copyFileSync(inputPath, outputPath);
        return {
            success: true,
            originalSize,
            compressedSize: originalSize
        };
    }
    
    // Calculate target bitrate in kbps
    // Get duration first
    const duration = await getDuration(inputPath);
    if (!duration || duration <= 0) {
        console.error('   ⚠️  Could not determine video duration, skipping compression');
        fs.copyFileSync(inputPath, outputPath);
        return {
            success: false,
            originalSize,
            compressedSize: originalSize
        };
    }
    
    // Target bitrate = (targetSize * 8) / duration (in kbps)
    // Leave some headroom (90% of max)
    const targetSizeBytes = maxSizeBytes * 0.9;
    const targetBitrateKbps = Math.floor((targetSizeBytes * 8) / duration);
    
    const args = buildVideoCompressArgs({
        inputPath,
        outputPath,
        maxSizeBytes,
        durationSeconds: duration,
        config,
        aggressive: false
    });
    
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, args);
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.error(`   ⚠️  FFmpeg compression failed (code ${code}), using original`);
                fs.copyFileSync(inputPath, outputPath);
                return resolve({
                    success: false,
                    originalSize,
                    compressedSize: originalSize
                });
            }
            
            // Check if compression met target
            const compressedSize = fs.statSync(outputPath).size;
            const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            
            console.log(`   📦 Compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${ratio}% reduction)`);
            
            // If still too large, try again with more aggressive settings
            if (compressedSize > maxSizeBytes) {
                console.log(`   ⚠️  Still over target, trying more aggressive compression...`);
                return compressChunkAggressive(inputPath, outputPath, maxSizeBytes, originalSize, config)
                    .then(resolve)
                    .catch(() => {
                        fs.copyFileSync(inputPath, outputPath);
                        resolve({ success: false, originalSize, compressedSize });
                    });
            }
            
            resolve({
                success: true,
                originalSize,
                compressedSize
            });
        });
        
        ffmpeg.on('error', (err) => {
            console.error(`   ⚠️  FFmpeg error: ${err.message}, using original`);
            fs.copyFileSync(inputPath, outputPath);
            resolve({
                success: false,
                originalSize,
                compressedSize: originalSize
            });
        });
    });
}

/**
 * More aggressive compression fallback
 */
async function compressChunkAggressive(inputPath, outputPath, maxSizeBytes, originalSize, config) {
    const duration = await getDuration(inputPath);
    const args = buildVideoCompressArgs({
        inputPath,
        outputPath,
        maxSizeBytes,
        durationSeconds: duration,
        config,
        aggressive: true
    });
    
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, args);
        
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Aggressive compression failed'));
                return;
            }
            
            const compressedSize = fs.statSync(outputPath).size;
            const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            
            console.log(`   📦 Aggressive: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${ratio}% reduction)`);
            
            resolve({
                success: true,
                originalSize,
                compressedSize
            });
        });
        
        ffmpeg.on('error', reject);
    });
}

/**
 * Get video duration in seconds
 */
async function getDuration(videoPath) {
    return new Promise((resolve) => {
        const ffprobe = spawn(ffprobePath, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);
        
        let duration = '';
        ffprobe.stdout.on('data', (data) => {
            duration += data.toString().trim();
        });
        
        ffprobe.on('close', () => {
            resolve(parseFloat(duration) || 0);
        });
        
        ffprobe.on('error', () => {
            resolve(0);
        });
    });
}

module.exports = {
    compressChunk,
    getDuration
};
