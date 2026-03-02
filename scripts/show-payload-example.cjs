#!/usr/bin/env node
/**
 * Debug: Show example payload sent to Qwen
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.argv[2] || './test-output';
const CHUNK_START = 8;  // Example: the problematic 8s mark
const CHUNK_END = 16;

console.log('═══════════════════════════════════════════════════════════');
console.log('  Example Payload to Qwen (Per-Second Analysis)');
console.log(`  Chunk: ${CHUNK_START}s-${CHUNK_END}s`);
console.log('═══════════════════════════════════════════════════════════\n');

// Load context files
const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');

let dialogueData = null;
let musicData = null;

if (fs.existsSync(dialoguePath)) {
    const content = fs.readFileSync(dialoguePath, 'utf8');
    const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (match) {
        try { dialogueData = JSON.parse(match[1]); } catch {}
    }
}

if (fs.existsSync(musicPath)) {
    const content = fs.readFileSync(musicPath, 'utf8');
    const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (match) {
        try { musicData = JSON.parse(match[1]); } catch {}
    }
}

// Extract relevant content for 8s-16s chunk
const dialogueInChunk = dialogueData?.dialogue_segments?.filter(d => {
    const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
    const s = parse(d.timestamp_start);
    return s >= CHUNK_START && s <= CHUNK_END;
}) || [];

const musicInChunk = musicData?.audio_segments?.filter(m => {
    const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
    const range = m.timestamp_range.split(' - ');
    const s = parse(range[0]), e = parse(range[1]);
    return (s >= CHUNK_START && s <= CHUNK_END) || (e >= CHUNK_START && e <= CHUNK_END) || (s <= CHUNK_START && e >= CHUNK_END);
}) || [];

console.log('PAYLOAD STRUCTURE:');
console.log('═'.repeat(60));
console.log('{');
console.log('  "model": "qwen/qwen3.5-122b-a10b",');
console.log('  "messages": [');
console.log('    {');
console.log('      "role": "user",');
console.log('      "content": [');
console.log('        {');
console.log('          "type": "text",');
console.log('          "text": "[SEE BELOW - ~800-1500 chars]"');
console.log('        },');
console.log('        {');
console.log('          "type": "video_url",');
console.log('          "video_url": {');
console.log('            "url": "data:video/mp4;base64,[BASE64 ~1.7MB]"');
console.log('          }');
console.log('        }');
console.log('      ]');
console.log('    }');
console.log('  ],');
console.log('  "max_tokens": 4000');
console.log('}');
console.log('═'.repeat(60));

console.log('\n\nTEXT PROMPT (~800-1500 chars):');
console.log('═'.repeat(60));

const PERSONA = { name: 'The Impatient Teenager', description: '17yo Gen Z, scrolls if bored' };

let prompt = `You are ${PERSONA.name}, ${PERSONA.description}.`;
prompt += ` Watch this 8s segment (8s-16s) and track emotions EVERY SECOND.`;

// Previous state (simulated from chunk 0-8s)
prompt += `\n\nPrevious state: P:8 B:1 E:7 - "Alright, keep going. Don't bore me. I'm invested now."`;

// DIALOGUE CONTEXT
if (dialogueInChunk.length > 0) {
    prompt += `\n\nDIALOGUE IN THIS SEGMENT:\n`;
    dialogueInChunk.forEach(d => {
        prompt += `[${d.timestamp_start}] ${d.speaker} (${d.emotion}): "${d.text.substring(0, 60)}${d.text.length > 60 ? '...' : ''}"\n`;
    });
} else {
    prompt += `\n\nDIALOGUE IN THIS SEGMENT: (none)`;
}

// MUSIC CONTEXT  
if (musicInChunk.length > 0) {
    prompt += `\n\nMUSIC/AUDIO IN THIS SEGMENT:\n`;
    musicInChunk.forEach(m => {
        prompt += `[${m.timestamp_range}] ${m.description.substring(0, 80)}${m.description.length > 80 ? '...' : ''}\n`;
    });
} else {
    prompt += `\n\nMUSIC/AUDIO IN THIS SEGMENT: (no specific data)`;
}

prompt += `\n\nFor each second from 8 to 16, provide in JSON:`;
prompt += `\n{\n  "per_second_analysis": [`;
prompt += `\n    {"timestamp": 8, "visuals": "...", "patience": 0-10, "boredom": 0-10, "excitement": 0-10, "thought": "...", "scroll_risk": "low|medium|high"}`;
prompt += `\n  ]\n}`;
prompt += `\n\nBe brutally honest. Use Gen Z voice. Include EVERY SECOND. Consider how dialogue and music affect your emotions.`;

console.log(prompt);
console.log('═'.repeat(60));

// Stats
console.log('\n\nPROMPT STATISTICS:');
console.log(`  Characters: ${prompt.length}`);
console.log(`  Lines: ${prompt.split('\n').length}`);
console.log(`  Dialogue entries: ${dialogueInChunk.length}`);
console.log(`  Music entries: ${musicInChunk.length}`);

// Optimization suggestions
console.log('\n\nOPTIMIZATION OPPORTUNITIES:');
if (dialogueInChunk.length > 3) {
    console.log(`  ⚠️  ${dialogueInChunk.length} dialogue lines - consider limiting to top 3 most important`);
}
if (musicInChunk.length > 2) {
    console.log(`  ⚠️  ${musicInChunk.length} music segments - consider limiting to current/active`);
}
if (prompt.length > 2000) {
    console.log(`  ⚠️  Prompt is ${prompt.length} chars - approaching token limits`);
}
console.log('  💡 Could summarize previous state to 1 sentence');
console.log('  💡 Could truncate long dialogue/music descriptions');
