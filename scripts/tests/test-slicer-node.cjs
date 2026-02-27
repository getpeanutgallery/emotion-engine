#!/usr/bin/env node
/**
 * Node.js Frame Slicer Test
 * Replicates the browser ffmpeg-slicer component using system ffmpeg
 * 
 * Usage: node test-slicer-node.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/tmp/opentruth-frames';
const FRAME_INTERVAL = 2; // seconds

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract frames using ffmpeg
 */
async function extractFrames() {
    console.log('🎬 Starting frame extraction...');
    console.log(`📹 Video: ${VIDEO_PATH}`);
    console.log(`⏱️  Interval: ${FRAME_INTERVAL}s`);
    console.log(`📁 Output: ${OUTPUT_DIR}`);
    console.log('');

    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // ffmpeg command to extract frames every N seconds
        // -i input.mp4: input file
        // -vf fps=1/2: 1 frame every 2 seconds
        // -q:v 5: JPEG quality (lower = better quality, 1-31 scale)
        // -s 480x?: resize width to 480px (maintain aspect ratio)
        const args = [
            '-i', VIDEO_PATH,
            '-vf', `fps=1/${FRAME_INTERVAL},scale=480:-1`,
            '-q:v', '5',
            '-f', 'image2',
            path.join(OUTPUT_DIR, 'frame_%04d.jpg')
        ];

        console.log('🛠️  Running: ffmpeg ' + args.join(' '));
        console.log('');

        const ffmpeg = spawn('ffmpeg', args);
        
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            
            if (code === 0) {
                console.log(`✅ Extraction complete in ${duration}s`);
                resolve();
            } else {
                console.error('❌ ffmpeg failed:', stderr);
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });
    });
}

/**
 * Analyze extracted frames
 */
async function analyzeFrames() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(f => f.endsWith('.jpg'))
        .sort();
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   Total frames: ${files.length}`);
    
    if (files.length === 0) {
        console.error('❌ No frames extracted!');
        return;
    }
    
    // Get file sizes
    let totalSize = 0;
    const frameData = [];
    
    for (const file of files) {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        const sizeKB = stats.size / 1024;
        totalSize += stats.size;
        
        // Parse frame number and timestamp
        const match = file.match(/frame_(\d+)\.jpg/);
        const frameNum = match ? parseInt(match[1]) : 0;
        const timestamp = (frameNum - 1) * FRAME_INTERVAL;
        
        frameData.push({
            file,
            frameNum,
            timestamp,
            sizeKB
        });
    }
    
    const avgSize = totalSize / files.length / 1024;
    
    console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Average frame: ${avgSize.toFixed(2)} KB`);
    console.log(`   First frame: ${frameData[0].timestamp}s`);
    console.log(`   Last frame: ${frameData[frameData.length - 1].timestamp}s`);
    
    // Show sample frames
    console.log(`\n🖼️  Sample Frames:`);
    const samples = [
        frameData[0],
        frameData[Math.floor(frameData.length / 4)],
        frameData[Math.floor(frameData.length / 2)],
        frameData[Math.floor(frameData.length * 0.75)],
        frameData[frameData.length - 1]
    ];
    
    for (const frame of samples) {
        console.log(`   [${String(frame.timestamp).padStart(3)}s] ${frame.file} (${frame.sizeKB.toFixed(1)} KB)`);
    }
    
    // Verify first frame is valid JPEG
    const firstFrame = fs.readFileSync(path.join(OUTPUT_DIR, files[0]));
    const isValidJPEG = firstFrame[0] === 0xFF && firstFrame[1] === 0xD8;
    console.log(`\n✓ First frame valid JPEG: ${isValidJPEG ? 'YES' : 'NO'}`);
    
    // Convert first frame to base64 (what browser would do)
    const base64 = firstFrame.toString('base64');
    console.log(`✓ First frame Base64 length: ${base64.length} chars (${(base64.length / 1024).toFixed(1)} KB)`);
    
    return {
        frameCount: files.length,
        frames: frameData,
        totalSizeMB: totalSize / 1024 / 1024,
        avgFrameSizeKB: avgSize,
        sampleBase64: base64.substring(0, 100) + '...'
    };
}

/**
 * Cleanup extracted frames
 */
async function cleanup() {
    console.log('\n🧹 Cleaning up...');
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.jpg'));
    for (const file of files) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    console.log(`   Deleted ${files.length} frames`);
}

/**
 * Main
 */
async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  OpenTruth Frame Slicer — Node.js Test');
    console.log('═══════════════════════════════════════════\n');
    
    try {
        // Extract frames
        await extractFrames();
        
        // Analyze results
        const results = await analyzeFrames();
        
        console.log('\n═══════════════════════════════════════════');
        console.log('  Summary:');
        console.log('═══════════════════════════════════════════');
        console.log(`  Frames extracted: ${results.frameCount}`);
        console.log(`  Total payload: ${results.totalSizeMB.toFixed(2)} MB`);
        console.log(`  API-ready: ✓ (Base64 encoded frames)`);
        console.log('═══════════════════════════════════════════\n');
        
        // Cleanup
        await cleanup();
        
        console.log('✅ Test complete! Browser slicer should produce similar results.');
        console.log('   Open http://localhost:8080/test-slicer.html to test the browser version.\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();
