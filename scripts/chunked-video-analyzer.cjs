#!/usr/bin/env node
/**
 * Chunked Video Analysis with Memory and Audio Context
 * 
 * Processes long videos by:
 * 1. Extracting 10s chunks
 * 2. Summarizing each chunk
 * 3. Carrying context forward to next chunk
 * 4. Transcribing full audio separately
 * 5. Merging results
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/chunked-analysis';

// Configuration
const CHUNK_DURATION = 10;  // seconds (for 10MB limit)
const OVERLAP = 2;          // seconds of overlap between chunks
const MAX_TOKENS = 2000;

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

class ChunkedVideoAnalyzer {
    constructor() {
        this.chunks = [];
        this.summaries = [];
        this.fullAudioTranscript = null;
    }

    /**
     * Get video duration
     */
    async getDuration(videoPath) {
        return new Promise((resolve) => {
            spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
            ]).stdout.on('data', (data) => resolve(parseFloat(data.toString().trim())));
        });
    }

    /**
     * Extract and compress video chunk
     */
    async extractChunk(startTime, duration, outputPath) {
        await new Promise((resolve, reject) => {
            spawn('ffmpeg', [
                '-ss', String(startTime),
                '-i', VIDEO_PATH,
                '-t', String(duration),
                '-vf', 'scale=720:-1',
                '-c:v', 'libx264',
                '-b:v', '800k',
                '-preset', 'fast',
                '-c:a', 'aac',
                '-b:a', '64k',
                '-y',
                outputPath
            ]).on('close', (c) => c === 0 ? resolve() : reject());
        });
        
        const stats = fs.statSync(outputPath);
        return stats.size;
    }

    /**
     * Send chunk to Qwen with memory
     */
    async analyzeChunk(chunkPath, chunkIndex, totalChunks, previousSummary, audioContext) {
        const buf = fs.readFileSync(chunkPath);
        const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
        
        // Build prompt with context
        let contextPrompt = '';
        if (previousSummary) {
            contextPrompt = `\n\nContext from previous ${CHUNK_DURATION}s:\n${previousSummary}\n\n` +
                           `Important: Your emotional state and attention are CONTINUING from above. ` +
                           `You're at ${chunkIndex * CHUNK_DURATION}s now.`;
        }
        
        if (audioContext) {
            contextPrompt += `\n\nAudio context (what you've heard): "${audioContext}"`;
        }
        
        const prompt = `You are a 17-year-old Gen Z viewer on ${chunkIndex + 1}/${totalChunks} of a Call of Duty trailer.${contextPrompt}

Analyze this ${CHUNK_DURATION}s video chunk:
1. What do you see happening (motion, graphics, action)?
2. What's your emotional reaction (patience 1-10, boredom 1-10, excitement 1-10)?
3. Are you about to scroll?
4. Summarize the key narrative beats in 2-3 sentences for the next chunk's context.

Be brutally honest, teen voice.`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'video_url', video_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: MAX_TOKENS
            })
        });
        
        const data = await res.json();
        return {
            analysis: data.choices[0].message.content,
            tokens: data.usage?.total_tokens || 0,
            model: data.model || MODEL
        };
    }

    /**
     * Transcribe full audio with Whisper
     */
    async transcribeAudio() {
        console.log('   🎤 Transcribing full audio with Whisper...');
        
        const tempDir = fs.mkdtempSync('/tmp/whisper-full-');
        const audioPath = path.join(tempDir, 'audio.wav');
        
        // Extract audio
        await new Promise((res) => {
            spawn('ffmpeg', [
                '-i', VIDEO_PATH,
                '-vn', '-acodec', 'pcm_s16le',
                '-ar', '16000', '-ac', '1',
                '-y', audioPath
            ]).on('close', res);
        });
        
        // Run whisper
        await new Promise((res) => {
            spawn('whisper', [
                audioPath,
                '--model', 'base',
                '--output_format', 'json',
                '--output_dir', tempDir,
                '--verbose', 'False'
            ]).on('close', res);
        });
        
        // Parse results
        const jsonFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.json'));
        let transcript = '';
        
        if (jsonFiles.length > 0) {
            const result = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFiles[0]), 'utf8'));
            transcript = result.segments?.map(s => `[${s.start.toFixed(1)}s] ${s.text}`).join('\n') || '';
        }
        
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log(`      Done: ${transcript.split('\n').length} segments`);
        return transcript;
    }

    /**
     * Main processing loop
     */
    async process() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  Chunked Video Analysis with Memory');
        console.log('  Video + Audio Context');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Setup
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        
        // Get duration and determine chunks
        const duration = await this.getDuration(VIDEO_PATH);
        const numChunks = Math.ceil(duration / CHUNK_DURATION);
        console.log(`📹 Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
        
        // Transcribe full audio first (for context)
        this.fullAudioTranscript = await this.transcribeAudio();
        
        // Process each chunk with memory
        let previousSummary = null;
        const chunkResults = [];
        
        for (let i = 0; i < numChunks; i++) {
            const startTime = i * CHUNK_DURATION;
            const chunkPath = path.join(OUTPUT_DIR, `chunk-${String(i).padStart(2, '0')}.mp4`);
            
            console.log(`\n[${i + 1}/${numChunks}] Chunk ${startTime}s-${Math.min(startTime + CHUNK_DURATION, duration)}s`);
            
            // Extract chunk
            const size = await this.extractChunk(startTime, CHUNK_DURATION, chunkPath);
            console.log(`   📦 Extracted: ${(size / 1024 / 1024).toFixed(2)} MB`);
            
            // Get relevant audio context for this chunk
            const audioContext = this.fullAudioTranscript
                .split('\n')
                .filter(line => {
                    const match = line.match(/\[([0-9.]+)s\]/);
                    if (!match) return false;
                    const t = parseFloat(match[1]);
                    return t >= startTime && t < startTime + CHUNK_DURATION;
                })
                .join('; ');
            
            // Analyze with context
            console.log('   🤖 Analyzing...');
            const result = await this.analyzeChunk(
                chunkPath, 
                i, 
                numChunks, 
                previousSummary,
                audioContext
            );
            
            console.log(`   ✅ Done (${result.tokens} tokens)`);
            
            // Extract summary for next chunk
            const summaryMatch = result.analysis.match(/(?:Summary|Context):?\s*(.+?)(?:\n|$)/i);
            previousSummary = summaryMatch ? summaryMatch[1].trim() : result.analysis.substring(0, 200);
            
            chunkResults.push({
                chunkIndex: i,
                startTime,
                analysis: result.analysis,
                summary: previousSummary,
                tokens: result.tokens
            });
            
            // Cleanup chunk file
            fs.unlinkSync(chunkPath);
        }
        
        // Generate final merged report
        await this.generateReport(chunkResults);
        
        return chunkResults;
    }

    async generateReport(results) {
        const report = {
            chunks: results,
            totalTokens: results.reduce((a, r) => a + r.tokens, 0),
            fullAudioTranscript: this.fullAudioTranscript,
            config: {
                chunkDuration: CHUNK_DURATION,
                overlap: OVERLAP,
                model: MODEL
            }
        };
        
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'chunked-analysis.json'),
            JSON.stringify(report, null, 2)
        );
        
        // Human-readable version
        let readable = `CHUNKED VIDEO ANALYSIS REPORT\n`;
        readable += `${'='.repeat(70)}\n\n`;
        readable += `Model: ${MODEL}\n`;
        readable += `Chunks: ${results.length}\n`;
        readable += `Total Tokens: ${report.totalTokens}\n\n`;
        readable += `FULL AUDIO TRANSCRIPT:\n${report.fullAudioTranscript}\n\n`;
        readable += `${'='.repeat(70)}\n\n`;
        
        results.forEach(r => {
            readable += `CHUNK ${r.chunkIndex + 1} (${r.startTime}s)\n`;
            readable += `${'-'.repeat(50)}\n`;
            readable += r.analysis;
            readable += `\n\n`;
        });
        
        fs.writeFileSync(path.join(OUTPUT_DIR, 'chunked-analysis.txt'), readable);
        
        console.log(`\n✅ Reports saved to: ${OUTPUT_DIR}/`);
    }
}

// Run
new ChunkedVideoAnalyzer().process().catch(console.error);
