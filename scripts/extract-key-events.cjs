#!/usr/bin/env node
/**
 * Extract Key Events — Hybrid Scene + Audio + Motion Detection
 * 
 * Uses PySceneDetect for scene cuts + Whisper for dialogue detection
 * Merges events and extracts frames at narrative beats
 * 
 * Usage: node extract-key-events.cjs <video-path> [options]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class KeyEventExtractor {
    constructor(videoPath, options = {}) {
        this.videoPath = videoPath;
        this.options = {
            sceneThreshold: options.sceneThreshold || 0.3,
            maxInterval: options.maxInterval || 3,
            outputDir: options.outputDir || './frames',
            whisperModel: options.whisperModel || 'base',
            minEventGap: 0.5
        };
        
        this.events = [];
        this.videoDuration = 0;
    }

    async extract() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  Hybrid Key Event Extraction');
        console.log('  Scene Detection + Dialogue + Safety Net');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (!fs.existsSync(this.videoPath)) {
            throw new Error(`Video not found: ${this.videoPath}`);
        }

        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }

        await this.getVideoDuration();
        console.log(`📹 Video: ${path.basename(this.videoPath)}`);
        console.log(`   Duration: ${this.videoDuration.toFixed(1)}s\n`);

        console.log('🔍 Running detectors...');
        const [sceneEvents, dialogueEvents] = await Promise.all([
            this.detectScenes(),
            this.detectDialogue()
        ]);

        this.events = this.mergeEvents(sceneEvents, dialogueEvents);
        this.events = this.addSafetyNetFrames(this.events);
        this.events = this.deduplicateEvents(this.events);

        console.log(`\n✅ Total unique events: ${this.events.length}`);

        console.log('\n🎬 Extracting frames...');
        const frames = await this.extractFrames();

        await this.generateReport(frames);

        return {
            events: this.events,
            frames,
            outputDir: this.options.outputDir
        };
    }

    async getVideoDuration() {
        return new Promise((resolve, reject) => {
            const ffprobe = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                this.videoPath
            ]);

            let output = '';
            ffprobe.stdout.on('data', (data) => {
                output += data.toString();
            });

            ffprobe.on('close', (code) => {
                if (code === 0) {
                    this.videoDuration = parseFloat(output.trim());
                    resolve(this.videoDuration);
                } else {
                    reject(new Error('Failed to get video duration'));
                }
            });
        });
    }

    async detectScenes() {
        console.log('   🎞️  Scene detection (PySceneDetect)...');
        
        const events = [];
        const tempDir = fs.mkdtempSync('/tmp/scenedetect-');
        
        return new Promise((resolve) => {
            const scenedetect = spawn('scenedetect', [
                '-i', this.videoPath,
                '-o', tempDir,
                'detect-content',
                '-t', String(this.options.sceneThreshold),
                'list-scenes',
                '-f', path.join(tempDir, 'scenes.csv')
            ]);

            scenedetect.on('close', () => {
                const csvPath = path.join(tempDir, 'scenes.csv');
                if (fs.existsSync(csvPath)) {
                    const csv = fs.readFileSync(csvPath, 'utf8');
                    const lines = csv.split('\n').slice(1);
                    
                    lines.forEach(line => {
                        const parts = line.split(',');
                        if (parts.length >= 3) {
                            const startTime = parseFloat(parts[1]);
                            if (!isNaN(startTime)) {
                                events.push({
                                    time: startTime,
                                    type: 'scene',
                                    confidence: 0.9,
                                    description: 'Scene cut'
                                });
                            }
                        }
                    });
                }

                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`      Found ${events.length} scene cuts`);
                resolve(events);
            });
        });
    }

    async detectDialogue() {
        console.log('   🎤 Dialogue detection (Whisper)...');
        
        const events = [];
        const tempDir = fs.mkdtempSync('/tmp/whisper-');
        
        return new Promise((resolve) => {
            const whisper = spawn('whisper', [
                this.videoPath,
                '--model', this.options.whisperModel,
                '--output_format', 'json',
                '--output_dir', tempDir,
                '--word_timestamps', 'True',
                '--verbose', 'False'
            ]);

            whisper.on('close', () => {
                const jsonFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.json'));
                
                if (jsonFiles.length > 0) {
                    const jsonPath = path.join(tempDir, jsonFiles[0]);
                    const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    
                    if (result.segments) {
                        result.segments.forEach(segment => {
                            const startTime = segment.start;
                            const text = segment.text?.trim() || '';
                            
                            if (text.length > 0) {
                                events.push({
                                    time: startTime,
                                    type: 'dialogue',
                                    confidence: segment.avg_logprob || 0.8,
                                    description: `Speech: "${text.substring(0, 50)}..."`
                                });
                            }
                        });
                    }
                }

                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`      Found ${events.length} dialogue segments`);
                resolve(events);
            });
        });
    }

    mergeEvents(sceneEvents, dialogueEvents) {
        const merged = [...sceneEvents, ...dialogueEvents];
        return merged.sort((a, b) => a.time - b.time);
    }

    addSafetyNetFrames(events) {
        const safetyEvents = [];
        let lastTime = 0;
        
        for (let t = 0; t < this.videoDuration; t += this.options.maxInterval) {
            const hasNearbyEvent = events.some(e => 
                Math.abs(e.time - t) < this.options.maxInterval * 0.8
            );
            
            if (!hasNearbyEvent) {
                safetyEvents.push({
                    time: t,
                    type: 'safety',
                    confidence: 0.5,
                    description: 'Safety net frame'
                });
            }
        }
        
        return [...events, ...safetyEvents].sort((a, b) => a.time - b.time);
    }

    deduplicateEvents(events) {
        const unique = [];
        
        for (const event of events) {
            const isDuplicate = unique.some(u => 
                Math.abs(u.time - event.time) < this.options.minEventGap
            );
            
            if (!isDuplicate) {
                unique.push(event);
            }
        }
        
        return unique;
    }

    async extractFrames() {
        const frames = [];
        
        for (let i = 0; i < this.events.length; i++) {
            const event = this.events[i];
            const outputPath = path.join(
                this.options.outputDir, 
                `frame-${String(i).padStart(3, '0')}-${event.type}.jpg`
            );
            
            process.stdout.write(`   [${i + 1}/${this.events.length}] ${event.time.toFixed(1)}s... `);
            
            try {
                await this.extractFrameAt(event.time, outputPath);
                const stats = fs.statSync(outputPath);
                
                frames.push({
                    index: i,
                    time: event.time,
                    type: event.type,
                    path: outputPath,
                    size: stats.size,
                    description: event.description
                });
                
                console.log('✅');
            } catch (e) {
                console.log(`❌ ${e.message}`);
            }
        }
        
        return frames;
    }

    async extractFrameAt(timestamp, outputPath) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-ss', String(timestamp),
                '-i', this.videoPath,
                '-vframes', '1',
                '-vf', 'scale=480:-1',
                '-q:v', '5',
                '-f', 'image2',
                outputPath
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    resolve();
                } else {
                    reject(new Error('Frame extraction failed'));
                }
            });
        });
    }

    async generateReport(frames) {
        const reportPath = path.join(this.options.outputDir, 'extraction-report.json');
        
        const report = {
            video: path.basename(this.videoPath),
            duration: this.videoDuration,
            totalFrames: frames.length,
            eventTypes: {
                scene: frames.filter(f => f.type === 'scene').length,
                dialogue: frames.filter(f => f.type === 'dialogue').length,
                safety: frames.filter(f => f.type === 'safety').length
            },
            frames: frames.map(f => ({
                index: f.index,
                time: f.time,
                type: f.type,
                description: f.description
            })),
            timestamps: frames.map(f => f.time),
            generatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📝 Report saved: ${reportPath}`);
        
        // Print summary
        console.log('\n📊 Extraction Summary:');
        console.log(`   Total frames: ${report.totalFrames}`);
        console.log(`   Scene cuts: ${report.eventTypes.scene}`);
        console.log(`   Dialogue starts: ${report.eventTypes.dialogue}`);
        console.log(`   Safety nets: ${report.eventTypes.safety}`);
        console.log(`\n   Average interval: ${(this.videoDuration / report.totalFrames).toFixed(2)}s`);
        console.log(`   Fixed 3s would give: ${Math.floor(this.videoDuration / 3)} frames`);
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node extract-key-events.cjs <video-path> [options]');
        console.log('\nOptions:');
        console.log('  --scene-threshold 0.3    Scene detection sensitivity');
        console.log('  --max-interval 3         Maximum seconds between frames');
        console.log('  --output-dir ./frames    Output directory');
        console.log('  --whisper-model base     Whisper model size');
        process.exit(1);
    }
    
    const videoPath = args[0];
    const options = {};
    
    for (let i = 1; i < args.length; i += 2) {
        const key = args[i].replace('--', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const value = args[i + 1];
        options[key] = isNaN(value) ? value : parseFloat(value);
    }
    
    const extractor = new KeyEventExtractor(videoPath, options);
    
    try {
        await extractor.extract();
    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    }
}

main();
