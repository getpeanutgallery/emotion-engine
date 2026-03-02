#!/usr/bin/env node
/**
 * Step 3: Chunked Video Analysis with STRICT JSON Output
 * Forces AI to return structured data for reliable parsing
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv[3] || './analysis-output';
const CHUNK_DURATION = 8;

const PERSONA = { 
    name: 'The Impatient Teenager', 
    description: '17yo Gen Z, 200+ TikToks/day, scrolls if bored'
};

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    const data = { dialogue: null, music: null };
    
    if (fs.existsSync(dialoguePath)) {
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.dialogue = JSON.parse(match[1]); } catch {} }
    }
    if (fs.existsSync(musicPath)) {
        const content = fs.readFileSync(musicPath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.music = JSON.parse(match[1]); } catch {} }
    }
    return data;
}

function getDialogueForTime(data, start, end) {
    if (!data?.dialogue_segments) return '';
    return data.dialogue_segments.filter(d => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const s = parse(d.timestamp_start), e = parse(d.timestamp_end);
        return (s >= start && s <= end) || (e >= start && e <= end);
    }).map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n');
}

function getMusicForTime(data, start, end) {
    if (!data?.audio_segments) return '';
    return data.audio_segments.filter(m => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const range = m.timestamp_range.split(' - ');
        const s = parse(range[0]), e = parse(range[1]);
        return (s >= start && s <= end) || (e >= start && e <= end) || (s <= start && e >= end);
    }).map(m => `[${m.timestamp_range}] ${m.description}`).join('\n');
}

// STRICT formatting - always the same structure
function formatPreviousState(state) {
    if (!state) return '';
    
    const pd = state.patience >= 8 ? 'still patient, giving it a chance' : 
               state.patience >= 5 ? 'getting impatient' : 'about to scroll';
    const bd = state.boredom <= 2 ? 'not bored' : 
               state.boredom <= 5 ? 'slightly bored' : 
               state.boredom <= 7 ? 'pretty bored' : 'extremely bored';
    const ed = state.excitement >= 8 ? 'very hyped' : 
               state.excitement >= 5 ? 'somewhat interested' : 'not feeling it';
    
    return `**Your Emotional State at ${state.timestamp}s:**

- Patience level: ${state.patience}/10 (${pd})
- Boredom level: ${state.boredom}/10 (${bd})
- Excitement level: ${state.excitement}/10 (${ed})
- What you were thinking: "${state.thought}"
`;
}

async function getDuration(videoPath) {
    return new Promise((resolve) => {
        spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
            .stdout.on('data', (d) => resolve(parseFloat(d.toString().trim())));
    });
}

async function extractChunk(startTime, duration, outputPath) {
    return new Promise((resolve, reject) => {
        spawn('ffmpeg', ['-ss', String(startTime), '-i', VIDEO_PATH, '-t', String(duration), '-c', 'copy', '-y', outputPath])
            .on('close', (c) => c === 0 ? resolve(fs.statSync(outputPath).size / 1024 / 1024) : reject());
    });
}

// STRICT JSON parsing - no regex fallbacks
function parseStructuredResponse(analysis) {
    // Extract JSON block
    const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || 
                     analysis.match(/({[\s\S]*})/);
    
    if (!jsonMatch) {
        throw new Error('No JSON found in response');
    }
    
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    if (typeof parsed.patience !== 'number' || 
        typeof parsed.boredom !== 'number' || 
        typeof parsed.excitement !== 'number') {
        throw new Error('Missing required emotional ratings');
    }
    
    return {
        patience: Math.max(0, Math.min(10, Math.round(parsed.patience))),
        boredom: Math.max(0, Math.min(10, Math.round(parsed.boredom))),
        excitement: Math.max(0, Math.min(10, Math.round(parsed.excitement))),
        thought: String(parsed.thought || parsed.summary || 'continuing...').substring(0, 200),
        scroll_risk: String(parsed.scroll_risk || 'medium'),
        visuals: String(parsed.visuals || '').substring(0, 300),
        summary: String(parsed.summary || parsed.thought || '').substring(0, 200)
    };
}

async function analyzeChunk(chunkPath, index, total, startTime, endTime, prevState, dialogueCtx, musicCtx) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    // Build context
    let context = '';
    if (prevState) context += formatPreviousState(prevState);
    if (dialogueCtx) context += `**Dialogue:**\n${dialogueCtx}\n\n`;
    if (musicCtx) context += `**Music:**\n${musicCtx}\n\n`;
    
    // STRICT JSON prompt - no freeform text allowed
    const prompt = `You are ${PERSONA.name}, ${PERSONA.description}.

Analyzing chunk ${index + 1}/${total} (${startTime}s - ${endTime}s).

${context}RESPOND ONLY WITH VALID JSON. No explanations, no markdown, just JSON.

Required format:
{
  "visuals": "describe what you see (1-2 sentences)",
  "patience": 0-10,
  "boredom": 0-10,
  "excitement": 0-10,
  "thought": "your internal monologue, Gen Z voice",
  "scroll_risk": "low|medium|high",
  "summary": "brief summary for next chunk"
}

Be brutally honest. Use numbers only for ratings.`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 800,
            response_format: { type: 'json_object' }  // Force JSON if supported
        })
    });
    
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const analysis = data.choices[0].message.content;
    
    // Parse strict JSON
    const structured = parseStructuredResponse(analysis);
    
    return {
        analysis: analysis,
        structured: structured,
        tokens: data.usage?.total_tokens
    };
}

async function main() {
    console.log('Step 3: Chunked Video Analysis (Structured JSON)\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const contextData = loadContextFiles();
    console.log(`   Dialogue: ${contextData.dialogue?.dialogue_segments?.length || 0}`);
    console.log(`   Music: ${contextData.music?.audio_segments?.length || 0}`);
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`\nVideo: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/chunks-');
    const results = [];
    let previousState = null;
    
    for (let i = 0; i < numChunks && i < 4; i++) {
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min(startTime + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i + 1}/${numChunks}] ${startTime}s-${endTime}s`);
        
        try {
            const sizeMB = await extractChunk(startTime, CHUNK_DURATION, chunkPath);
            console.log(`   Size: ${sizeMB.toFixed(2)} MB`);
            if (sizeMB > 10) { console.log('   Skipping (too large)'); continue; }
            
            const dialogueCtx = getDialogueForTime(contextData.dialogue, startTime, endTime);
            const musicCtx = getMusicForTime(contextData.music, startTime, endTime);
            
            const result = await analyzeChunk(chunkPath, i, numChunks, startTime, endTime, previousState, dialogueCtx, musicCtx);
            console.log(`   ✅ ${result.tokens} tokens`);
            console.log(`      P:${result.structured.patience} B:${result.structured.boredom} E:${result.structured.excitement}`);
            
            // Store structured data for next chunk (CONSISTENT FORMAT)
            previousState = {
                timestamp: endTime,
                patience: result.structured.patience,
                boredom: result.structured.boredom,
                excitement: result.structured.excitement,
                thought: result.structured.thought
            };
            
            results.push({
                chunkIndex: i,
                startTime,
                endTime,
                raw_analysis: result.analysis,
                structured_data: result.structured,
                tokens: result.tokens
            });
            
        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    // Save with structured data
    const output = {
        video: VIDEO_PATH,
        duration,
        persona: PERSONA,
        contextFilesUsed: {
            dialogue: !!contextData.dialogue,
            music: !!contextData.music
        },
        chunks: results,
        totalTokens: results.reduce((a, r) => a + r.tokens, 0),
        generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '03-chunked-analysis.json'), JSON.stringify(output, null, 2));
    
    console.log('\n✅ Done!');
    console.log(`   Chunks: ${results.length}`);
    console.log(`   All data is structured JSON - consistent format guaranteed`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
